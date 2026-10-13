import "dotenv/config";
import { prisma } from "../lib/prisma";

function describeUrl(url: string | undefined) {
  if (!url) return { host: "(DATABASE_URL not set)", database: "-", pooled: false };

  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      database: parsed.pathname.replace("/", "") || "-",
      pooled: parsed.hostname.includes("-pooler"),
    };
  } catch {
    return { host: "(DATABASE_URL is not a valid URL)", database: "-", pooled: false };
  }
}

async function tryCount(table: "users" | "products") {
  try {
    const rows =
      table === "users"
        ? await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM "users"`
        : await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM "products"`;
    return String(rows[0].n);
  } catch {
    return "table missing";
  }
}

async function main() {
  const target = describeUrl(process.env.DATABASE_URL);

  console.log("");
  console.log("Target host     :", target.host);
  console.log("Target database :", target.database);
  console.log("Pooled host     :", target.pooled);

  const info = await prisma.$queryRaw<
    { version: string; database: string; db_user: string }[]
  >`SELECT version() AS version, current_database() AS database, current_user AS db_user`;

  console.log("");
  console.log("Connected       : yes");
  console.log("Server          :", info[0].version.split(" on ")[0]);
  console.log("Database        :", info[0].database);
  console.log("Connected as    :", info[0].db_user);

  const tables = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      AND table_name <> '_prisma_migrations'`;

  console.log("App tables      :", String(tables[0].n));

  try {
    const migrations = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL ORDER BY started_at`;
    console.log("Migrations      :", migrations.length);
    migrations.forEach((m) => console.log("   -", m.migration_name));
  } catch {
    console.log("Migrations      : none applied yet (run: npx prisma migrate deploy)");
  }

  console.log("Users           :", await tryCount("users"));
  console.log("Products        :", await tryCount("products"));
  console.log("");
}

main()
  .catch((error) => {
    console.error("\nCould not connect or query the database:\n");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });