import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { checkRateLimitAsync, RATE_LIMITS } from "@/lib/rate-limit";

type InvitationWithOrg = Prisma.TeamInvitationGetPayload<{ include: { org: true } }>;

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
 * Body: { firstName: string, lastName: string, roleTitle?: string, token?: string }
 *
 * `token` is the per-invitation UUID emailed in the invite link. When supplied,
 * it scopes the lookup to a single invitation, preventing cross-org hijack
 * (PRO-168). When absent, the route falls back to email-only lookup but
 * rejects ambiguous cases where multiple pending invitations exist for the
 * same email — forcing the user to disambiguate via the invitation link.
 */
export const POST = withApiHandler(
  async (req: NextRequest) => {
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

    // Rate limit: 5 requests per minute per supabase user — Redis-backed (PRO-170)
    const limit = await checkRateLimitAsync(
      `onboarding:${supabaseUser.id}`,
      RATE_LIMITS.onboarding,
      "onboarding",
    );
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) },
        },
      );
    }

    const body = await req.json();
    const firstName = String(body.firstName || "").trim();
    const lastName = String(body.lastName || "").trim();
    const inviteToken =
      typeof body.token === "string" && body.token.length > 0 ? body.token : null;

    // PRO-174: enforce length on every path (not just the OAuth branch).
    if (firstName.length > 100 || lastName.length > 100) {
      return NextResponse.json({ error: "Name is too long" }, { status: 400 });
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
      // PRO-172: never link a Supabase account to a deactivated CLI user.
      if (!cliUser.isActive) {
        return NextResponse.json({ error: "Account is not active" }, { status: 403 });
      }
      // PRO-168: Scope by cliUser.orgId so an attacker who controls a
      // different org cannot hijack this CLI user via a newer PENDING invite.
      const cliInvitation = await prisma.teamInvitation.findFirst({
        where: {
          email: supabaseUser.email!,
          orgId: cliUser.orgId,
          status: "PENDING",
        },
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
      // Defense-in-depth: if a token was supplied, it must match the
      // invitation we just resolved by orgId.
      if (inviteToken && inviteToken !== cliInvitation.token) {
        return NextResponse.json({ error: "No matching invitation found." }, { status: 403 });
      }

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

    // Standard OAuth / new-user path
    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: "First name and last name are required" },
        { status: 400 }
      );
    }

    // PRO-168: prefer token-based lookup; fall back to email but reject when
    // multiple pending invitations exist (cross-org hijack window).
    let invitation: InvitationWithOrg | null = null;

    if (inviteToken) {
      invitation = await prisma.teamInvitation.findUnique({
        where: { token: inviteToken },
        include: { org: true },
      });
      if (!invitation || invitation.email !== supabaseUser.email) {
        return NextResponse.json(
          { error: "Invalid or expired invitation." },
          { status: 403 }
        );
      }
      if (invitation.status !== "PENDING") {
        return NextResponse.json(
          { error: "Invalid or expired invitation." },
          { status: 410 }
        );
      }
    } else {
      const candidates = await prisma.teamInvitation.findMany({
        where: { email: supabaseUser.email, status: "PENDING" },
        include: { org: true },
      });
      if (candidates.length === 0) {
        return NextResponse.json(
          { error: "No pending invitation found for this email. Contact your administrator." },
          { status: 403 }
        );
      }
      if (candidates.length > 1) {
        return NextResponse.json(
          {
            error:
              "Multiple pending invitations exist for this email. Please use the link from your invitation email.",
          },
          { status: 409 }
        );
      }
      invitation = candidates[0];
    }

    // Check if invitation is expired
    if (new Date() > invitation.expiresAt) {
      return NextResponse.json(
        { error: "This invitation has expired. Ask your administrator to resend it." },
        { status: 410 }
      );
    }

    // Create Prisma User + mark invitation as accepted in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Re-check invitation status (guard against race conditions)
      const inv = await tx.teamInvitation.findUnique({
        where: { id: invitation!.id },
      });
      if (!inv || inv.status !== "PENDING") {
        throw new Error("Invitation is no longer valid");
      }

      const user = await tx.user.create({
        data: {
          supabaseId: supabaseUser.id,
          email: supabaseUser.email!,
          name: `${firstName} ${lastName}`,
          role: invitation!.role,
          orgId: invitation!.orgId,
          isActive: true,
        },
      });

      await tx.teamInvitation.update({
        where: { id: invitation!.id },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });

      return { userId: user.id, orgSlug: invitation!.org.slug };
    });

    return NextResponse.json({ success: true, ...result });
  },
  { module: "onboarding" }
);
