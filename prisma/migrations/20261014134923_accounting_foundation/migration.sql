-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "CashFlowClass" AS ENUM ('OPERATING', 'INVESTING', 'FINANCING', 'CASH');

-- CreateEnum
CREATE TYPE "JournalStatus" AS ENUM ('DRAFT', 'POSTED');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "booksLockedUntil" DATE,
ADD COLUMN     "financialYearStartMonth" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "gstin" TEXT,
ADD COLUMN     "stateCode" TEXT;

-- CreateTable
CREATE TABLE "financial_years" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "parentId" TEXT,
    "isGroup" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "cashFlowClass" "CashFlowClass",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entryNumber" TEXT,
    "entryDate" DATE NOT NULL,
    "narration" TEXT,
    "status" "JournalStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceType" TEXT,
    "sourceId" TEXT,
    "reversalOfId" TEXT,
    "createdById" TEXT NOT NULL,
    "postedById" TEXT,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_lines" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_sequences" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "seriesKey" TEXT NOT NULL,
    "fiscalYear" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "requestHash" TEXT,
    "responseStatus" INTEGER,
    "responseBody" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "financial_years_organizationId_label_key" ON "financial_years"("organizationId", "label");

-- CreateIndex
CREATE INDEX "accounts_organizationId_type_idx" ON "accounts"("organizationId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_organizationId_code_key" ON "accounts"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_reversalOfId_key" ON "journal_entries"("reversalOfId");

-- CreateIndex
CREATE INDEX "journal_entries_organizationId_entryDate_idx" ON "journal_entries"("organizationId", "entryDate");

-- CreateIndex
CREATE INDEX "journal_entries_organizationId_status_idx" ON "journal_entries"("organizationId", "status");

-- CreateIndex
CREATE INDEX "journal_entries_sourceType_sourceId_idx" ON "journal_entries"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_organizationId_entryNumber_key" ON "journal_entries"("organizationId", "entryNumber");

-- CreateIndex
CREATE INDEX "journal_lines_organizationId_accountId_idx" ON "journal_lines"("organizationId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "journal_lines_journalEntryId_lineNo_key" ON "journal_lines"("journalEntryId", "lineNo");

-- CreateIndex
CREATE UNIQUE INDEX "document_sequences_organizationId_seriesKey_fiscalYear_key" ON "document_sequences"("organizationId", "seriesKey", "fiscalYear");

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_createdAt_idx" ON "audit_logs"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_organizationId_key_endpoint_key" ON "idempotency_records"("organizationId", "key", "endpoint");

-- AddForeignKey
ALTER TABLE "financial_years" ADD CONSTRAINT "financial_years_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;








-- ---------------------------------------------------------------------------
-- Ledger protections: the database itself enforces the accounting rules
-- ---------------------------------------------------------------------------

-- 1. Amount rules on journal lines: never negative, exactly one side filled
ALTER TABLE "journal_lines"
  ADD CONSTRAINT "journal_lines_amounts_check"
  CHECK (
    "debit" >= 0
    AND "credit" >= 0
    AND (("debit" > 0 AND "credit" = 0) OR ("credit" > 0 AND "debit" = 0))
  );

-- 2. A posted entry must balance and have at least two lines (checked at commit)
CREATE OR REPLACE FUNCTION enforce_journal_entry_balanced() RETURNS trigger AS $$
DECLARE
  total_debit  numeric;
  total_credit numeric;
  line_count   integer;
BEGIN
  IF NEW."status" = 'POSTED' THEN
    SELECT COALESCE(SUM("debit"), 0), COALESCE(SUM("credit"), 0), COUNT(*)
      INTO total_debit, total_credit, line_count
      FROM "journal_lines"
     WHERE "journalEntryId" = NEW."id";

    IF line_count < 2 THEN
      RAISE EXCEPTION 'Journal entry % must have at least two lines', NEW."id";
    END IF;

    IF total_debit <> total_credit THEN
      RAISE EXCEPTION 'Journal entry % is not balanced (debit %, credit %)',
        NEW."id", total_debit, total_credit;
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "journal_entries_balanced"
  AFTER INSERT OR UPDATE ON "journal_entries"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION enforce_journal_entry_balanced();

-- 3. Posted entries are immutable
CREATE OR REPLACE FUNCTION prevent_posted_entry_change() RETURNS trigger AS $$
BEGIN
  IF OLD."status" = 'POSTED' THEN
    RAISE EXCEPTION 'Posted journal entries cannot be changed or deleted (entry %)', OLD."id";
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "journal_entries_immutable"
  BEFORE UPDATE OR DELETE ON "journal_entries"
  FOR EACH ROW EXECUTE FUNCTION prevent_posted_entry_change();

-- 4. A reversal must belong to the same organization and reverse a posted entry
CREATE OR REPLACE FUNCTION enforce_journal_entry_reversal() RETURNS trigger AS $$
DECLARE
  original_org    text;
  original_status text;
BEGIN
  IF NEW."reversalOfId" IS NOT NULL THEN
    SELECT "organizationId", "status"::text
      INTO original_org, original_status
      FROM "journal_entries"
     WHERE "id" = NEW."reversalOfId";

    IF original_org IS DISTINCT FROM NEW."organizationId" THEN
      RAISE EXCEPTION 'A reversal must belong to the same organization as the entry it reverses';
    END IF;

    IF original_status IS DISTINCT FROM 'POSTED' THEN
      RAISE EXCEPTION 'Only a posted entry can be reversed';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "journal_entries_reversal"
  BEFORE INSERT OR UPDATE ON "journal_entries"
  FOR EACH ROW EXECUTE FUNCTION enforce_journal_entry_reversal();

-- 5. Lines of a posted entry are immutable (no insert, update or delete)
CREATE OR REPLACE FUNCTION prevent_posted_line_change() RETURNS trigger AS $$
DECLARE
  entry_id     text;
  entry_status text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    entry_id := NEW."journalEntryId";
  ELSE
    entry_id := OLD."journalEntryId";
  END IF;

  SELECT "status"::text INTO entry_status
    FROM "journal_entries"
   WHERE "id" = entry_id;

  IF entry_status = 'POSTED' THEN
    RAISE EXCEPTION 'Lines of a posted journal entry cannot be added, changed or deleted (entry %)', entry_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "journal_lines_immutable"
  BEFORE INSERT OR UPDATE OR DELETE ON "journal_lines"
  FOR EACH ROW EXECUTE FUNCTION prevent_posted_line_change();

-- 6. A line must belong to the same organization as its entry and account,
--    and must post to an active, non-group account
CREATE OR REPLACE FUNCTION enforce_journal_line_tenant() RETURNS trigger AS $$
DECLARE
  entry_org      text;
  account_org    text;
  account_group  boolean;
  account_active boolean;
BEGIN
  SELECT "organizationId" INTO entry_org
    FROM "journal_entries" WHERE "id" = NEW."journalEntryId";

  SELECT "organizationId", "isGroup", "isActive"
    INTO account_org, account_group, account_active
    FROM "accounts" WHERE "id" = NEW."accountId";

  IF entry_org IS DISTINCT FROM NEW."organizationId"
     OR account_org IS DISTINCT FROM NEW."organizationId" THEN
    RAISE EXCEPTION 'Journal line organization does not match its entry or account';
  END IF;

  IF account_group THEN
    RAISE EXCEPTION 'Cannot post to a group account';
  END IF;

  IF NOT account_active THEN
    RAISE EXCEPTION 'Cannot post to an inactive account';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "journal_lines_tenant"
  BEFORE INSERT OR UPDATE ON "journal_lines"
  FOR EACH ROW EXECUTE FUNCTION enforce_journal_line_tenant();

-- 7. The audit log is append-only
CREATE OR REPLACE FUNCTION prevent_audit_log_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Audit log entries cannot be changed or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "audit_logs_immutable"
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_change();