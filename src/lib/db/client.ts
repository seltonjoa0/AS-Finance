import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { getServerEnv } from "@/lib/env";
import { secureNeonRuntimeUrl } from "@/lib/db/neon-connection";

const globalForDatabase = globalThis as unknown as {
  database?: PrismaClient;
};

export function database() {
  if (!globalForDatabase.database) {
    const { DATABASE_URL } = getServerEnv();
    const adapter = new PrismaPg({
      connectionString: secureNeonRuntimeUrl(DATABASE_URL),
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 10_000,
      max: 5,
      allowExitOnIdle: true,
    });

    globalForDatabase.database = new PrismaClient({ adapter });
  }

  return globalForDatabase.database;
}
