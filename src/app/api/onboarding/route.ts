import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";

/**
 * POST /api/onboarding
 *
 * Completes the onboarding process for a new user who has authenticated
 * via OAuth or email/password but doesn't yet have a Prisma User record.
 *
 * The user must have a pending TeamInvitation matching their email, OR be
 * a CLI-provisioned user (already has a Prisma User with null supabaseId
 * that needs linking).
 *
 * Body: { firstName: string, lastName: string, roleTitle?: string }
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 500 });
  }

  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser();

  if (!supabaseUser || !supabaseUser.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user already has a Prisma record
  const existingUser = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser.id },
  });
  if (existingUser) {
    return NextResponse.json({ error: "Already onboarded" }, { status: 409 });
  }

  // Check for a user record that was created by the CLI but hasn't been
  // linked to a Supabase auth account yet (supabaseId is null or different)
  const cliUser = await prisma.user.findUnique({
    where: { email: supabaseUser.email },
  });
  if (cliUser && !cliUser.supabaseId) {
    // CLI-provisioned user — still require a valid pending invitation
    const cliInvitation = await prisma.teamInvitation.findFirst({
      where: { email: supabaseUser.email!, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
    if (!cliInvitation) {
      return NextResponse.json(
        { error: "No pending invitation found for this email. Contact your administrator." },
        { status: 403 }
      );
    }
    if (new Date() > cliInvitation.expiresAt) {
      return NextResponse.json(
        { error: "This invitation has expired. Ask your administrator to resend it." },
        { status: 410 }
      );
    }

    // Link the CLI-provisioned user to this Supabase account + mark invitation accepted
    const body = await request.json();
    const firstName = String(body.firstName || "").trim();
    const lastName = String(body.lastName || "").trim();

    const updateData: Record<string, unknown> = {
      supabaseId: supabaseUser.id,
    };
    if (firstName && lastName) {
      updateData.name = `${firstName} ${lastName}`;
    }

    await prisma.$transaction(async (tx) => {
      const inv = await tx.teamInvitation.findUnique({ where: { id: cliInvitation.id } });
      if (!inv || inv.status !== "PENDING") {
        throw new Error("Invitation is no longer valid");
      }
      await tx.user.update({ where: { id: cliUser.id }, data: updateData });
      await tx.teamInvitation.update({
        where: { id: cliInvitation.id },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });
    });

    return NextResponse.json({ success: true, userId: cliUser.id });
  }

  // Parse body
  const body = await request.json();
  const firstName = String(body.firstName || "").trim();
  const lastName = String(body.lastName || "").trim();

  if (!firstName || !lastName) {
    return NextResponse.json(
      { error: "First name and last name are required" },
      { status: 400 }
    );
  }

  if (firstName.length > 100 || lastName.length > 100) {
    return NextResponse.json({ error: "Name is too long" }, { status: 400 });
  }

  // Find a pending invitation for this email
  const invitation = await prisma.teamInvitation.findFirst({
    where: {
      email: supabaseUser.email,
      status: "PENDING",
    },
    include: { org: true },
    orderBy: { createdAt: "desc" },
  });

  if (!invitation) {
    return NextResponse.json(
      { error: "No pending invitation found for this email. Contact your administrator." },
      { status: 403 }
    );
  }

  // Check if invitation is expired
  if (new Date() > invitation.expiresAt) {
    return NextResponse.json(
      { error: "This invitation has expired. Ask your administrator to resend it." },
      { status: 410 }
    );
  }

  // Create Prisma User + mark invitation as accepted in a transaction
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Re-check invitation status (guard against race conditions)
      const inv = await tx.teamInvitation.findUnique({
        where: { id: invitation.id },
      });
      if (!inv || inv.status !== "PENDING") {
        throw new Error("Invitation is no longer valid");
      }

      const user = await tx.user.create({
        data: {
          supabaseId: supabaseUser.id,
          email: supabaseUser.email!,
          name: `${firstName} ${lastName}`,
          role: invitation.role,
          orgId: invitation.orgId,
          isActive: true,
        },
      });

      await tx.teamInvitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });

      return { userId: user.id, orgSlug: invitation.org.slug };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[Onboarding] Transaction failed:", err);
    return NextResponse.json(
      { error: "Failed to complete onboarding" },
      { status: 500 }
    );
  }
}
