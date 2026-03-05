import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canManageTeam, canAssignRole } from "@/lib/rbac";
import type { AppUserRole } from "@/lib/rbac";
import { sendEmail } from "@/lib/email/resend";
import { buildAccessApprovedEmail } from "@/lib/email/templates/access-approved";
import { buildAccessRejectedEmail } from "@/lib/email/templates/access-rejected";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://aci-rho.vercel.app";

/**
 * PATCH /api/team/access-requests/[id]
 * TA_LEADER+: approve or reject an org-scoped access request.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageTeam(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { action } = body;

  const accessRequest = await prisma.accessRequest.findUnique({ where: { id } });
  if (!accessRequest || accessRequest.orgId !== session.user.orgId) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (accessRequest.status !== "PENDING") {
    return NextResponse.json({ error: "Request already processed" }, { status: 409 });
  }

  if (action === "approve") {
    const { role } = body as { role?: string };

    if (!role) {
      return NextResponse.json({ error: "Role is required" }, { status: 400 });
    }

    if (!canAssignRole(session.user.role, role as AppUserRole)) {
      return NextResponse.json({ error: "You cannot assign this role" }, { status: 403 });
    }

    // Step 1: Create Supabase auth user via invite link
    // Same pattern as /api/access-requests/[id] (admin approval)
    let supabaseUserId: string | null = null;
    let setupUrl = `${APP_URL}/forgot-password`;
    const callbackUrl = `${APP_URL}/auth/callback?next=/update-password`;

    try {
      const { data: linkData, error: linkError } =
        await getSupabaseAdmin().auth.admin.generateLink({
          type: "invite",
          email: accessRequest.email,
          options: { redirectTo: callbackUrl },
        });

      if (linkError) {
        console.error("generateLink (invite) failed:", linkError.message);
        const { data: magicData, error: magicError } =
          await getSupabaseAdmin().auth.admin.generateLink({
            type: "magiclink",
            email: accessRequest.email,
            options: { redirectTo: callbackUrl },
          });
        if (magicError) {
          console.error("generateLink (magiclink) also failed:", magicError.message);
        } else if (magicData?.user) {
          supabaseUserId = magicData.user.id;
          setupUrl = magicData.properties.action_link;
        }
      } else if (linkData) {
        supabaseUserId = linkData.user.id;
        setupUrl = linkData.properties.action_link;
      }
    } catch (err) {
      console.error("Supabase admin API error:", err);
    }

    if (!supabaseUserId) {
      return NextResponse.json(
        { error: "Failed to create auth account. Please try again." },
        { status: 500 }
      );
    }

    // Step 2: Prisma transaction — create user + update request
    try {
      await prisma.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            supabaseId: supabaseUserId,
            email: accessRequest.email,
            name: `${accessRequest.firstName} ${accessRequest.lastName}`,
            role: role as any,
            orgId: session.user.orgId,
            isActive: true,
          },
        });

        await tx.accessRequest.update({
          where: { id },
          data: {
            status: "APPROVED",
            reviewedBy: session.user.id,
            reviewedAt: new Date(),
          },
        });
      });
    } catch (err) {
      if (supabaseUserId) {
        console.error(
          `DB transaction failed after creating Supabase user ${supabaseUserId} for ${accessRequest.email}. Manual cleanup may be needed.`,
          err
        );
      }
      return NextResponse.json({ error: "Failed to approve request" }, { status: 500 });
    }

    // Step 3: Send approval email
    try {
      const { subject, html } = buildAccessApprovedEmail({
        userName: accessRequest.firstName,
        setupUrl,
        loginUrl: `${APP_URL}/login`,
      });
      await sendEmail({ to: accessRequest.email, subject, html });
    } catch {
      // Email failure should not block approval
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        entityType: "AccessRequest",
        entityId: id,
        action: "ACCESS_REQUEST_APPROVED",
        actorId: session.user.id,
        metadata: { email: accessRequest.email, role, orgId: session.user.orgId },
      },
    });

    return NextResponse.json({ success: true });
  }

  if (action === "reject") {
    const { rejectionReason } = body;

    // Validate rejection reason
    const safeReason = typeof rejectionReason === "string"
      ? rejectionReason.slice(0, 1000) || null
      : null;

    await prisma.accessRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
        rejectionReason: safeReason,
      },
    });

    try {
      const { subject, html } = buildAccessRejectedEmail({
        userName: accessRequest.firstName,
        rejectionReason: safeReason || undefined,
      });
      await sendEmail({ to: accessRequest.email, subject, html });
    } catch {
      // Email failure shouldn't block rejection
    }

    await prisma.activityLog.create({
      data: {
        entityType: "AccessRequest",
        entityId: id,
        action: "ACCESS_REQUEST_REJECTED",
        actorId: session.user.id,
        metadata: { email: accessRequest.email, orgId: session.user.orgId },
      },
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
