import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { sendEmail } from "@/lib/email/resend";
import { buildAccessApprovedEmail } from "@/lib/email/templates/access-approved";
import { buildAccessRejectedEmail } from "@/lib/email/templates/access-rejected";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://aci-rho.vercel.app";

/**
 * PATCH /api/access-requests/[id]
 * Admin-only: approve or reject an access request.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { action } = body;

  const accessRequest = await prisma.accessRequest.findUnique({ where: { id } });
  if (!accessRequest) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (accessRequest.status !== "PENDING") {
    return NextResponse.json({ error: "Request already processed" }, { status: 409 });
  }

  if (action === "approve") {
    const { orgId, newOrgName, role } = body;

    if (!role) {
      return NextResponse.json({ error: "Role is required" }, { status: 400 });
    }
    if (!orgId && !newOrgName) {
      return NextResponse.json({ error: "Organization is required" }, { status: 400 });
    }

    // Step 1: Create Supabase auth user and get a one-time invite link.
    // generateLink with type "invite" creates the user (if not exists) and
    // returns an action_link the user clicks to set their password.
    let supabaseUserId: string | null = null;
    let setupUrl = `${APP_URL}/login`;

    try {
      const { data: linkData, error: linkError } =
        await getSupabaseAdmin().auth.admin.generateLink({
          type: "invite",
          email: accessRequest.email,
          options: { redirectTo: `${APP_URL}/dashboard` },
        });

      if (linkError) {
        // If the user already exists in Supabase, generate a magic link instead
        console.error("generateLink (invite) failed:", linkError.message);
        const { data: magicData } = await getSupabaseAdmin().auth.admin.generateLink({
          type: "magiclink",
          email: accessRequest.email,
          options: { redirectTo: `${APP_URL}/dashboard` },
        });
        if (magicData?.user) {
          supabaseUserId = magicData.user.id;
          setupUrl = magicData.properties.action_link;
        }
        // If both fail, setupUrl stays as the login page — user can use "Forgot Password"
      } else if (linkData) {
        supabaseUserId = linkData.user.id;
        setupUrl = linkData.properties.action_link;
      }
    } catch (err) {
      console.error("Supabase admin API error:", err);
      // Non-fatal — proceed with approval, user can reset password manually
    }

    // Step 2: Prisma transaction — create org (if new) + user + update request
    let result: { userId: string; orgId: string };
    try {
      result = await prisma.$transaction(async (tx) => {
        let assignedOrgId = orgId;

        if (!orgId && newOrgName) {
          const newOrg = await tx.organization.create({
            data: { name: newOrgName },
          });
          assignedOrgId = newOrg.id;
        }

        const user = await tx.user.create({
          data: {
            supabaseId: supabaseUserId,
            email: accessRequest.email,
            name: `${accessRequest.firstName} ${accessRequest.lastName}`,
            role: role as any,
            orgId: assignedOrgId,
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

        return { userId: user.id, orgId: assignedOrgId };
      });
    } catch (err) {
      // If DB transaction fails after Supabase user was created, log for manual cleanup
      if (supabaseUserId) {
        console.error(
          `DB transaction failed after creating Supabase user ${supabaseUserId} for ${accessRequest.email}. Manual cleanup may be needed.`,
          err
        );
      }
      return NextResponse.json({ error: "Failed to approve request" }, { status: 500 });
    }

    // Step 3: Send approval email with the setup link
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

    return NextResponse.json({ success: true, userId: result.userId });
  }

  if (action === "reject") {
    const { rejectionReason } = body;

    await prisma.accessRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
        rejectionReason: rejectionReason || null,
      },
    });

    // Send rejection email
    try {
      const { subject, html } = buildAccessRejectedEmail({
        userName: accessRequest.firstName,
        rejectionReason,
      });
      await sendEmail({ to: accessRequest.email, subject, html });
    } catch {
      // Email failure shouldn't block rejection
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
