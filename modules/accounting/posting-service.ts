import type { Prisma, PrismaClient } from "@/app/generated/prisma/client";
import { reverseLines, validateJournalLines, type JournalLineInput } from "./journal-rules";
import { toMoney } from "./money";
import { formatEntryNumber, parseDateOnly, toDateOnlyString } from "./posting-helpers";

export type PostingErrorCode =
  | "VALIDATION"
  | "ORGANIZATION_NOT_FOUND"
  | "NO_FINANCIAL_YEAR"
  | "PERIOD_LOCKED"
  | "ACCOUNT_INVALID"
  | "ENTRY_NOT_FOUND"
  | "ENTRY_NOT_POSTED"
  | "ALREADY_REVERSED";

export class PostingError extends Error {
  code: PostingErrorCode;
  details: string[];

  constructor(code: PostingErrorCode, message: string, details: string[] = []) {
    super(message);
    this.name = "PostingError";
    this.code = code;
    this.details = details;
  }
}

export type PostJournalInput = {
  organizationId: string;
  userId: string;
  /** Accounting date as YYYY-MM-DD. */
  entryDate: string;
  narration?: string;
  lines: JournalLineInput[];
  sourceType?: string;
  sourceId?: string;
  reversalOfId?: string;
};

export type PostedJournal = {
  id: string;
  entryNumber: string;
  entryDate: string;
  totalDebit: string;
  totalCredit: string;
};

const JOURNAL_SERIES = "JV";

/**
 * Validates, numbers and posts a journal entry INSIDE the caller's transaction.
 * Use this when a document (invoice, bill, ...) and its journal must commit together.
 * Everything here is rolled back with the transaction, including the document number.
 */
export async function postJournalEntryInTx(
  tx: Prisma.TransactionClient,
  input: PostJournalInput
): Promise<PostedJournal> {
  const { organizationId, userId } = input;

  const entryDate = parseDateOnly(input.entryDate);
  if (!entryDate) {
    throw new PostingError("VALIDATION", "Entry date must be a real date in YYYY-MM-DD format.");
  }

  const checked = validateJournalLines(input.lines);
  if (!checked.ok) {
    throw new PostingError("VALIDATION", "The journal entry is not valid.", checked.errors);
  }

  const organization = await tx.organization.findUnique({
    where: { id: organizationId },
    select: { booksLockedUntil: true },
  });

  if (!organization) {
    throw new PostingError("ORGANIZATION_NOT_FOUND", "Organization not found.");
  }

  if (organization.booksLockedUntil && entryDate.getTime() <= organization.booksLockedUntil.getTime()) {
    throw new PostingError(
      "PERIOD_LOCKED",
      `Books are locked up to ${toDateOnlyString(organization.booksLockedUntil)}. Choose a later date.`
    );
  }

  const financialYear = await tx.financialYear.findFirst({
    where: { organizationId, startDate: { lte: entryDate }, endDate: { gte: entryDate } },
  });

  if (!financialYear) {
    throw new PostingError("NO_FINANCIAL_YEAR", `No financial year covers ${input.entryDate}.`);
  }

  if (financialYear.isClosed) {
    throw new PostingError("PERIOD_LOCKED", `Financial year ${financialYear.label} is closed.`);
  }

  const accountIds = [...new Set(input.lines.map((line) => line.accountId))];
  const accounts = await tx.account.findMany({
    where: { id: { in: accountIds }, organizationId },
  });

  const problems: string[] = [];
  for (const accountId of accountIds) {
    const account = accounts.find((candidate) => candidate.id === accountId);

    if (!account) problems.push(`Account ${accountId} was not found in this organization.`);
    else if (account.isGroup) problems.push(`${account.code} ${account.name} is a group account.`);
    else if (!account.isActive) problems.push(`${account.code} ${account.name} is inactive.`);
  }

  if (problems.length > 0) {
    throw new PostingError("ACCOUNT_INVALID", "One or more accounts cannot be used.", problems);
  }

  const draft = await tx.journalEntry.create({
    data: {
      organizationId,
      entryDate,
      narration: input.narration ?? null,
      createdById: userId,
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
      reversalOfId: input.reversalOfId ?? null,
      lines: {
        create: input.lines.map((line, index) => ({
          organizationId,
          accountId: line.accountId,
          lineNo: index + 1,
          debit: toMoney(line.debit).toFixed(2),
          credit: toMoney(line.credit).toFixed(2),
          description: line.description ?? null,
        })),
      },
    },
  });

  // Number allocation. The increment is one atomic UPDATE: concurrent postings queue
  // on this row, so numbers are unique and consecutive. It sits inside the same
  // transaction, so a rollback gives the number back (no gaps).
  await tx.documentSequence.createMany({
    data: [
      {
        organizationId,
        seriesKey: JOURNAL_SERIES,
        fiscalYear: financialYear.label,
        prefix: JOURNAL_SERIES,
        nextNumber: 1,
      },
    ],
    skipDuplicates: true,
  });

  const sequence = await tx.documentSequence.update({
    where: {
      organizationId_seriesKey_fiscalYear: {
        organizationId,
        seriesKey: JOURNAL_SERIES,
        fiscalYear: financialYear.label,
      },
    },
    data: { nextNumber: { increment: 1 } },
  });

  const entryNumber = formatEntryNumber(sequence.prefix, financialYear.label, sequence.nextNumber - 1);

  await tx.journalEntry.update({
    where: { id: draft.id },
    data: { status: "POSTED", entryNumber, postedAt: new Date(), postedById: userId },
  });

  await tx.auditLog.create({
    data: {
      organizationId,
      userId,
      action: "JOURNAL_POSTED",
      entityType: "JournalEntry",
      entityId: draft.id,
      after: {
        entryNumber,
        entryDate: input.entryDate,
        totalDebit: checked.totalDebit,
        lines: input.lines.length,
        sourceType: input.sourceType ?? null,
        sourceId: input.sourceId ?? null,
        reversalOfId: input.reversalOfId ?? null,
      },
    },
  });

  return {
    id: draft.id,
    entryNumber,
    entryDate: input.entryDate,
    totalDebit: checked.totalDebit,
    totalCredit: checked.totalCredit,
  };
}

/** Posts a journal entry in its own transaction. */
export function postJournalEntry(prisma: PrismaClient, input: PostJournalInput) {
  return prisma.$transaction((tx) => postJournalEntryInTx(tx, input));
}

export type ReverseJournalInput = {
  organizationId: string;
  userId: string;
  entryId: string;
  /** Date of the reversing entry (YYYY-MM-DD). It must fall in an open period. */
  entryDate: string;
  narration?: string;
};

/**
 * Corrects a posted entry by posting its mirror image. The original is never touched.
 * An entry can be reversed once; the database enforces that as well.
 */
export function reverseJournalEntry(prisma: PrismaClient, input: ReverseJournalInput) {
  return prisma.$transaction(async (tx) => {
    const original = await tx.journalEntry.findFirst({
      where: { id: input.entryId, organizationId: input.organizationId },
      include: {
        lines: { orderBy: { lineNo: "asc" } },
        reversedBy: { select: { id: true } },
      },
    });

    if (!original) {
      throw new PostingError("ENTRY_NOT_FOUND", "Journal entry not found.");
    }

    if (original.status !== "POSTED") {
      throw new PostingError("ENTRY_NOT_POSTED", "Only a posted entry can be reversed.");
    }

    if (original.reversedBy) {
      throw new PostingError("ALREADY_REVERSED", `${original.entryNumber} has already been reversed.`);
    }

    const reversal = await postJournalEntryInTx(tx, {
      organizationId: input.organizationId,
      userId: input.userId,
      entryDate: input.entryDate,
      narration: input.narration ?? `Reversal of ${original.entryNumber}`,
      lines: reverseLines(
        original.lines.map((line) => ({
          accountId: line.accountId,
          debit: line.debit.toString(),
          credit: line.credit.toString(),
          description: line.description ?? undefined,
        }))
      ),
      sourceType: "REVERSAL",
      sourceId: original.id,
      reversalOfId: original.id,
    });

    await tx.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: "JOURNAL_REVERSED",
        entityType: "JournalEntry",
        entityId: original.id,
        after: { originalNumber: original.entryNumber, reversalNumber: reversal.entryNumber },
      },
    });

    return reversal;
  });
}

export type LockBooksInput = {
  organizationId: string;
  userId: string;
  /** Books are closed up to and including this date (YYYY-MM-DD). null unlocks. */
  lockedUntil: string | null;
};

/** Sets or clears the date up to which postings are refused. Always audited. */
export function lockBooks(prisma: PrismaClient, input: LockBooksInput) {
  return prisma.$transaction(async (tx) => {
    let lockedUntil: Date | null = null;

    if (input.lockedUntil !== null) {
      lockedUntil = parseDateOnly(input.lockedUntil);
      if (!lockedUntil) {
        throw new PostingError("VALIDATION", "Lock date must be a real date in YYYY-MM-DD format.");
      }
    }

    const organization = await tx.organization.findUnique({
      where: { id: input.organizationId },
      select: { booksLockedUntil: true },
    });

    if (!organization) {
      throw new PostingError("ORGANIZATION_NOT_FOUND", "Organization not found.");
    }

    await tx.organization.update({
      where: { id: input.organizationId },
      data: { booksLockedUntil: lockedUntil },
    });

    await tx.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: "BOOKS_LOCK_CHANGED",
        entityType: "Organization",
        entityId: input.organizationId,
        before: { booksLockedUntil: organization.booksLockedUntil ? toDateOnlyString(organization.booksLockedUntil) : null },
        after: { booksLockedUntil: input.lockedUntil },
      },
    });
  });
}