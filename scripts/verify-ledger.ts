import "dotenv/config";
import { prisma } from "../lib/prisma";

const ENTRY_DATE = new Date(Date.UTC(2026, 9, 12));

let failures = 0;

function pass(message: string) {
  console.log(`  PASS  ${message}`);
}

function fail(message: string) {
  failures += 1;
  console.log(`  FAIL  ${message}`);
}

function describeError(error: unknown) {
  if (error instanceof Error) {
    const meta = (error as { meta?: unknown }).meta;
    return `${error.message} ${meta ? JSON.stringify(meta) : ""}`;
  }
  return String(error);
}

async function expectRejected(
  label: string,
  action: () => Promise<unknown>,
  expectedText: string
) {
  try {
    await action();
    fail(`${label} (it was accepted, but it should have been rejected)`);
  } catch (error) {
    const text = describeError(error);
    if (text.includes(expectedText)) {
      pass(label);
    } else {
      fail(`${label} (rejected, but for another reason: ${text.slice(0, 200)})`);
    }
  }
}

/** Two throwaway organizations used only by this script. */
async function proofOrganization(name: string) {
  const organization =
    (await prisma.organization.findFirst({ where: { name } })) ??
    (await prisma.organization.create({ data: { name } }));

  const user = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: organization.id, email: "proof@ledger.test" } },
    update: {},
    create: {
      organizationId: organization.id,
      name: "Ledger Proof",
      email: "proof@ledger.test",
      passwordHash: "not-a-real-hash",
      role: "ADMIN",
    },
  });

  async function account(
    code: string,
    type: "ASSET" | "INCOME",
    extra: { isGroup?: boolean; isActive?: boolean } = {}
  ) {
    return prisma.account.upsert({
      where: { organizationId_code: { organizationId: organization.id, code } },
      update: {},
      create: { organizationId: organization.id, code, name: `Test ${code}`, type, ...extra },
    });
  }

  return { organization, user, account };
}

async function main() {
  const main = await proofOrganization("Ledger Proof Test");
  const other = await proofOrganization("Ledger Proof Other");

  const organizationId = main.organization.id;
  const cash = await main.account("T-CASH", "ASSET");
  const sales = await main.account("T-SALES", "INCOME");
  const groupAccount = await main.account("T-GROUP", "ASSET", { isGroup: true });
  const inactiveAccount = await main.account("T-OFF", "ASSET", { isActive: false });
  const foreignAccount = await other.account("T-CASH", "ASSET");

  type Line = { organizationId: string; accountId: string; lineNo: number; debit: string; credit: string };

  const twoLines = (debit: string, credit: string): Line[] => [
    { organizationId, accountId: cash.id, lineNo: 1, debit, credit: "0" },
    { organizationId, accountId: sales.id, lineNo: 2, debit: "0", credit },
  ];

  // Creates a draft with lines and posts it in ONE transaction.
  async function createAndPost(lines: Line[], reversalOfId?: string, forOrganizationId = organizationId) {
    return prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          organizationId: forOrganizationId,
          entryDate: ENTRY_DATE,
          narration: "Ledger proof",
          createdById: main.user.id,
          reversalOfId: reversalOfId ?? null,
          lines: { create: lines },
        },
      });

      return tx.journalEntry.update({
        where: { id: entry.id },
        data: { status: "POSTED", postedAt: new Date(), postedById: main.user.id },
      });
    });
  }

  function draftWith(lines: Line[]) {
    return prisma.journalEntry.create({
      data: {
        organizationId,
        entryDate: ENTRY_DATE,
        createdById: main.user.id,
        lines: { create: lines },
      },
    });
  }

  console.log("\nLedger protection checks\n");

  // 1. A balanced entry posts
  let posted: { id: string } | null = null;
  try {
    posted = await createAndPost(twoLines("1000.00", "1000.00"));
    pass("A balanced entry can be posted");
  } catch (error) {
    fail(`A balanced entry can be posted (${describeError(error).slice(0, 200)})`);
  }

  if (!posted) {
    console.log("\nCannot continue without a posted entry.");
    process.exit(1);
  }

  const postedId = posted.id;

  // 2-3. Balance and size
  await expectRejected(
    "An unbalanced entry is rejected",
    () => createAndPost(twoLines("100.00", "99.99")),
    "is not balanced"
  );

  await expectRejected(
    "An entry with fewer than two lines is rejected",
    () => createAndPost(twoLines("100.00", "100.00").slice(0, 1)),
    "at least two lines"
  );

  // 4-8. Posted entries are immutable
  await expectRejected(
    "A posted entry cannot be edited",
    () => prisma.journalEntry.update({ where: { id: postedId }, data: { narration: "tampered" } }),
    "cannot be changed or deleted"
  );

  await expectRejected(
    "A posted entry cannot be deleted",
    () => prisma.journalEntry.delete({ where: { id: postedId } }),
    "cannot be changed or deleted"
  );

  await expectRejected(
    "A line of a posted entry cannot be changed",
    () =>
      prisma.journalLine.updateMany({
        where: { journalEntryId: postedId },
        data: { description: "tampered" },
      }),
    "cannot be added, changed or deleted"
  );

  await expectRejected(
    "A line of a posted entry cannot be deleted",
    () => prisma.journalLine.deleteMany({ where: { journalEntryId: postedId } }),
    "cannot be added, changed or deleted"
  );

  await expectRejected(
    "A new line cannot be added to a posted entry",
    () =>
      prisma.journalLine.create({
        data: { organizationId, journalEntryId: postedId, accountId: cash.id, lineNo: 99, debit: "5", credit: "0" },
      }),
    "cannot be added, changed or deleted"
  );

  // 9-10. Line amount rules
  await expectRejected(
    "A line with both a debit and a credit is rejected",
    () => draftWith([{ organizationId, accountId: cash.id, lineNo: 1, debit: "5", credit: "5" }]),
    "journal_lines_amounts_check"
  );

  await expectRejected(
    "A negative amount is rejected",
    () => draftWith([{ organizationId, accountId: cash.id, lineNo: 1, debit: "-5", credit: "0" }]),
    "journal_lines_amounts_check"
  );

  // 11-13. Tenant and account rules
  await expectRejected(
    "A line cannot use another organization's account",
    () => draftWith([{ organizationId, accountId: foreignAccount.id, lineNo: 1, debit: "5", credit: "0" }]),
    "does not match its entry or account"
  );

  await expectRejected(
    "A line cannot claim a different organization than its entry",
    () => draftWith([{ organizationId: other.organization.id, accountId: cash.id, lineNo: 1, debit: "5", credit: "0" }]),
    "does not match its entry or account"
  );

  await expectRejected(
    "A line cannot post to a group account",
    () => draftWith([{ organizationId, accountId: groupAccount.id, lineNo: 1, debit: "5", credit: "0" }]),
    "Cannot post to a group account"
  );

  await expectRejected(
    "A line cannot post to an inactive account",
    () => draftWith([{ organizationId, accountId: inactiveAccount.id, lineNo: 1, debit: "5", credit: "0" }]),
    "Cannot post to an inactive account"
  );

  // 14-17. Reversals
  const reversalLines: Line[] = [
    { organizationId, accountId: cash.id, lineNo: 1, debit: "0", credit: "1000.00" },
    { organizationId, accountId: sales.id, lineNo: 2, debit: "1000.00", credit: "0" },
  ];

  try {
    await createAndPost(reversalLines, postedId);
    pass("A posted entry can be corrected with a reversing entry");
  } catch (error) {
    fail(`A posted entry can be corrected with a reversing entry (${describeError(error).slice(0, 200)})`);
  }

  await expectRejected(
    "The same entry cannot be reversed twice",
    () => createAndPost(reversalLines, postedId),
    "Unique constraint"
  );

  await expectRejected(
    "An entry cannot be reversed by another organization",
    () =>
      createAndPost(
        [
          { organizationId: other.organization.id, accountId: foreignAccount.id, lineNo: 1, debit: "0", credit: "5" },
          { organizationId: other.organization.id, accountId: foreignAccount.id, lineNo: 2, debit: "5", credit: "0" },
        ],
        postedId,
        other.organization.id
      ),
    "same organization"
  );

  const draft = await draftWith(twoLines("7.00", "7.00"));

  await expectRejected(
    "A draft entry cannot be reversed",
    () => createAndPost(reversalLines, draft.id),
    "Only a posted entry can be reversed"
  );

  // 18-19. Audit log is append-only
  const log = await prisma.auditLog.create({
    data: { organizationId, userId: main.user.id, action: "LEDGER_PROOF", entityType: "JournalEntry", entityId: postedId },
  });

  await expectRejected(
    "An audit log entry cannot be edited",
    () => prisma.auditLog.update({ where: { id: log.id }, data: { action: "tampered" } }),
    "Audit log entries cannot be changed or deleted"
  );

  await expectRejected(
    "An audit log entry cannot be deleted",
    () => prisma.auditLog.delete({ where: { id: log.id } }),
    "Audit log entries cannot be changed or deleted"
  );

  // 20. Whole-ledger check
  const totals = await prisma.journalLine.aggregate({
    where: { organizationId, journalEntry: { status: "POSTED" } },
    _sum: { debit: true, credit: true },
  });

  const debit = totals._sum.debit?.toString() ?? "0";
  const credit = totals._sum.credit?.toString() ?? "0";

  if (debit === credit) {
    pass(`Total posted debits equal total posted credits (${debit})`);
  } else {
    fail(`Posted totals differ: debit ${debit} vs credit ${credit}`);
  }

  console.log(failures === 0 ? "\nAll ledger checks passed.\n" : `\n${failures} check(s) failed.\n`);
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