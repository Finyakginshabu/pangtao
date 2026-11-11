-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CASH', 'LOAN_TAKEN', 'LOAN_GIVEN', 'INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "AccountSubtype" AS ENUM ('WALLET', 'BANK', 'CREDIT_CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "TransactionKind" AS ENUM ('PAYMENT', 'RECEIPT', 'OPENING_BALANCE');

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "subtype" "AccountSubtype",
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "TransactionKind" NOT NULL,
    "account_id" UUID NOT NULL,
    "txn_date" DATE NOT NULL,
    "total_amount" BIGINT NOT NULL,
    "memo" TEXT,
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "voided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allocation_lines" (
    "id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "target_account_id" UUID NOT NULL,
    "amount" BIGINT NOT NULL,
    "line_no" INTEGER NOT NULL,
    "note" TEXT,

    CONSTRAINT "allocation_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_user_id_name_key" ON "accounts"("user_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_user_id_id_key" ON "accounts"("user_id", "id");

-- CreateIndex
CREATE INDEX "transactions_user_id_txn_date_created_at_idx" ON "transactions"("user_id", "txn_date" DESC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "transactions_account_id_idx" ON "transactions"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_user_id_id_key" ON "transactions"("user_id", "id");

-- CreateIndex
CREATE INDEX "allocation_lines_target_account_id_idx" ON "allocation_lines"("target_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "allocation_lines_transaction_id_line_no_key" ON "allocation_lines"("transaction_id", "line_no");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_account_id_fkey" FOREIGN KEY ("user_id", "account_id") REFERENCES "accounts"("user_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation_lines" ADD CONSTRAINT "allocation_lines_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation_lines" ADD CONSTRAINT "allocation_lines_user_id_transaction_id_fkey" FOREIGN KEY ("user_id", "transaction_id") REFERENCES "transactions"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation_lines" ADD CONSTRAINT "allocation_lines_user_id_target_account_id_fkey" FOREIGN KEY ("user_id", "target_account_id") REFERENCES "accounts"("user_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE;



-- ---------------------------------------------------------------------------
-- Hand-written constraints Prisma cannot express (system-sds §2, BR-04, BR-11, BR-14).
-- ---------------------------------------------------------------------------

-- Subtype must be valid for the account type (FR-09, BR-14).
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_subtype_valid" CHECK (
    "subtype" IS NULL
    OR ("type" = 'CASH' AND "subtype" IN ('WALLET', 'BANK'))
    OR ("type" = 'LOAN_TAKEN' AND "subtype" IN ('CREDIT_CARD', 'OTHER'))
);

-- Amounts are integer satang, at most 100,000,000.00 THB; only an opening balance may be 0 (BR-04).
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_total_amount_range" CHECK (
    "total_amount" <= 10000000000
    AND ("total_amount" > 0 OR ("kind" = 'OPENING_BALANCE' AND "total_amount" = 0))
);

ALTER TABLE "allocation_lines" ADD CONSTRAINT "allocation_lines_amount_range" CHECK (
    "amount" > 0 AND "amount" <= 10000000000
);

-- At most one active (non-voided) opening balance per account (BR-11).
CREATE UNIQUE INDEX "unique_active_opening_balance" ON "transactions"("account_id")
    WHERE "kind" = 'OPENING_BALANCE' AND "voided_at" IS NULL;
