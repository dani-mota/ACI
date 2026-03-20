import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getDemoOrgId } from "@/lib/data";
import { checkRateLimitAsync } from "@/lib/rate-limit"; // Fix: PRO-71

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

function getIndustryFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)aci-tutorial=([^;]+)/);
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1]))?.tutorialIndustry ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  // Fix: PRO-71 — rate limit unauthenticated tutorial endpoint
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rl = await checkRateLimitAsync(`tutorial-roles:${ip}`, { maxRequests: 5, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  try {
    const industry = getIndustryFromCookie(request.headers.get("cookie"));
    const demoOrgId = await getDemoOrgId(industry);
    if (!demoOrgId) {
      return NextResponse.json({ error: "Demo organization not found" }, { status: 404 });
    }

    const body = await request.json() as {
      name: string;
      description?: string;
      sourceType: "JD_UPLOAD" | "TEMPLATE_CLONE" | "MANUAL_ENTRY";
      complexityLevel?: "LOW" | "MEDIUM" | "MEDIUM_HIGH" | "HIGH";
      onetCodes?: string[];
      jobDescriptionText?: string;
      weights: Record<string, number>;
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

    if (!body.weights || Object.keys(body.weights).length !== 12) {
      return NextResponse.json({ error: "Exactly 12 construct weights are required" }, { status: 400 });
    }

    const weightSum = Object.values(body.weights).reduce((s, v) => s + v, 0);
    if (Math.abs(weightSum - 100) > 2) {
      return NextResponse.json({ error: `Weights must sum to 100 (got ${weightSum})` }, { status: 400 });
    }

    // Look up the first user in the demo org for changedBy (required on RoleVersion)
    const demoUser = await prisma.user.findFirst({ where: { orgId: demoOrgId } });

    const slug = await ensureUniqueSlug(generateSlug(body.name.trim()), demoOrgId);

    const role = await prisma.$transaction(async (tx) => {
      const newRole = await tx.role.create({
        data: {
          name: body.name.trim(),
          slug,
          description: body.description,
          orgId: demoOrgId,
          isCustom: true,
          sourceType: body.sourceType,
          complexityLevel: body.complexityLevel ?? null,
          onetCodes: body.onetCodes ?? [],
          jobDescriptionText: body.jobDescriptionText,
          researchRationale: body.researchRationale ?? undefined,
          confidenceScores: body.confidenceScores ?? undefined,
          hiringIntelligence: body.hiringIntelligence ?? undefined,
          jdContext: body.jdContext ?? undefined,
        },
      });

      await tx.compositeWeight.createMany({
        data: Object.entries(body.weights).map(([constructId, weight]) => ({
          roleId: newRole.id,
          constructId,
          weight: weight / 100,
          version: 1,
          source: "CLIENT_CUSTOMIZED" as const,
        })),
      });

      await tx.cutline.create({
        data: {
          roleId: newRole.id,
          orgId: demoOrgId,
          technicalAptitude: body.cutlines.technicalAptitude,
          behavioralIntegrity: body.cutlines.behavioralIntegrity,
          learningVelocity: body.cutlines.learningVelocity,
          overallMinimum: body.cutlines.overallMinimum ?? null,
        },
      });

      if (demoUser) {
        await tx.roleVersion.create({
          data: {
            roleId: newRole.id,
            versionNumber: 1,
            weights: body.weights,
            cutlines: body.cutlines,
            rationale: body.researchRationale ?? undefined,
            changedBy: demoUser.id,
            changeNote: "Tutorial role creation",
          },
        });
      }

      return newRole;
    });

    return NextResponse.json({ role }, { status: 201 });
  } catch (error) {
    console.error("Tutorial role creation error:", error);
    return NextResponse.json({ error: "Failed to create role" }, { status: 500 });
  }
}
