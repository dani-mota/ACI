import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ROLE_LEVEL, type AppUserRole } from "@/lib/rbac";
import { generateContentLibrary } from "@/lib/assessment/content-generation";
import { validateContentLibrary } from "@/lib/assessment/content-validation";
import type { ContentLibraryData } from "@/lib/assessment/content-types";
import prisma from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";

/**
 * POST /api/roles/[id]/generate-content
 * Trigger content library generation for a role.
 * Requires TA_LEADER+ permission.
 */
export const POST = withApiHandler(
  async (_req: NextRequest, ctx) => {
    const session = await getSession();
    if (!session || ROLE_LEVEL[session.user.role as AppUserRole] < ROLE_LEVEL.TA_LEADER) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    const user = session.user;

    const { id: roleId } = await ctx.params;

    const role = await prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true, orgId: true, name: true },
    });

    if (!role || role.orgId !== user.orgId) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    // Check for existing GENERATING library
    const existing = await prisma.contentLibrary.findFirst({
      where: { roleId, status: "GENERATING" },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Content generation already in progress", libraryId: existing.id },
        { status: 409 },
      );
    }

    const libraryId = await generateContentLibrary(roleId);

    // Validate the generated content
    const library = await prisma.contentLibrary.findUnique({
      where: { id: libraryId },
      select: { content: true },
    });

    const validation = validateContentLibrary(library?.content as unknown as ContentLibraryData);

    return NextResponse.json({
      libraryId,
      status: "READY",
      validation,
    });
  },
  { module: "generate-content" }
);

/**
 * GET /api/roles/[id]/generate-content
 * Check content library status for a role.
 */
export const GET = withApiHandler(
  async (_req: NextRequest, ctx) => {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: roleId } = await ctx.params;

    // Fix: PRO-70 — org-scope check to prevent IDOR on content library metadata
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true, orgId: true },
    });

    if (!role || role.orgId !== session.user.orgId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const libraries = await prisma.contentLibrary.findMany({
      where: { roleId },
      orderBy: { version: "desc" },
      take: 5,
      select: {
        id: true,
        version: true,
        status: true,
        generationStartedAt: true,
        generationCompletedAt: true,
        errorLog: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ libraries });
  },
  { module: "generate-content" }
);
