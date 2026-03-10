import { NextRequest, NextResponse } from "next/server";
import { ROLE_LEVEL } from "@/lib/rbac";

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { role } = await request.json();
  const response = NextResponse.json({ ok: true });

  if (!role || role === "reset") {
    response.cookies.delete("__dev_role");
  } else if (Object.keys(ROLE_LEVEL).includes(role)) {
    response.cookies.set("__dev_role", role, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
    });
  } else {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  return response;
}
