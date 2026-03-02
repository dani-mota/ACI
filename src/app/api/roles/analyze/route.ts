import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { runRoleBuilderPipeline } from "@/lib/role-builder/pipeline";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = ["TA_LEADER", "ADMIN"];

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json() as {
      sourceType: "JD_UPLOAD" | "TEMPLATE_CLONE" | "MANUAL_ENTRY";
      text?: string;
      templateSlug?: string;
      formData?: {
        title: string;
        description?: string;
        responsibilities?: string;
        skills?: string;
        environment?: string;
        experienceLevel?: string;
        safetyCritical?: boolean;
        qualityCritical?: boolean;
      };
    };

    if (!body.sourceType) {
      return NextResponse.json({ error: "sourceType is required" }, { status: 400 });
    }

    // For JD_UPLOAD, require text
    if (body.sourceType === "JD_UPLOAD" && (!body.text || body.text.trim().length < 50)) {
      return NextResponse.json(
        { error: "Job description text must be at least 50 characters" },
        { status: 400 }
      );
    }

    // For TEMPLATE_CLONE, fetch the template role weights/cutlines from DB
    let templateWeights: Record<string, number> | undefined;
    let templateCutlines: { technicalAptitude: number; behavioralIntegrity: number; learningVelocity: number } | undefined;

    if (body.sourceType === "TEMPLATE_CLONE" && body.templateSlug) {
      const templateRole = await prisma.role.findUnique({
        where: { slug: body.templateSlug },
        include: {
          compositeWeights: { where: { effectiveTo: null } },
          cutlines: true,
        },
      });

      if (templateRole) {
        templateWeights = Object.fromEntries(
          templateRole.compositeWeights.map((w) => [w.constructId, Math.round(w.weight * 100)])
        );
        const cutline = templateRole.cutlines[0];
        if (cutline) {
          templateCutlines = {
            technicalAptitude: cutline.technicalAptitude,
            behavioralIntegrity: cutline.behavioralIntegrity,
            learningVelocity: cutline.learningVelocity,
          };
        }
      }
    }

    const result = await runRoleBuilderPipeline({
      sourceType: body.sourceType,
      rawText: body.text,
      templateSlug: body.templateSlug,
      templateWeights,
      templateCutlines,
      formData: body.formData,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Role analyze error:", error);
    return NextResponse.json(
      { error: "Analysis failed. Please try again or use the 'Start from Template' option." },
      { status: 500 }
    );
  }
}
