import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";

/**
 * GET /api/cron/expire-invitations
 * Fix: PRO-35 — Marks expired PENDING invitations as EXPIRED.
 * Runs daily via Vercel cron. Protected by CRON_SECRET.
 */
export const GET = withApiHandler(
  async (req) => {
    // Fix: PRO-65 — explicit null guard prevents "Bearer undefined" bypass
    const secret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("Authorization");
    if (!secret || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await prisma.assessmentInvitation.updateMany({
      where: {
        status: "PENDING",
        expiresAt: { lt: new Date() },
      },
      data: { status: "EXPIRED" },
    });

    return NextResponse.json({ expired: result.count });
  },
  { module: "cron/expire-invitations" }
);
