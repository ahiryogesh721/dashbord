import { existsSync, readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";

import { PrismaClient } from "@prisma/client";

function loadDotEnvIfPresent(): void {
  // `npm run prisma:seed` (and `tsx prisma/seed.ts`) do not automatically load `.env`.
  // Prisma CLI and Next do; keep seed behavior consistent without adding a dependency.
  const envPath = resolvePath(process.cwd(), ".env");
  if (!existsSync(envPath)) return;

  const contents = readFileSync(envPath, "utf8");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq <= 0) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    // Preserve existing env vars (e.g. CI, shell exports).
    if (process.env[key] !== undefined) continue;

    // Strip common quoting styles.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

const initialSalesReps: Array<{
  name: string;
  email: string;
  phone: string;
  maxOpenLeads: number;
}> = [
  {
    name: "Sarah Miller",
    email: "sarah.miller@example.com",
    phone: "+15550000001",
    maxOpenLeads: 80,
  },
  {
    name: "David Khan",
    email: "david.khan@example.com",
    phone: "+15550000002",
    maxOpenLeads: 80,
  },
];

async function main(): Promise<void> {
  loadDotEnvIfPresent();
  const prisma = new PrismaClient();

  try {
    for (const rep of initialSalesReps) {
      await prisma.salesRep.upsert({
        where: { email: rep.email },
        update: {
          name: rep.name,
          phone: rep.phone,
          maxOpenLeads: rep.maxOpenLeads,
          isActive: true,
        },
        create: {
          name: rep.name,
          email: rep.email,
          phone: rep.phone,
          maxOpenLeads: rep.maxOpenLeads,
          isActive: true,
        },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    console.log("Seed completed");
  })
  .catch((error) => {
    console.error("Seed failed", error);
    process.exit(1);
  });
