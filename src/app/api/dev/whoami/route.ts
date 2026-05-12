import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { withApiHandler } from "@/lib/api-handler";

/**
 * Dev-only session inspector. Returns the resolved AppSession (post
 * impersonation-cookie overrides) so the dev role switcher can show
 * effective state and so QA can verify user.id during testing.
 */
export const GET = withApiHandler(
  async () => {
    if (process.env.NODE_ENV !== "development") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const session = await getSession();
    if (!session) return NextResponse.json({ session: null });
    return NextResponse.json({ user: session.user });
  },
  { module: "dev/whoami" },
);
