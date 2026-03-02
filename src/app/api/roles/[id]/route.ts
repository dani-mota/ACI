import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!["TA_LEADER", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const role = await prisma.role.findUnique({
      where: { id },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    });

    if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });
    if (!role.isCustom) return NextResponse.json({ error: "Cannot edit system default roles" }, { status: 403 });
    if (role.orgId !== session.user.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json() as {
      name?: string;
      description?: string;
      weights?: Record<string, number>;
      cutlines?: {
        technicalAptitude: number;
        behavioralIntegrity: number;
        learningVelocity: number;
        overallMinimum?: number;
      };
      changeNote?: string;
      hiringIntelligence?: unknown;
    };

    const nextVersion = (role.versions[0]?.versionNumber ?? 0) + 1;

    await prisma.$transaction(async (tx) => {
      // Update role metadata
      await tx.role.update({
        where: { id },
        data: {
          name: body.name ?? role.name,
          description: body.description ?? role.description,
          hiringIntelligence: body.hiringIntelligence ?? role.hiringIntelligence ?? undefined,
        },
      });

      // Update weights if provided
      if (body.weights) {
        // Close existing active weights
        await tx.compositeWeight.updateMany({
          where: { roleId: id, effectiveTo: null },
          data: { effectiveTo: new Date() },
        });
        // Create new weights
        await tx.compositeWeight.createMany({
          data: Object.entries(body.weights).map(([constructId, weight]) => ({
            roleId: id,
            constructId,
            weight: weight / 100,
            version: nextVersion,
            source: "CLIENT_CUSTOMIZED" as const,
          })),
        });
      }

      // Update cutlines if provided
      if (body.cutlines) {
        await tx.cutline.updateMany({
          where: { roleId: id },
          data: {
            technicalAptitude: body.cutlines.technicalAptitude,
            behavioralIntegrity: body.cutlines.behavioralIntegrity,
            learningVelocity: body.cutlines.learningVelocity,
            overallMinimum: body.cutlines.overallMinimum ?? null,
          },
        });
      }

      // Create version snapshot
      await tx.roleVersion.create({
        data: {
          roleId: id,
          versionNumber: nextVersion,
          weights: body.weights ?? {},
          cutlines: body.cutlines ?? {},
          changedBy: session.user.id,
          changeNote: body.changeNote ?? "Role updated",
        },
      });
    });

    const updated = await prisma.role.findUnique({ where: { id } });
    return NextResponse.json({ role: updated });
  } catch (error) {
    console.error("Role update error:", error);
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can delete roles" }, { status: 403 });
    }

    const { id } = await params;
    const role = await prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { candidates: true } } },
    });

    if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });
    if (!role.isCustom) return NextResponse.json({ error: "Cannot delete system default roles" }, { status: 403 });
    if (role.orgId !== session.user.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (role._count.candidates > 0) {
      return NextResponse.json(
        { error: `Cannot delete role with ${role._count.candidates} active candidate(s). Reassign them first.` },
        { status: 409 }
      );
    }

    await prisma.role.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Role delete error:", error);
    return NextResponse.json({ error: "Failed to delete role" }, { status: 500 });
  }
}
