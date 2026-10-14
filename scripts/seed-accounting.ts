import "dotenv/config";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import { INDIA_COA_TEMPLATE } from "../modules/accounting/coa-template";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "admin@inventory.local").trim().toLowerCase();
const ORG_NAME = process.env.ORG_NAME?.trim();

/** Financial year containing `date`, for a year that starts in `startMonth` (1-12). */
function financialYearFor(date: Date, startMonth: number) {
  const startYear = date.getMonth() + 1 >= startMonth ? date.getFullYear() : date.getFullYear() - 1;
  const startDate = new Date(Date.UTC(startYear, startMonth - 1, 1));
  const endDate = new Date(Date.UTC(startYear + 1, startMonth - 1, 0));
  const label =
    startMonth === 1
      ? String(startYear)
      : `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;

  return { label, startDate, endDate };
}

async function main() {
  const admin = await prisma.user.findFirst({
    where: { email: ADMIN_EMAIL },
    include: { organization: true },
  });

  const organization = ORG_NAME
    ? await prisma.organization.findFirst({ where: { name: ORG_NAME } })
    : admin?.organization;

  if (!organization) {
    throw new Error(
      ORG_NAME
        ? `No organization named "${ORG_NAME}".`
        : `No user ${ADMIN_EMAIL}. Run scripts/create-admin.ts first, or set ORG_NAME.`
    );
  }

  const existing = await prisma.account.count({ where: { organizationId: organization.id } });

  if (existing > 0) {
    console.log(`"${organization.name}" already has ${existing} accounts. Nothing to do.`);
    return;
  }

  const fy = financialYearFor(new Date(), organization.financialYearStartMonth);

  // Ids are created here so every account, including parents, goes in with ONE
  // query. That keeps the transaction short even on a distant database.
  const idByCode = new Map(INDIA_COA_TEMPLATE.map((account) => [account.code, randomUUID()]));

  await prisma.$transaction(async (tx) => {
    await tx.financialYear.create({
      data: { organizationId: organization.id, ...fy },
    });

    await tx.documentSequence.create({
      data: {
        organizationId: organization.id,
        seriesKey: "JV",
        fiscalYear: fy.label,
        prefix: "JV",
        nextNumber: 1,
      },
    });

    await tx.account.createMany({
      data: INDIA_COA_TEMPLATE.map((account) => ({
        id: idByCode.get(account.code)!,
        organizationId: organization.id,
        code: account.code,
        name: account.name,
        type: account.type,
        isGroup: account.isGroup ?? false,
        isSystem: account.isSystem ?? false,
        cashFlowClass: account.cashFlowClass ?? null,
        parentId: account.parentCode ? idByCode.get(account.parentCode)! : null,
      })),
    });

    await tx.auditLog.create({
      data: {
        organizationId: organization.id,
        userId: admin?.organizationId === organization.id ? admin.id : null,
        action: "ACCOUNTING_SETUP",
        entityType: "Organization",
        entityId: organization.id,
        after: { financialYear: fy.label, accounts: INDIA_COA_TEMPLATE.length },
      },
    });
  });

  console.log(`Accounting set up for "${organization.name}".`);
  console.log(`Financial year ${fy.label}, ${INDIA_COA_TEMPLATE.length} accounts, journal series JV.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });