import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";

function isStrongPassword(p: string): boolean {
  return p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /\d/.test(p);
}

/**
 * POST /api/team/accept — Accept a team invitation and create account
 * Public route — no auth required (the user doesn't have an account yet)
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit: 10 requests per minute per IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const limit = checkRateLimit(`team-accept:${ip}`, { maxRequests: 10, windowMs: 60_000 });
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const body = await request.json();
    const { token, name, password } = body as {
      token?: string;
      name?: string;
      password?: string;
    };

    if (!token || !name?.trim() || !password) {
      return NextResponse.json({ error: "Token, name, and password are required" }, { status: 400 });
    }

    if (!isStrongPassword(password)) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters with uppercase, lowercase, and a number" },
        { status: 400 }
      );
    }

    // Look up the invitation
    const invitation = await prisma.teamInvitation.findUnique({
      where: { token },
      include: { org: { select: { id: true, name: true, slug: true } } },
    });

    if (!invitation) {
      return NextResponse.json({ error: "Invalid invitation" }, { status: 404 });
    }

    if (invitation.status !== "PENDING") {
      return NextResponse.json({ error: "This invitation has already been used" }, { status: 409 });
    }

    if (invitation.expiresAt <= new Date()) {
      return NextResponse.json({ error: "This invitation has expired" }, { status: 410 });
    }

    // Check if email already has a Prisma user in this org
    const existingUser = await prisma.user.findFirst({
      where: { email: invitation.email, orgId: invitation.orgId },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please log in instead." },
        { status: 409 }
      );
    }

    // Create Supabase auth user
    // Follow the same pattern as provision-org.ts
    const supabase = getSupabaseAdmin();
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: invitation.email,
      password,
      email_confirm: true,
      user_metadata: { name: name.trim() },
    });

    if (authError || !authData.user) {
      // Check if user already exists in Supabase (signed up through another path)
      if (authError?.message?.includes("already been registered")) {
        return NextResponse.json(
          { error: "An account with this email already exists. Please log in instead." },
          { status: 409 }
        );
      }
      console.error("Failed to create Supabase auth user:", authError?.message);
      return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
    }

    const supabaseUserId = authData.user.id;

    // Atomically: create Prisma user + mark invitation as accepted
    // This prevents race conditions on double-submit
    try {
      await prisma.$transaction(async (tx) => {
        // Re-check invitation status inside transaction (race condition guard)
        const inv = await tx.teamInvitation.findUnique({ where: { id: invitation.id } });
        if (!inv || inv.status !== "PENDING") {
          throw new Error("INVITATION_ALREADY_USED");
        }

        // Create user — same pattern as provision-org.ts
        await tx.user.create({
          data: {
            supabaseId: supabaseUserId,
            email: invitation.email,
            name: name.trim(),
            role: invitation.role,
            orgId: invitation.orgId,
          },
        });

        // Mark invitation as accepted
        await tx.teamInvitation.update({
          where: { id: invitation.id },
          data: { status: "ACCEPTED", acceptedAt: new Date() },
        });
      });
    } catch (txErr) {
      // Clean up Supabase user if transaction failed
      try {
        await supabase.auth.admin.deleteUser(supabaseUserId);
      } catch {
        console.warn(`Failed to clean up Supabase user ${supabaseUserId}`);
      }

      if ((txErr as Error).message === "INVITATION_ALREADY_USED") {
        return NextResponse.json(
          { error: "This invitation has already been used" },
          { status: 409 }
        );
      }

      console.error("Transaction failed:", txErr);
      return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
    }

    // Log the action
    await prisma.activityLog.create({
      data: {
        entityType: "TeamInvitation",
        entityId: invitation.id,
        action: "TEAM_INVITE_ACCEPTED",
        actorId: null,
        metadata: {
          email: invitation.email,
          role: invitation.role,
          orgId: invitation.orgId,
        },
      },
    });

    return NextResponse.json({ success: true, orgSlug: invitation.org.slug });
  } catch (error) {
    console.error("Accept invitation error:", error);
    return NextResponse.json({ error: "Failed to accept invitation" }, { status: 500 });
  }
}
