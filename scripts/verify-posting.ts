import "dotenv/config";
import { prisma } from "../lib/prisma";
import {
  PostingError,
  lockBooks,
  postJournalEntry,
  postJournalEntryInTx,
  reverseJournalEntry,
  type PostingErrorCode,
} from "../modules/accounting/posting-service";

let failures = 0;

function pass(message: string) {
  console.log(`  PASS  ${message}`);
}

function fail(message: string) {
  failures += 1;
  console.log(`  FAIL  ${message}`);
}

function check(condition: boolean, passMessage: string, failMessage: string) {
  if (condition) pass(passMessage);
  else fail(failMessage);
}

async function expectPostingError(label: string, action: () => Promise<unknown>, code: PostingErrorCode) {
  try {
    await action();
    fail(`${label} (it was accepted, but it should have been rejected)`);
  } catch (error) {
    if (error instanceof PostingError && error.code === code) {
      pass(label);
    } else {
      const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      fail(`${label} (expected ${code}, got ${text.slice(0, 160)})`);
    }
  }
}

/** Throwaway organizations used only by this script. */
async function proofOrganization(name: string) {
  const organization =
    (await prisma.organization.findFirst({ where: { name } })) ??
    (await prisma.organization.create({ data: { name } }));

  const user = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: organization.id, email: "proof@posting.test" } },
    update: {},
    create: {
      organizationId: organization.id,
      name: "Posting Proof",
      email: "proof@posting.test",
      passwordHash: "not-a-real-hash",
      role: "ADMIN",
    },
  });

  await prisma.financialYear.upsert({
    where: { organizationId_label: { organizationId: organization.id, label: "2026-27" } },
    update: { isClosed: false },
    create: {
      organizationId: organization.id,
      label: "2026-27",
      startDate: new Date(Date.UTC(2026, 3, 1)),
      endDate: new Date(Date.UTC(2027, 2, 31)),
    },
  });

  async function account(code: string, type: "ASSET" | "INCOME", extra: { isGroup?: boolean; isActive?: boolean } = {}) {
    return prisma.account.upsert({
      where: { organizationId_code: { organizationId: organization.id, code } },
      update: {},
      create: { organizationId: organization.id, code, name: `Test ${code}`, type, ...extra },
    });
  }

  return { organization, user, account };
}

async function main() {
  const main = await proofOrganization("Posting Proof Test");
  const other = await proofOrganization("Posting Proof Other");

  const organizationId = main.organization.id;
  const userId = main.user.id;

  const cash = await main.account("P-CASH", "ASSET");
  const sales = await main.account("P-SALES", "INCOME");
  const groupAccount = await main.account("P-GROUP", "ASSET", { isGroup: true });
  const inactiveAccount = await main.account("P-OFF", "ASSET", { isActive: false });
  const foreignAccount = await other.account("P-CASH", "ASSET");

  // Start every run with open books.
  await lockBooks(prisma, { organizationId, userId, lockedUntil: null });

  const sale = (amount: string, entryDate = "2026-10-14") => ({
    organizationId,
    userId,
    entryDate,
    narration: "Posting proof",
    lines: [
      { accountId: cash.id, debit: amount, credit: "0" },
      { accountId: sales.id, debit: "0", credit: amount },
    ],
  });

  const entryCount = () => prisma.journalEntry.count({ where: { organizationId } });

  console.log("\nPosting service checks\n");

  // 1. Posting numbers the entry and writes an audit record
  const first = await postJournalEntry(prisma, sale("1180.00"));
  check(
    /^JV\/2026-27\/\d{4}$/.test(first.entryNumber),
    `An entry is posted and numbered (${first.entryNumber})`,
    `Unexpected entry number: ${first.entryNumber}`
  );

  const storedFirst = await prisma.journalEntry.findUnique({ where: { id: first.id } });
  check(
    storedFirst?.status === "POSTED" && storedFirst.entryNumber === first.entryNumber,
    "The stored entry is POSTED with its number",
    "The stored entry is not POSTED or has a different number"
  );

  const audit = await prisma.auditLog.count({
    where: { organizationId, entityId: first.id, action: "JOURNAL_POSTED" },
  });
  check(audit === 1, "Posting wrote one audit record", `Expected 1 audit record, found ${audit}`);

  // 2-3. Rejected entries leave nothing behind
  const before = await entryCount();

  await expectPostingError(
    "An unbalanced entry is rejected",
    () =>
      postJournalEntry(prisma, {
        ...sale("100.00"),
        lines: [
          { accountId: cash.id, debit: "100.00", credit: "0" },
          { accountId: sales.id, debit: "0", credit: "99.99" },
        ],
      }),
    "VALIDATION"
  );

  await expectPostingError("An impossible date is rejected", () => postJournalEntry(prisma, sale("10.00", "2026-02-31")), "VALIDATION");

  await expectPostingError("A date outside every financial year is rejected", () => postJournalEntry(prisma, sale("10.00", "2020-01-01")), "NO_FINANCIAL_YEAR");

  // 4-6. Account rules
  const withAccount = (accountId: string) => ({
    ...sale("10.00"),
    lines: [
      { accountId, debit: "10.00", credit: "0" },
      { accountId: sales.id, debit: "0", credit: "10.00" },
    ],
  });

  await expectPostingError("A group account is rejected", () => postJournalEntry(prisma, withAccount(groupAccount.id)), "ACCOUNT_INVALID");
  await expectPostingError("An inactive account is rejected", () => postJournalEntry(prisma, withAccount(inactiveAccount.id)), "ACCOUNT_INVALID");
  await expectPostingError("Another organization's account is rejected", () => postJournalEntry(prisma, withAccount(foreignAccount.id)), "ACCOUNT_INVALID");

  check((await entryCount()) === before, "Rejected entries left no draft behind", "A rejected entry left a record behind");

  // 7-9. Locked books
  await lockBooks(prisma, { organizationId, userId, lockedUntil: "2026-09-30" });

  await expectPostingError("Posting into locked books is rejected", () => postJournalEntry(prisma, sale("10.00", "2026-09-15")), "PERIOD_LOCKED");

  await expectPostingError("The lock date itself is locked", () => postJournalEntry(prisma, sale("10.00", "2026-09-30")), "PERIOD_LOCKED");

  try {
    await postJournalEntry(prisma, sale("10.00", "2026-10-01"));
    pass("The day after the lock date is open");
  } catch (error) {
    fail(`The day after the lock date is open (${error instanceof Error ? error.message : error})`);
  }

  await lockBooks(prisma, { organizationId, userId, lockedUntil: null });

  // 10-14. Reversal
  const toReverse = await postJournalEntry(prisma, sale("500.00"));
  const reversal = await reverseJournalEntry(prisma, {
    organizationId,
    userId,
    entryId: toReverse.id,
    entryDate: "2026-10-15",
  });

  const reversalLines = await prisma.journalLine.findMany({
    where: { journalEntryId: reversal.id },
    orderBy: { lineNo: "asc" },
  });

  check(
    reversalLines.length === 2 &&
      reversalLines[0].credit.toString() === "500" &&
      reversalLines[1].debit.toString() === "500",
    `A reversing entry mirrors the original (${reversal.entryNumber})`,
    "The reversing entry does not mirror the original"
  );

  const original = await prisma.journalEntry.findUnique({ where: { id: toReverse.id } });
  check(original?.status === "POSTED", "The original entry is untouched", "The original entry changed");

  await expectPostingError(
    "The same entry cannot be reversed twice",
    () => reverseJournalEntry(prisma, { organizationId, userId, entryId: toReverse.id, entryDate: "2026-10-15" }),
    "ALREADY_REVERSED"
  );

  await expectPostingError(
    "An unknown entry cannot be reversed",
    () => reverseJournalEntry(prisma, { organizationId, userId, entryId: "does-not-exist", entryDate: "2026-10-15" }),
    "ENTRY_NOT_FOUND"
  );

  const otherEntry = await postJournalEntry(prisma, {
    organizationId: other.organization.id,
    userId: other.user.id,
    entryDate: "2026-10-14",
    lines: [
      { accountId: foreignAccount.id, debit: "5.00", credit: "0" },
      { accountId: (await other.account("P-SALES", "INCOME")).id, debit: "0", credit: "5.00" },
    ],
  });

  await expectPostingError(
    "Another organization's entry cannot be reversed",
    () => reverseJournalEntry(prisma, { organizationId, userId, entryId: otherEntry.id, entryDate: "2026-10-15" }),
    "ENTRY_NOT_FOUND"
  );

  // 15. A reversal into locked books fails as a whole
  const lockedTarget = await postJournalEntry(prisma, sale("77.00"));
  await lockBooks(prisma, { organizationId, userId, lockedUntil: "2026-10-31" });
  const countBeforeLocked = await entryCount();

  await expectPostingError(
    "A reversal dated in locked books is rejected",
    () => reverseJournalEntry(prisma, { organizationId, userId, entryId: lockedTarget.id, entryDate: "2026-10-20" }),
    "PERIOD_LOCKED"
  );

  check((await entryCount()) === countBeforeLocked, "The failed reversal left nothing behind", "The failed reversal left a record behind");
  await lockBooks(prisma, { organizationId, userId, lockedUntil: null });

  // 16. A rolled-back posting does not burn a number
  const numberOf = (entryNumber: string) => Number(entryNumber.split("/")[2]);
  const lastBefore = await postJournalEntry(prisma, sale("1.00"));

  try {
    await prisma.$transaction(async (tx) => {
      await postJournalEntryInTx(tx, sale("2.00"));
      throw new Error("force rollback");
    });
  } catch {
    // expected
  }

  const lastAfter = await postJournalEntry(prisma, sale("3.00"));
  check(
    numberOf(lastAfter.entryNumber) === numberOf(lastBefore.entryNumber) + 1,
    "A rolled-back posting does not burn a number (no gaps)",
    `Gap found: ${lastBefore.entryNumber} then ${lastAfter.entryNumber}`
  );

  // 17-18. Concurrency: simultaneous postings get unique, consecutive numbers
  const PARALLEL = 8;
  const results = await Promise.all(
    Array.from({ length: PARALLEL }, (_, index) => postJournalEntry(prisma, sale(`${10 + index}.00`)))
  );

  const numbers = results.map((result) => numberOf(result.entryNumber)).sort((a, b) => a - b);

  check(
    new Set(numbers).size === PARALLEL,
    `${PARALLEL} simultaneous postings got ${PARALLEL} different numbers`,
    `Duplicate numbers: ${numbers.join(", ")}`
  );

  check(
    numbers[numbers.length - 1] - numbers[0] === PARALLEL - 1,
    `The numbers are consecutive (${numbers[0]} to ${numbers[numbers.length - 1]})`,
    `Gap in numbers: ${numbers.join(", ")}`
  );

  const sequence = await prisma.documentSequence.findFirst({
    where: { organizationId, seriesKey: "JV", fiscalYear: "2026-27" },
  });

  check(
    sequence?.nextNumber === numbers[numbers.length - 1] + 1,
    "The sequence counter matches the last number issued",
    `Sequence counter ${sequence?.nextNumber} does not match last number ${numbers[numbers.length - 1]}`
  );

  console.log(failures === 0 ? "\nAll posting checks passed.\n" : `\n${failures} check(s) failed.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });