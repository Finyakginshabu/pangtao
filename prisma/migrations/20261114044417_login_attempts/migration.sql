-- CreateTable
CREATE TABLE "login_attempts" (
    "ip" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "reset_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("ip","email")
);

-- CreateIndex
CREATE INDEX "login_attempts_reset_at_idx" ON "login_attempts"("reset_at");

-- Hand-written (Prisma cannot express CHECK constraints): a row exists only after a failure.
ALTER TABLE "login_attempts" ADD CONSTRAINT "login_attempts_count_positive" CHECK ("count" > 0);
