-- Keep account ownership of a transfer inside the same financial space,
-- even for writes performed outside the application.
ALTER TABLE "accounts"
  ADD CONSTRAINT "accounts_id_financial_space_id_key"
  UNIQUE ("id", "financial_space_id");

ALTER TABLE "account_transfers"
  DROP CONSTRAINT "account_transfers_source_account_id_fkey",
  DROP CONSTRAINT "account_transfers_destination_account_id_fkey";

ALTER TABLE "account_transfers"
  ADD CONSTRAINT "account_transfers_source_account_space_fkey"
  FOREIGN KEY ("source_account_id", "financial_space_id")
  REFERENCES "accounts"("id", "financial_space_id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "account_transfers_destination_account_space_fkey"
  FOREIGN KEY ("destination_account_id", "financial_space_id")
  REFERENCES "accounts"("id", "financial_space_id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "account_transfers_cent_precision_check"
  CHECK ("amount" = ROUND("amount", 2));
