import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canView } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { generateRoleBriefPDF } from "@/lib/role-builder/pdf";
import type { ResearchRationale, GeneratedWeights } from "@/lib/role-builder/pipeline";
import { withApiHandler } from "@/lib/api-handler";

export const GET = withApiHandler(
  async (_req: NextRequest, ctx) => {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canView(session.user.role, "pdfExport")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        compositeWeights: {
          where: { effectiveTo: null },
          select: { constructId: true, weight: true },
        },
        cutlines: { select: { technicalAptitude: true, behavioralIntegrity: true, learningVelocity: true } },
      },
    });

    if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });
    if (role.orgId !== session.user.orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!role.researchRationale) {
      return NextResponse.json({ error: "No research rationale available for this role" }, { status: 404 });
    }

    // Build weights map (stored as 0–1, display as 0–100)
    const weightsMap: Record<string, number> = {};
    for (const cw of role.compositeWeights) {
      weightsMap[cw.constructId] = Math.round(cw.weight * 100);
    }

    const cutline = role.cutlines[0];
    const generatedWeights: GeneratedWeights = {
      complexityLevel: (role.complexityLevel as GeneratedWeights["complexityLevel"]) ?? "MEDIUM",
      closestTemplate: "custom",
      weights: weightsMap,
      cutlines: {
        technicalAptitude: cutline?.technicalAptitude ?? 50,
        behavioralIntegrity: cutline?.behavioralIntegrity ?? 50,
        learningVelocity: cutline?.learningVelocity ?? 50,
        overallMinimum: 0,
      },
      confidenceScores: {},
      weightEvidence: {},
    };

    const rationale = role.researchRationale as unknown as ResearchRationale;

    const pdfBuffer = await generateRoleBriefPDF({
      roleName: role.name,
      complexityLevel: generatedWeights.complexityLevel,
      closestTemplate: generatedWeights.closestTemplate,
      rationale,
      weights: generatedWeights,
      generatedAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    });

    const slug = role.slug ?? role.name.toLowerCase().replace(/\s+/g, "-");
    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="aci-role-brief-${slug}.pdf"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  },
  { module: "rationale-pdf" }
);
