import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

try {
  const count = await prisma.user.count();
  if (count > 0) {
    console.log(`Demo seed skipped — ${count} user(s) already in database.`);
    process.exit(0);
  }

  console.log("Empty database detected — seeding demo users and tickets...");
  const result = spawnSync("npx", ["tsx", "prisma/seed.ts"], {
    stdio: "inherit",
    cwd: serverRoot,
    shell: true,
  });
  process.exit(result.status === 0 ? 0 : 1);
} finally {
  await prisma.$disconnect();
}
