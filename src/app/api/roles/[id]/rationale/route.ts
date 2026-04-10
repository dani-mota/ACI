import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";

export const GET = withApiHandler(
  async (_req: NextRequest, ctx) => {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await ctx.params;
    const role = await prisma.role.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        orgId: true,
        researchRationale: true,
        confidenceScores: true,
        complexityLevel: true,
        onetCodes: true,
        sourceType: true,
      },
    });

    if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });
    if (role.orgId !== session.user.orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      roleId: role.id,
      roleName: role.name,
      complexityLevel: role.complexityLevel,
      onetCodes: role.onetCodes,
      sourceType: role.sourceType,
      researchRationale: role.researchRationale,
      confidenceScores: role.confidenceScores,
    });
  },
  { module: "rationale" }
);
