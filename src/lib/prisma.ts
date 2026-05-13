import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const isDev = process.env.NODE_ENV === "development";
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    // PRO-194: env-configurable with conservative defaults.
    // - Dev (10): HMR + concurrent tabs need headroom for the rare
    //   inadvertent outer-client call inside a transaction, AND for
    //   intentional parallel work (page renders pulling data while a
    //   route handler also queries).
    // - Prod (5): Neon's pooled endpoint multiplexes from its side;
    //   a conservative app-side limit avoids exhausting Neon's
    //   per-project connection budget across prod + preview deploys.
    // Override via DATABASE_POOL_MAX env var once Neon plan limits
    // have been verified and tuned. Filed as follow-up.
    max: parseInt(
      process.env.DATABASE_POOL_MAX ?? (isDev ? "10" : "5"),
      10,
    ),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
