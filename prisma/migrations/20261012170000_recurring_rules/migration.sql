-- Monthly recurrence rules and their reusable split snapshots.
BEGIN;

CREATE TYPE "RecurrenceFrequency" AS ENUM ('MONTHLY');
CREATE TYPE "RecurringRuleState" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');

-- Required by the tenant-aware recurring rule/category foreign key.
ALTER TABLE "categories"
  ADD CONSTRAINT "categories_id_financial_space_id_key"
  UNIQUE ("id", "financial_space_id");

CREATE TABLE "recurring_rules" (
    "id" UUID NOT NULL,
    "financial_space_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "payer_member_id" UUID,
    "created_by" UUID NOT NULL,
    "type" "TransactionType" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "split_method" "SplitMethod" NOT NULL DEFAULT 'INDIVIDUAL',
    "frequency" "RecurrenceFrequency" NOT NULL DEFAULT 'MONTHLY',
    "state" "RecurringRuleState" NOT NULL DEFAULT 'ACTIVE',
    "description" VARCHAR(160) NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "day_of_month" INTEGER NOT NULL,
    "next_occurrence" DATE,
    "notes" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "recurring_rules_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "recurring_rules_amount_check" CHECK ("amount" > 0),
    CONSTRAINT "recurring_rules_cent_precision_check" CHECK ("amount" = ROUND("amount", 2)),
    CONSTRAINT "recurring_rules_pending_status_check" CHECK ("status" = 'PENDING'),
    CONSTRAINT "recurring_rules_income_shape_check" CHECK (
      "type" = 'EXPENSE'
      OR ("payer_member_id" IS NULL AND "split_method" = 'INDIVIDUAL')
    ),
    CONSTRAINT "recurring_rules_day_of_month_check" CHECK ("day_of_month" BETWEEN 1 AND 31),
    CONSTRAINT "recurring_rules_date_range_check" CHECK (
      "end_date" IS NULL OR "end_date" >= "start_date"
    ),
    CONSTRAINT "recurring_rules_state_next_occurrence_check" CHECK (
      ("state" = 'ENDED' AND "next_occurrence" IS NULL)
      OR ("state" IN ('ACTIVE', 'PAUSED') AND "next_occurrence" IS NOT NULL)
    ),
    CONSTRAINT "recurring_rules_next_occurrence_range_check" CHECK (
      "next_occurrence" IS NULL
      OR (
        "next_occurrence" >= "start_date"
        AND ("end_date" IS NULL OR "next_occurrence" <= "end_date")
      )
    )
);

CREATE TABLE "recurring_rule_splits" (
    "id" UUID NOT NULL,
    "financial_space_id" UUID NOT NULL,
    "recurring_rule_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "percentage" DECIMAL(7,4),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_rule_splits_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "recurring_rule_splits_amount_check" CHECK ("amount" >= 0),
    CONSTRAINT "recurring_rule_splits_cent_precision_check" CHECK ("amount" = ROUND("amount", 2)),
    CONSTRAINT "recurring_rule_splits_percentage_check" CHECK (
      "percentage" IS NULL OR ("percentage" >= 0 AND "percentage" <= 100)
    )
);

CREATE UNIQUE INDEX "recurring_rules_id_financial_space_id_key"
  ON "recurring_rules"("id", "financial_space_id");
CREATE INDEX "recurring_rules_financial_space_id_state_next_occurrence_idx"
  ON "recurring_rules"("financial_space_id", "state", "next_occurrence");
CREATE INDEX "recurring_rules_financial_space_id_deleted_at_idx"
  ON "recurring_rules"("financial_space_id", "deleted_at");
CREATE INDEX "recurring_rules_account_id_idx"
  ON "recurring_rules"("account_id");
CREATE INDEX "recurring_rules_category_id_idx"
  ON "recurring_rules"("category_id");

CREATE UNIQUE INDEX "recurring_rule_splits_rule_member_key"
  ON "recurring_rule_splits"("recurring_rule_id", "member_id");
CREATE INDEX "recurring_rule_splits_financial_space_id_member_id_idx"
  ON "recurring_rule_splits"("financial_space_id", "member_id");

ALTER TABLE "recurring_rules"
  ADD CONSTRAINT "recurring_rules_financial_space_id_fkey"
  FOREIGN KEY ("financial_space_id") REFERENCES "financial_spaces"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "recurring_rules_account_space_fkey"
  FOREIGN KEY ("account_id", "financial_space_id")
  REFERENCES "accounts"("id", "financial_space_id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "recurring_rules_category_space_fkey"
  FOREIGN KEY ("category_id", "financial_space_id")
  REFERENCES "categories"("id", "financial_space_id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "recurring_rules_payer_space_fkey"
  FOREIGN KEY ("payer_member_id", "financial_space_id")
  REFERENCES "space_members"("id", "financial_space_id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "recurring_rules_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recurring_rule_splits"
  ADD CONSTRAINT "recurring_rule_splits_financial_space_id_fkey"
  FOREIGN KEY ("financial_space_id") REFERENCES "financial_spaces"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "recurring_rule_splits_rule_space_fkey"
  FOREIGN KEY ("recurring_rule_id", "financial_space_id")
  REFERENCES "recurring_rules"("id", "financial_space_id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "recurring_rule_splits_member_space_fkey"
  FOREIGN KEY ("member_id", "financial_space_id")
  REFERENCES "space_members"("id", "financial_space_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Generated transactions retain the rule and occurrence that produced them.
-- The pair constraint prevents partially linked records, while the unique
-- index makes materialization idempotent for each monthly competence.
ALTER TABLE "financial_transactions"
  ADD COLUMN "recurring_rule_id" UUID,
  ADD COLUMN "occurrence_date" DATE,
  ADD CONSTRAINT "financial_transactions_recurring_occurrence_pair_check" CHECK (
    ("recurring_rule_id" IS NULL AND "occurrence_date" IS NULL)
    OR ("recurring_rule_id" IS NOT NULL AND "occurrence_date" IS NOT NULL)
  );

CREATE UNIQUE INDEX "financial_transactions_recurring_rule_occurrence_key"
  ON "financial_transactions"("recurring_rule_id", "occurrence_date");
CREATE INDEX "financial_transactions_financial_space_id_occurrence_date_idx"
  ON "financial_transactions"("financial_space_id", "occurrence_date");

ALTER TABLE "financial_transactions"
  ADD CONSTRAINT "financial_transactions_recurring_rule_space_fkey"
  FOREIGN KEY ("recurring_rule_id", "financial_space_id")
  REFERENCES "recurring_rules"("id", "financial_space_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
