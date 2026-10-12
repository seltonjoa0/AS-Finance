-- Immutable income history used to calculate proportional expense splits.
ALTER TABLE "space_members"
  ADD CONSTRAINT "space_members_id_financial_space_id_key"
  UNIQUE ("id", "financial_space_id");

CREATE TABLE "member_incomes" (
    "id" UUID NOT NULL,
    "financial_space_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "effective_from" DATE NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_incomes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "member_incomes_amount_check" CHECK ("amount" >= 0),
    CONSTRAINT "member_incomes_cent_precision_check" CHECK ("amount" = ROUND("amount", 2))
);

CREATE UNIQUE INDEX "member_incomes_space_member_effective_key"
  ON "member_incomes"("financial_space_id", "member_id", "effective_from");
CREATE INDEX "member_incomes_financial_space_id_effective_from_idx"
  ON "member_incomes"("financial_space_id", "effective_from");
CREATE INDEX "member_incomes_member_id_effective_from_idx"
  ON "member_incomes"("member_id", "effective_from");

ALTER TABLE "member_incomes"
  ADD CONSTRAINT "member_incomes_financial_space_id_fkey"
  FOREIGN KEY ("financial_space_id") REFERENCES "financial_spaces"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "member_incomes_member_space_fkey"
  FOREIGN KEY ("member_id", "financial_space_id")
  REFERENCES "space_members"("id", "financial_space_id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "member_incomes_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Income-based splits preserve every participant, including explicit 0% shares.
ALTER TABLE "transaction_splits"
  DROP CONSTRAINT "transaction_splits_amount_check",
  DROP CONSTRAINT "transaction_splits_percentage_check",
  ADD CONSTRAINT "transaction_splits_amount_check" CHECK ("amount" >= 0),
  ADD CONSTRAINT "transaction_splits_percentage_check" CHECK (
    "percentage" IS NULL OR ("percentage" >= 0 AND "percentage" <= 100)
  ),
  ADD CONSTRAINT "transaction_splits_cent_precision_check"
  CHECK ("amount" = ROUND("amount", 2));
