import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

const email = (process.env.ADMIN_EMAIL ?? "admin@inventory.local").trim().toLowerCase();
const organizationName = (process.env.ORG_NAME ?? "My Organization").trim();
const usingDefaultPassword = !process.env.ADMIN_PASSWORD;
const password = process.env.ADMIN_PASSWORD ?? "Admin@123";

async function main() {
  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Same rule as the app: a user belongs to exactly one organization.
  const existing = await prisma.user.findFirst({
    where: { email },
    include: { organization: true },
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash, role: "ADMIN", status: "ACTIVE" },
    });

    console.log(`Updated admin ${email} in organization "${existing.organization.name}".`);
  } else {
    const created = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: organizationName },
      });

      const user = await tx.user.create({
        data: {
          organizationId: organization.id,
          name: "Administrator",
          email,
          passwordHash,
          role: "ADMIN",
        },
      });

      return { organization, user };
    });

    console.log(
      `Created organization "${created.organization.name}" with admin ${created.user.email}.`
    );
  }

  if (usingDefaultPassword) {
    console.log("Used the default development password. Set ADMIN_PASSWORD before running this on production.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });