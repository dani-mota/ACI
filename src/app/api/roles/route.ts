import { NextRequest, NextResponse, after } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateContentLibrary } from "@/lib/assessment/content-generation";

const ALLOWED_ROLES = ["TA_LEADER", "ADMIN"];

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

async function ensureUniqueSlug(base: string, orgId: string): Promise<string> {
  let slug = base;
  let attempt = 0;
  while (true) {
    const existing = await prisma.role.findUnique({ where: { slug_orgId: { slug, orgId } } });
    if (!existing) return slug;
    attempt++;
    slug = `${base}-${attempt + 1}`;
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json() as {
      name: string;
      description?: string;
      sourceType: "JD_UPLOAD" | "TEMPLATE_CLONE" | "MANUAL_ENTRY";
      complexityLevel?: "LOW" | "MEDIUM" | "MEDIUM_HIGH" | "HIGH";
      onetCodes?: string[];
      jobDescriptionText?: string;
      weights: Record<string, number>; // constructId → integer 0–100, must sum to 100
      cutlines: {
        technicalAptitude: number;
        behavioralIntegrity: number;
        learningVelocity: number;
        overallMinimum?: number;
      };
      researchRationale?: unknown;
      confidenceScores?: unknown;
      hiringIntelligence?: unknown;
      jdContext?: unknown;
    };

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Role name is required" }, { status: 400 });
    }

    // Validate jdContext size to prevent oversized JSON storage
    if (body.jdContext && JSON.stringify(body.jdContext).length > 10000) {
      return NextResponse.json({ error: "jdContext payload too large" }, { status: 413 });
    }
    if (!body.weights || Object.keys(body.weights).length !== 12) {
      return NextResponse.json({ error: "Exactly 12 construct weights are required" }, { status: 400 });
    }

    const weightSum = Object.values(body.weights).reduce((s, v) => s + v, 0);
    if (Math.abs(weightSum - 100) > 2) {
      return NextResponse.json({ error: `Weights must sum to 100 (got ${weightSum})` }, { status: 400 });
    }

    const slug = await ensureUniqueSlug(generateSlug(body.name.trim()), session.user.orgId);

    const role = await prisma.$transaction(async (tx) => {
      // Create the role
      const newRole = await tx.role.create({
        data: {
          name: body.name.trim(),
          slug,
          description: body.description,
          orgId: session.user.orgId,
          isCustom: true,
          sourceType: body.sourceType,
          complexityLevel: body.complexityLevel ?? null,
          onetCodes: body.onetCodes ?? [],
          jobDescriptionText: body.jobDescriptionText,
          researchRationale: body.researchRationale ?? undefined,
          confidenceScores: body.confidenceScores ?? undefined,
          hiringIntelligence: body.hiringIntelligence ?? undefined,
          jdContext: body.jdContext ?? undefined,
          createdBy: session.user.id,
        },
      });

      // Create 12 composite weights (stored as 0–1 decimals)
      await tx.compositeWeight.createMany({
        data: Object.entries(body.weights).map(([constructId, weight]) => ({
          roleId: newRole.id,
          constructId,
          weight: weight / 100,
          version: 1,
          source: "CLIENT_CUSTOMIZED" as const,
        })),
      });

      // Create cutline
      await tx.cutline.create({
        data: {
          roleId: newRole.id,
          orgId: session.user.orgId,
          technicalAptitude: body.cutlines.technicalAptitude,
          behavioralIntegrity: body.cutlines.behavioralIntegrity,
          learningVelocity: body.cutlines.learningVelocity,
          overallMinimum: body.cutlines.overallMinimum ?? null,
        },
      });

      // Create initial version snapshot
      await tx.roleVersion.create({
        data: {
          roleId: newRole.id,
          versionNumber: 1,
          weights: body.weights,
          cutlines: body.cutlines,
          rationale: body.researchRationale ?? undefined,
          changedBy: session.user.id,
          changeNote: "Initial role creation",
        },
      });

      return newRole;
    });

    // Auto-trigger content generation for custom roles with JD context
    if (!role.isGeneric && body.jdContext) {
      after(() => generateContentLibrary(role.id).catch(console.error));
    }

    return NextResponse.json({ role }, { status: 201 });
  } catch (error) {
    console.error("Role creation error:", error);
    return NextResponse.json({ error: "Failed to create role" }, { status: 500 });
  }
}
