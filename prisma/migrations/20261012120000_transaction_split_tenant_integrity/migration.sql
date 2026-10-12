-- A split must belong to the same financial space as both its transaction and
-- its member. The former single-column foreign keys guaranteed existence, but
-- did not prevent cross-tenant references when writes bypassed the application.

BEGIN;

ALTER TABLE "financial_transactions"
  ADD CONSTRAINT "financial_transactions_id_financial_space_id_key"
  UNIQUE ("id", "financial_space_id");

ALTER TABLE "transaction_splits"
  DROP CONSTRAINT "transaction_splits_transaction_id_fkey",
  DROP CONSTRAINT "transaction_splits_member_id_fkey";

ALTER TABLE "transaction_splits"
  ADD CONSTRAINT "transaction_splits_transaction_space_fkey"
  FOREIGN KEY ("transaction_id", "financial_space_id")
  REFERENCES "financial_transactions"("id", "financial_space_id")
  ON DELETE CASCADE
  ON UPDATE CASCADE,
  ADD CONSTRAINT "transaction_splits_member_space_fkey"
  FOREIGN KEY ("member_id", "financial_space_id")
  REFERENCES "space_members"("id", "financial_space_id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

COMMIT;
