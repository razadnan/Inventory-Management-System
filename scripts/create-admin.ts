import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

const email = (process.env.ADMIN_EMAIL ?? "admin@inventory.local").trim().toLowerCase();
const usingDefaultPassword = !process.env.ADMIN_PASSWORD;
const password = process.env.ADMIN_PASSWORD ?? "Admin@123";

async function main() {
  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: "ADMIN", name: "Administrator" },
    create: { name: "Administrator", email, passwordHash, role: "ADMIN" },
  });

  console.log(`Admin ready: ${user.email}`);

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