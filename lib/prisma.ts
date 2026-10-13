import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined");
}

// Generous timeouts: connecting to a database in another region (or one that
// is waking from sleep) can take several seconds. Idle connections are kept
// for a minute so repeated requests do not pay the connection cost each time.
const adapter = new PrismaPg({
  connectionString,
  max: 5,
  connectionTimeoutMillis: 20_000,
  idleTimeoutMillis: 60_000,
});

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    transactionOptions: {
      maxWait: 15_000,
      timeout: 30_000,
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}