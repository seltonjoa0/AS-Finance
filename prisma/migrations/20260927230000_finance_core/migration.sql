-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CHECKING', 'SAVINGS', 'CASH', 'INVESTMENT', 'OTHER');
CREATE TYPE "AccountOwnership" AS ENUM ('INDIVIDUAL', 'SHARED');
CREATE TYPE "CategoryType" AS ENUM ('INCOME', 'EXPENSE');
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE');
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'PAID');
CREATE TYPE "SplitMethod" AS ENUM ('INDIVIDUAL', 'EQUAL', 'PERCENTAGE', 'CUSTOM', 'INCOME_BASED');

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "financial_space_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "type" "AccountType" NOT NULL,
    "ownership" "AccountOwnership" NOT NULL DEFAULT 'INDIVIDUAL',
    "holder_member_id" UUID,
    "opening_balance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "accounts_holder_check" CHECK (
      ("ownership" = 'SHARED' AND "holder_member_id" IS NULL)
      OR ("ownership" = 'INDIVIDUAL' AND "holder_member_id" IS NOT NULL)
    )
);

CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "financial_space_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "type" "CategoryType" NOT NULL,
    "color" VARCHAR(7),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "financial_transactions" (
    "id" UUID NOT NULL,
    "financial_space_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "payer_member_id" UUID,
    "created_by" UUID NOT NULL,
    "type" "TransactionType" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PAID',
    "split_method" "SplitMethod" NOT NULL DEFAULT 'INDIVIDUAL',
    "description" VARCHAR(160) NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "competence_date" DATE NOT NULL,
    "due_date" DATE,
    "paid_at" TIMESTAMPTZ(3),
    "notes" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "financial_transactions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "financial_transactions_amount_check" CHECK ("amount" > 0),
    CONSTRAINT "financial_transactions_paid_at_check" CHECK (
      ("status" = 'PAID' AND "paid_at" IS NOT NULL)
      OR ("status" = 'PENDING' AND "paid_at" IS NULL)
    )
);

CREATE TABLE "transaction_splits" (
    "id" UUID NOT NULL,
    "financial_space_id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "percentage" DECIMAL(7,4),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_splits_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "transaction_splits_amount_check" CHECK ("amount" > 0),
    CONSTRAINT "transaction_splits_percentage_check" CHECK (
      "percentage" IS NULL OR ("percentage" > 0 AND "percentage" <= 100)
    )
);

-- CreateIndex
CREATE INDEX "accounts_financial_space_id_deleted_at_idx" ON "accounts"("financial_space_id", "deleted_at");
CREATE INDEX "accounts_holder_member_id_idx" ON "accounts"("holder_member_id");
CREATE UNIQUE INDEX "categories_financial_space_id_type_name_key" ON "categories"("financial_space_id", "type", "name");
CREATE INDEX "categories_financial_space_id_deleted_at_idx" ON "categories"("financial_space_id", "deleted_at");
CREATE INDEX "financial_transactions_financial_space_id_competence_date_idx" ON "financial_transactions"("financial_space_id", "competence_date");
CREATE INDEX "financial_transactions_financial_space_id_status_due_date_idx" ON "financial_transactions"("financial_space_id", "status", "due_date");
CREATE INDEX "financial_transactions_account_id_competence_date_idx" ON "financial_transactions"("account_id", "competence_date");
CREATE INDEX "financial_transactions_category_id_idx" ON "financial_transactions"("category_id");
CREATE UNIQUE INDEX "transaction_splits_transaction_id_member_id_key" ON "transaction_splits"("transaction_id", "member_id");
CREATE INDEX "transaction_splits_financial_space_id_member_id_idx" ON "transaction_splits"("financial_space_id", "member_id");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_financial_space_id_fkey" FOREIGN KEY ("financial_space_id") REFERENCES "financial_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_holder_member_id_fkey" FOREIGN KEY ("holder_member_id") REFERENCES "space_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "categories" ADD CONSTRAINT "categories_financial_space_id_fkey" FOREIGN KEY ("financial_space_id") REFERENCES "financial_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "categories" ADD CONSTRAINT "categories_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_financial_space_id_fkey" FOREIGN KEY ("financial_space_id") REFERENCES "financial_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_payer_member_id_fkey" FOREIGN KEY ("payer_member_id") REFERENCES "space_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "transaction_splits" ADD CONSTRAINT "transaction_splits_financial_space_id_fkey" FOREIGN KEY ("financial_space_id") REFERENCES "financial_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transaction_splits" ADD CONSTRAINT "transaction_splits_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "financial_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transaction_splits" ADD CONSTRAINT "transaction_splits_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "space_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
