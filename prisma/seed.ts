import { existsSync, readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";

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

async function main(): Promise<void> {
  loadDotEnvIfPresent();
  console.log("No seed data to apply.");
}

main()
  .then(() => {
    console.log("Seed completed");
  })
  .catch((error) => {
    console.error("Seed failed", error);
    process.exit(1);
  });
