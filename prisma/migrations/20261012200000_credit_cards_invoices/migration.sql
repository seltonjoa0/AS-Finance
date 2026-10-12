-- Credit-card accounts, billing cycles, purchases, and invoice payments.
-- Cross-tenant references always include financial_space_id.
BEGIN;

CREATE TYPE "CreditCardInvoiceStatus" AS ENUM ('OPEN', 'CLOSED', 'PAID');

ALTER TYPE "AccountType" ADD VALUE 'CREDIT_CARD' BEFORE 'OTHER';

CREATE TABLE "credit_cards" (
    "id" UUID NOT NULL,
    "financial_space_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "bank" VARCHAR(100) NOT NULL,
    "credit_limit" DECIMAL(19,4) NOT NULL,
    "closing_day" INTEGER NOT NULL,
    "due_day" INTEGER NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "credit_cards_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "credit_cards_bank_check" CHECK (BTRIM("bank") <> ''),
    CONSTRAINT "credit_cards_credit_limit_check" CHECK ("credit_limit" > 0),
    CONSTRAINT "credit_cards_cent_precision_check" CHECK (
      "credit_limit" = ROUND("credit_limit", 2)
    ),
    CONSTRAINT "credit_cards_closing_day_check" CHECK (
      "closing_day" BETWEEN 1 AND 31
    ),
    CONSTRAINT "credit_cards_due_day_check" CHECK (
      "due_day" BETWEEN 1 AND 31
    )
);

CREATE TABLE "credit_card_invoices" (
    "id" UUID NOT NULL,
    "financial_space_id" UUID NOT NULL,
    "credit_card_id" UUID NOT NULL,
    "closing_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "status" "CreditCardInvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "closed_at" TIMESTAMPTZ(3),
    "paid_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "credit_card_invoices_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "credit_card_invoices_date_range_check" CHECK (
      "due_date" > "closing_date"
    ),
    CONSTRAINT "credit_card_invoices_state_timestamps_check" CHECK (
      (
        "status" = 'OPEN'
        AND "closed_at" IS NULL
        AND "paid_at" IS NULL
      )
      OR (
        "status" = 'CLOSED'
        AND "closed_at" IS NOT NULL
        AND "paid_at" IS NULL
        AND "closed_at" >= "created_at"
      )
      OR (
        "status" = 'PAID'
        AND "closed_at" IS NOT NULL
        AND "paid_at" IS NOT NULL
        AND "closed_at" >= "created_at"
        AND "paid_at" >= "closed_at"
      )
    )
);

ALTER TABLE "financial_transactions"
  ADD COLUMN "credit_card_invoice_id" UUID,
  ADD CONSTRAINT "financial_transactions_invoice_expense_check" CHECK (
    "credit_card_invoice_id" IS NULL OR "type" = 'EXPENSE'
  );

ALTER TABLE "account_transfers"
  ADD COLUMN "credit_card_invoice_id" UUID;

CREATE UNIQUE INDEX "credit_cards_id_financial_space_id_key"
  ON "credit_cards"("id", "financial_space_id");
CREATE UNIQUE INDEX "credit_cards_account_space_key"
  ON "credit_cards"("account_id", "financial_space_id");
CREATE INDEX "credit_cards_financial_space_id_deleted_at_idx"
  ON "credit_cards"("financial_space_id", "deleted_at");

CREATE UNIQUE INDEX "credit_card_invoices_id_financial_space_id_key"
  ON "credit_card_invoices"("id", "financial_space_id");
CREATE UNIQUE INDEX "credit_card_invoices_card_closing_date_key"
  ON "credit_card_invoices"("credit_card_id", "closing_date");
CREATE INDEX "credit_card_invoices_financial_space_id_status_due_date_idx"
  ON "credit_card_invoices"("financial_space_id", "status", "due_date");
CREATE INDEX "credit_card_invoices_credit_card_id_due_date_idx"
  ON "credit_card_invoices"("credit_card_id", "due_date");

CREATE INDEX "financial_transactions_financial_space_id_credit_card_invoi_idx"
  ON "financial_transactions"("financial_space_id", "credit_card_invoice_id");
CREATE UNIQUE INDEX "account_transfers_invoice_space_key"
  ON "account_transfers"("credit_card_invoice_id", "financial_space_id");

ALTER TABLE "credit_cards"
  ADD CONSTRAINT "credit_cards_financial_space_id_fkey"
  FOREIGN KEY ("financial_space_id") REFERENCES "financial_spaces"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "credit_cards_account_space_fkey"
  FOREIGN KEY ("account_id", "financial_space_id")
  REFERENCES "accounts"("id", "financial_space_id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "credit_cards_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "credit_card_invoices"
  ADD CONSTRAINT "credit_card_invoices_financial_space_id_fkey"
  FOREIGN KEY ("financial_space_id") REFERENCES "financial_spaces"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "credit_card_invoices_card_space_fkey"
  FOREIGN KEY ("credit_card_id", "financial_space_id")
  REFERENCES "credit_cards"("id", "financial_space_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "financial_transactions"
  ADD CONSTRAINT "financial_transactions_invoice_space_fkey"
  FOREIGN KEY ("credit_card_invoice_id", "financial_space_id")
  REFERENCES "credit_card_invoices"("id", "financial_space_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "account_transfers"
  ADD CONSTRAINT "account_transfers_invoice_space_fkey"
  FOREIGN KEY ("credit_card_invoice_id", "financial_space_id")
  REFERENCES "credit_card_invoices"("id", "financial_space_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- CREDIT_CARD accounts have a stricter shape than ordinary accounts. This
-- trigger also closes the gap left by Account.holderMember's legacy
-- single-column foreign key.
CREATE FUNCTION "validate_credit_card_account_shape"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  has_active_card BOOLEAN;
  space_currency CHAR(3);
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM "credit_cards" AS card
    WHERE card."account_id" = NEW."id"
      AND card."deleted_at" IS NULL
  ) INTO has_active_card;

  IF has_active_card AND (
    NEW."type"::text <> 'CREDIT_CARD'
    OR NEW."deleted_at" IS NOT NULL
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT = 'accounts_active_credit_card_check',
      MESSAGE = 'An active credit-card account cannot be archived, retyped, or moved';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF has_active_card
      AND NEW."financial_space_id" IS DISTINCT FROM OLD."financial_space_id"
    THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        CONSTRAINT = 'accounts_active_credit_card_check',
        MESSAGE = 'An active credit-card account cannot be archived, retyped, or moved';
    END IF;
  END IF;

  IF NEW."type"::text = 'CREDIT_CARD' OR has_active_card THEN
    SELECT space."currency"
      INTO space_currency
    FROM "financial_spaces" AS space
    WHERE space."id" = NEW."financial_space_id"
      AND space."deleted_at" IS NULL
    FOR SHARE;

    IF space_currency IS NULL
      OR NEW."ownership"::text <> 'INDIVIDUAL'
      OR NEW."holder_member_id" IS NULL
      OR NEW."opening_balance" <> 0
      OR NEW."currency" <> space_currency
      OR NOT EXISTS (
        SELECT 1
        FROM "space_members" AS member
        WHERE member."id" = NEW."holder_member_id"
          AND member."financial_space_id" = NEW."financial_space_id"
      )
    THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        CONSTRAINT = 'accounts_credit_card_shape_check',
        MESSAGE = 'Credit-card account must be individual, have a same-space holder, zero opening balance, and use the space currency';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM "financial_transactions" AS purchase
      WHERE purchase."account_id" = NEW."id"
        AND purchase."deleted_at" IS NULL
        AND purchase."credit_card_invoice_id" IS NULL
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        CONSTRAINT = 'accounts_credit_card_transactions_check',
        MESSAGE = 'An account with unlinked transactions cannot become a credit-card account';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "accounts_credit_card_shape_trigger"
BEFORE INSERT OR UPDATE
ON "accounts"
FOR EACH ROW
EXECUTE FUNCTION "validate_credit_card_account_shape"();

-- Changing the space currency would silently invalidate every active card
-- account. Currency migration must therefore happen only after cards are
-- archived and handled explicitly.
CREATE FUNCTION "protect_credit_card_space_currency"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."currency" IS DISTINCT FROM OLD."currency"
    AND EXISTS (
      SELECT 1
      FROM "credit_cards" AS card
      WHERE card."financial_space_id" = OLD."id"
        AND card."deleted_at" IS NULL
    )
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT = 'financial_spaces_active_credit_card_currency_check',
      MESSAGE = 'Archive active credit cards before changing the financial-space currency';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "financial_spaces_credit_card_currency_trigger"
BEFORE UPDATE OF "currency"
ON "financial_spaces"
FOR EACH ROW
EXECUTE FUNCTION "protect_credit_card_space_currency"();

-- A card wraps exactly one active account with the strict account shape. Card
-- archival is refused while an OPEN/CLOSED invoice still represents a payable.
CREATE FUNCTION "assert_credit_card_account"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  account_details RECORD;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW."id" IS DISTINCT FROM OLD."id"
      OR NEW."financial_space_id" IS DISTINCT FROM OLD."financial_space_id"
      OR NEW."account_id" IS DISTINCT FROM OLD."account_id"
    THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        CONSTRAINT = 'credit_cards_identity_immutable_check',
        MESSAGE = 'Credit-card id, financial space, and ledger account are immutable';
    END IF;
  END IF;

  SELECT
    account."type"::text AS account_type,
    account."ownership"::text AS account_ownership,
    account."holder_member_id" AS holder_member_id,
    account."opening_balance" AS opening_balance,
    account."currency" AS account_currency,
    account."deleted_at" AS account_deleted_at,
    space."currency" AS space_currency
  INTO account_details
  FROM "accounts" AS account
  JOIN "financial_spaces" AS space
    ON space."id" = account."financial_space_id"
  WHERE account."id" = NEW."account_id"
    AND account."financial_space_id" = NEW."financial_space_id"
    AND space."deleted_at" IS NULL
  FOR SHARE OF account, space;

  IF NOT FOUND
    OR account_details.account_type <> 'CREDIT_CARD'
    OR account_details.account_ownership <> 'INDIVIDUAL'
    OR account_details.holder_member_id IS NULL
    OR account_details.opening_balance <> 0
    OR account_details.account_currency <> account_details.space_currency
    OR account_details.account_deleted_at IS NOT NULL
    OR NOT EXISTS (
      SELECT 1
      FROM "space_members" AS member
      WHERE member."id" = account_details.holder_member_id
        AND member."financial_space_id" = NEW."financial_space_id"
    )
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT = 'credit_cards_account_shape_check',
      MESSAGE = 'Credit card must reference an active, individual CREDIT_CARD account with a same-space holder, zero opening balance, and the space currency';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "financial_transactions" AS purchase
    WHERE purchase."account_id" = NEW."account_id"
      AND purchase."deleted_at" IS NULL
      AND purchase."credit_card_invoice_id" IS NULL
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT = 'credit_cards_unlinked_transactions_check',
      MESSAGE = 'Credit-card account cannot contain transactions outside an invoice';
  END IF;

  IF TG_OP = 'INSERT' AND NEW."deleted_at" IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT = 'credit_cards_active_on_create_check',
      MESSAGE = 'A credit card must be active when created';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD."deleted_at" IS NULL AND NEW."deleted_at" IS NOT NULL THEN
      -- Invoice creation takes a SHARE lock on the card, while this UPDATE owns
      -- the card row lock. Locking invoices here also serializes with payment.
      PERFORM invoice."id"
      FROM "credit_card_invoices" AS invoice
      WHERE invoice."credit_card_id" = OLD."id"
        AND invoice."financial_space_id" = OLD."financial_space_id"
      ORDER BY invoice."id"
      FOR UPDATE;

      IF EXISTS (
        SELECT 1
        FROM "credit_card_invoices" AS invoice
        WHERE invoice."credit_card_id" = OLD."id"
          AND invoice."financial_space_id" = OLD."financial_space_id"
          AND invoice."status" <> 'PAID'
      ) THEN
        RAISE EXCEPTION USING
          ERRCODE = '23514',
          CONSTRAINT = 'credit_cards_unpaid_invoices_check',
          MESSAGE = 'A credit card with an open or closed invoice cannot be archived';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "credit_cards_account_shape_trigger"
BEFORE INSERT OR UPDATE
ON "credit_cards"
FOR EACH ROW
EXECUTE FUNCTION "assert_credit_card_account"();

-- New invoices must belong to a currently active card. The SHARE lock makes
-- invoice creation and card archival mutually exclusive.
CREATE FUNCTION "assert_invoice_active_card"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM card."id"
  FROM "credit_cards" AS card
  WHERE card."id" = NEW."credit_card_id"
    AND card."financial_space_id" = NEW."financial_space_id"
    AND card."deleted_at" IS NULL
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT = 'credit_card_invoices_active_card_check',
      MESSAGE = 'Invoice must reference an active card in the same financial space';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "credit_card_invoices_active_card_trigger"
BEFORE INSERT OR UPDATE OF "credit_card_id", "financial_space_id"
ON "credit_card_invoices"
FOR EACH ROW
EXECUTE FUNCTION "assert_invoice_active_card"();

-- A linked purchase is immutable once its invoice leaves OPEN. Locking every
-- old/new invoice in UUID order prevents both close-vs-purchase races and
-- deadlocks when a purchase moves between two open invoices.
CREATE FUNCTION "assert_credit_card_purchase"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  old_invoice_id UUID;
  old_space_id UUID;
  new_invoice_id UUID;
  new_space_id UUID;
  old_invoice_status "CreditCardInvoiceStatus";
  new_invoice_status "CreditCardInvoiceStatus";
  invoice_account_id UUID;
  transaction_account_type TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    old_invoice_id := OLD."credit_card_invoice_id";
    old_space_id := OLD."financial_space_id";
  END IF;
  IF TG_OP <> 'DELETE' THEN
    new_invoice_id := NEW."credit_card_invoice_id";
    new_space_id := NEW."financial_space_id";
  END IF;

  PERFORM invoice."id"
  FROM "credit_card_invoices" AS invoice
  WHERE (old_invoice_id IS NOT NULL
      AND invoice."id" = old_invoice_id
      AND invoice."financial_space_id" = old_space_id)
     OR (new_invoice_id IS NOT NULL
      AND invoice."id" = new_invoice_id
      AND invoice."financial_space_id" = new_space_id)
  ORDER BY invoice."id", invoice."financial_space_id"
  FOR UPDATE;

  IF old_invoice_id IS NOT NULL THEN
    SELECT invoice."status"
      INTO old_invoice_status
    FROM "credit_card_invoices" AS invoice
    WHERE invoice."id" = old_invoice_id
      AND invoice."financial_space_id" = old_space_id;

    IF old_invoice_status IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23503',
        CONSTRAINT = 'financial_transactions_invoice_space_fkey',
        MESSAGE = 'Previous credit-card invoice no longer exists';
    END IF;

    IF old_invoice_status <> 'OPEN' THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        CONSTRAINT = 'financial_transactions_closed_invoice_immutable_check',
        MESSAGE = 'A purchase on a closed or paid invoice cannot be updated or deleted';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  SELECT account."type"::text
    INTO transaction_account_type
  FROM "accounts" AS account
  WHERE account."id" = NEW."account_id"
  FOR SHARE;

  IF transaction_account_type = 'CREDIT_CARD'
    AND new_invoice_id IS NULL
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT = 'financial_transactions_credit_card_invoice_required_check',
      MESSAGE = 'Every transaction on a credit-card account must belong to an invoice';
  END IF;

  IF new_invoice_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT invoice."status", card."account_id"
    INTO new_invoice_status, invoice_account_id
  FROM "credit_card_invoices" AS invoice
  JOIN "credit_cards" AS card
    ON card."id" = invoice."credit_card_id"
   AND card."financial_space_id" = invoice."financial_space_id"
  WHERE invoice."id" = new_invoice_id
    AND invoice."financial_space_id" = new_space_id
    AND card."deleted_at" IS NULL;

  IF new_invoice_status IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      CONSTRAINT = 'financial_transactions_invoice_space_fkey',
      MESSAGE = 'Credit-card invoice does not exist or its card is archived';
  END IF;

  IF new_invoice_status <> 'OPEN'
    OR NEW."type" <> 'EXPENSE'
    OR NEW."status" <> 'PAID'
    OR NEW."deleted_at" IS NOT NULL
    OR invoice_account_id <> NEW."account_id"
    OR transaction_account_type <> 'CREDIT_CARD'
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT = 'financial_transactions_invoice_purchase_shape_check',
      MESSAGE = 'Invoice purchase must be active, EXPENSE, PAID, on the card account, and belong to an open invoice';
  END IF;

  PERFORM category."id"
  FROM "categories" AS category
  WHERE category."id" = NEW."category_id"
    AND category."financial_space_id" = NEW."financial_space_id"
    AND category."type"::text = 'EXPENSE'
    AND category."deleted_at" IS NULL
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT = 'financial_transactions_invoice_category_space_check',
      MESSAGE = 'Invoice purchase must use an active expense category from the same financial space';
  END IF;

  IF NEW."payer_member_id" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM "space_members" AS member
      WHERE member."id" = NEW."payer_member_id"
        AND member."financial_space_id" = NEW."financial_space_id"
    )
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT = 'financial_transactions_invoice_payer_space_check',
      MESSAGE = 'Invoice purchase payer must belong to the same financial space';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "financial_transactions_invoice_consistency_trigger"
BEFORE INSERT OR UPDATE OR DELETE
ON "financial_transactions"
FOR EACH ROW
EXECUTE FUNCTION "assert_credit_card_purchase"();

-- Invoice identity and cycle dates are immutable. State can only advance from
-- OPEN to CLOSED and then from CLOSED to PAID. The PAID transition observes
-- the payment created earlier in the same database transaction.
CREATE FUNCTION "enforce_credit_card_invoice_transition"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  active_payment_count INTEGER;
  active_purchase_count INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."status" <> 'OPEN'
      OR NEW."closed_at" IS NOT NULL
      OR NEW."paid_at" IS NOT NULL
    THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        CONSTRAINT = 'credit_card_invoices_initial_state_check',
        MESSAGE = 'A new invoice must start OPEN without close or payment timestamps';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."financial_space_id" IS DISTINCT FROM OLD."financial_space_id"
    OR NEW."credit_card_id" IS DISTINCT FROM OLD."credit_card_id"
    OR NEW."closing_date" IS DISTINCT FROM OLD."closing_date"
    OR NEW."due_date" IS DISTINCT FROM OLD."due_date"
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT = 'credit_card_invoices_cycle_immutable_check',
      MESSAGE = 'Invoice card and cycle dates are immutable';
  END IF;

  IF NEW."status" = OLD."status" THEN
    IF NEW."closed_at" IS DISTINCT FROM OLD."closed_at"
      OR NEW."paid_at" IS DISTINCT FROM OLD."paid_at"
    THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        CONSTRAINT = 'credit_card_invoices_timestamps_immutable_check',
        MESSAGE = 'Invoice state timestamps can only be set during their matching transition';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD."status" = 'OPEN' AND NEW."status" = 'CLOSED' THEN
    IF NEW."closed_at" IS NULL OR NEW."paid_at" IS NOT NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        CONSTRAINT = 'credit_card_invoices_close_transition_check',
        MESSAGE = 'Closing an invoice requires closed_at and cannot set paid_at';
    END IF;

    SELECT COUNT(*)
      INTO active_purchase_count
    FROM "financial_transactions" AS purchase
    WHERE purchase."credit_card_invoice_id" = NEW."id"
      AND purchase."financial_space_id" = NEW."financial_space_id"
      AND purchase."type" = 'EXPENSE'
      AND purchase."status" = 'PAID'
      AND purchase."deleted_at" IS NULL;

    IF active_purchase_count = 0 THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        CONSTRAINT = 'credit_card_invoices_close_purchase_check',
        MESSAGE = 'An invoice must contain at least one valid purchase before closing';
    END IF;

    RETURN NEW;
  END IF;

  IF OLD."status" = 'CLOSED' AND NEW."status" = 'PAID' THEN
    IF NEW."closed_at" IS DISTINCT FROM OLD."closed_at"
      OR NEW."paid_at" IS NULL
    THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        CONSTRAINT = 'credit_card_invoices_paid_transition_check',
        MESSAGE = 'Paying an invoice preserves closed_at and requires paid_at';
    END IF;

    SELECT COUNT(*)
      INTO active_payment_count
    FROM "account_transfers" AS payment
    WHERE payment."credit_card_invoice_id" = NEW."id"
      AND payment."financial_space_id" = NEW."financial_space_id"
      AND payment."deleted_at" IS NULL;

    IF active_payment_count <> 1 THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        CONSTRAINT = 'credit_card_invoices_active_payment_check',
        MESSAGE = 'A paid invoice must have exactly one active payment transfer';
    END IF;

    RETURN NEW;
  END IF;

  RAISE EXCEPTION USING
    ERRCODE = '23514',
    CONSTRAINT = 'credit_card_invoices_state_transition_check',
    MESSAGE = 'Invoice state can only advance from OPEN to CLOSED to PAID';
END;
$$;

CREATE TRIGGER "credit_card_invoices_state_transition_trigger"
BEFORE INSERT OR UPDATE
ON "credit_card_invoices"
FOR EACH ROW
EXECUTE FUNCTION "enforce_credit_card_invoice_transition"();

-- Invoice payment is an immutable transfer from an active, non-card account
-- into the invoice card account. Taking the invoice row lock serializes two
-- concurrent payment attempts and keeps the summed purchase total stable.
CREATE FUNCTION "assert_credit_card_invoice_payment"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  invoice_account_id UUID;
  invoice_closing_date DATE;
  invoice_status "CreditCardInvoiceStatus";
  invoice_total DECIMAL(19,4);
  source_details RECORD;
  destination_details RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."credit_card_invoice_id" IS NOT NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        CONSTRAINT = 'account_transfers_invoice_payment_immutable_check',
        MESSAGE = 'An invoice payment transfer cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD."credit_card_invoice_id" IS NOT NULL
      OR NEW."credit_card_invoice_id" IS NOT NULL
    THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        CONSTRAINT = 'account_transfers_invoice_payment_immutable_check',
        MESSAGE = 'An invoice payment transfer cannot be attached or mutated by update';
    END IF;
  END IF;

  -- Keep account locks deterministic for ordinary transfers too.
  PERFORM account."id"
  FROM "accounts" AS account
  WHERE account."id" IN (NEW."source_account_id", NEW."destination_account_id")
  ORDER BY account."id"
  FOR SHARE;

  SELECT
    source."type"::text AS account_type,
    source."currency" AS currency,
    source."deleted_at" AS deleted_at
  INTO source_details
  FROM "accounts" AS source
  WHERE source."id" = NEW."source_account_id"
    AND source."financial_space_id" = NEW."financial_space_id";

  SELECT
    destination."type"::text AS account_type,
    destination."currency" AS currency,
    destination."deleted_at" AS deleted_at
  INTO destination_details
  FROM "accounts" AS destination
  WHERE destination."id" = NEW."destination_account_id"
    AND destination."financial_space_id" = NEW."financial_space_id";

  IF NEW."credit_card_invoice_id" IS NULL THEN
    IF source_details.account_type = 'CREDIT_CARD'
      OR destination_details.account_type = 'CREDIT_CARD'
    THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        CONSTRAINT = 'account_transfers_credit_card_invoice_required_check',
        MESSAGE = 'Every transfer touching a credit-card account must be an invoice payment';
    END IF;
    RETURN NEW;
  END IF;

  SELECT card."account_id", invoice."closing_date", invoice."status"
    INTO invoice_account_id, invoice_closing_date, invoice_status
  FROM "credit_card_invoices" AS invoice
  JOIN "credit_cards" AS card
    ON card."id" = invoice."credit_card_id"
   AND card."financial_space_id" = invoice."financial_space_id"
  WHERE invoice."id" = NEW."credit_card_invoice_id"
    AND invoice."financial_space_id" = NEW."financial_space_id"
    AND card."deleted_at" IS NULL
  FOR UPDATE OF invoice;

  IF invoice_account_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      CONSTRAINT = 'account_transfers_invoice_space_fkey',
      MESSAGE = 'Credit-card invoice does not exist or its card is archived';
  END IF;

  IF invoice_status <> 'CLOSED' THEN
    -- The unique relation is the idempotency contract. Raising 23505 with its
    -- constraint name lets Prisma surface P2002 for the losing concurrent pay.
    IF EXISTS (
      SELECT 1
      FROM "account_transfers" AS existing_payment
      WHERE existing_payment."credit_card_invoice_id" = NEW."credit_card_invoice_id"
        AND existing_payment."financial_space_id" = NEW."financial_space_id"
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23505',
        CONSTRAINT = 'account_transfers_invoice_space_key',
        TABLE = 'account_transfers',
        MESSAGE = 'duplicate key value violates unique constraint account_transfers_invoice_space_key';
    END IF;

    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT = 'account_transfers_closed_invoice_check',
      MESSAGE = 'Invoice payment can only be inserted while the invoice is CLOSED';
  END IF;

  IF NEW."deleted_at" IS NOT NULL
    OR source_details.account_type IS NULL
    OR source_details.account_type = 'CREDIT_CARD'
    OR source_details.deleted_at IS NOT NULL
    OR destination_details.account_type <> 'CREDIT_CARD'
    OR destination_details.deleted_at IS NOT NULL
    OR invoice_account_id <> NEW."destination_account_id"
    OR source_details.currency <> destination_details.currency
    OR NEW."transfer_date" < invoice_closing_date
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT = 'account_transfers_invoice_payment_shape_check',
      MESSAGE = 'Invoice payment must be active, use a same-currency non-card source, target the card account, and occur after closing';
  END IF;

  SELECT COALESCE(SUM(purchase."amount"), 0)
    INTO invoice_total
  FROM "financial_transactions" AS purchase
  WHERE purchase."credit_card_invoice_id" = NEW."credit_card_invoice_id"
    AND purchase."financial_space_id" = NEW."financial_space_id"
    AND purchase."type" = 'EXPENSE'
    AND purchase."status" = 'PAID'
    AND purchase."deleted_at" IS NULL
    AND purchase."account_id" = invoice_account_id;

  IF invoice_total <= 0 OR NEW."amount" <> invoice_total THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT = 'account_transfers_invoice_total_check',
      MESSAGE = 'Invoice payment amount must exactly equal the valid purchase total';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "account_transfers_invoice_consistency_trigger"
BEFORE INSERT OR UPDATE OR DELETE
ON "account_transfers"
FOR EACH ROW
EXECUTE FUNCTION "assert_credit_card_invoice_payment"();

-- Validate the bidirectional final-state invariant at COMMIT. This permits the
-- intended atomic sequence CLOSED -> insert transfer -> PAID, while rejecting
-- either half if the application transaction stops early.
CREATE FUNCTION "enforce_invoice_payment_final_state"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_invoice_id UUID;
  target_space_id UUID;
  final_invoice_status "CreditCardInvoiceStatus";
  active_payment_count INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'credit_card_invoices' THEN
    IF TG_OP = 'DELETE' THEN
      target_invoice_id := OLD."id";
      target_space_id := OLD."financial_space_id";
    ELSE
      target_invoice_id := NEW."id";
      target_space_id := NEW."financial_space_id";
    END IF;
  ELSE
    IF TG_OP = 'DELETE' THEN
      target_invoice_id := OLD."credit_card_invoice_id";
      target_space_id := OLD."financial_space_id";
    ELSE
      target_invoice_id := NEW."credit_card_invoice_id";
      target_space_id := NEW."financial_space_id";
    END IF;
  END IF;

  IF target_invoice_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT invoice."status"
    INTO final_invoice_status
  FROM "credit_card_invoices" AS invoice
  WHERE invoice."id" = target_invoice_id
    AND invoice."financial_space_id" = target_space_id;

  IF final_invoice_status IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*)
    INTO active_payment_count
  FROM "account_transfers" AS payment
  WHERE payment."credit_card_invoice_id" = target_invoice_id
    AND payment."financial_space_id" = target_space_id
    AND payment."deleted_at" IS NULL;

  IF (final_invoice_status = 'PAID' AND active_payment_count <> 1)
    OR (final_invoice_status <> 'PAID' AND active_payment_count <> 0)
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT = 'credit_card_invoices_payment_final_state_check',
      MESSAGE = 'At commit, PAID must be equivalent to exactly one active invoice payment';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "credit_card_invoices_payment_final_state_trigger"
AFTER INSERT OR UPDATE OR DELETE
ON "credit_card_invoices"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "enforce_invoice_payment_final_state"();

CREATE CONSTRAINT TRIGGER "account_transfers_invoice_final_state_trigger"
AFTER INSERT OR UPDATE OR DELETE
ON "account_transfers"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "enforce_invoice_payment_final_state"();

COMMIT;
