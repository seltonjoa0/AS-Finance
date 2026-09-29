-- Transfers move money between accounts without creating income or expense.
CREATE TABLE "account_transfers" (
    "id" UUID NOT NULL,
    "financial_space_id" UUID NOT NULL,
    "source_account_id" UUID NOT NULL,
    "destination_account_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "transfer_date" DATE NOT NULL,
    "description" VARCHAR(160),
    "notes" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "account_transfers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "account_transfers_amount_check" CHECK ("amount" > 0),
    CONSTRAINT "account_transfers_distinct_accounts_check" CHECK (
      "source_account_id" <> "destination_account_id"
    )
);

CREATE INDEX "account_transfers_financial_space_id_transfer_date_idx"
  ON "account_transfers"("financial_space_id", "transfer_date");
CREATE INDEX "account_transfers_source_account_id_transfer_date_idx"
  ON "account_transfers"("source_account_id", "transfer_date");
CREATE INDEX "account_transfers_destination_account_id_transfer_date_idx"
  ON "account_transfers"("destination_account_id", "transfer_date");

ALTER TABLE "account_transfers"
  ADD CONSTRAINT "account_transfers_financial_space_id_fkey"
  FOREIGN KEY ("financial_space_id") REFERENCES "financial_spaces"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "account_transfers"
  ADD CONSTRAINT "account_transfers_source_account_id_fkey"
  FOREIGN KEY ("source_account_id") REFERENCES "accounts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "account_transfers"
  ADD CONSTRAINT "account_transfers_destination_account_id_fkey"
  FOREIGN KEY ("destination_account_id") REFERENCES "accounts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "account_transfers"
  ADD CONSTRAINT "account_transfers_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
