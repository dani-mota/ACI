import { NextResponse } from "next/server";
import { MODE_ACCESS, EMPLOYEE_MODE_ACCESS } from "@/lib/rbac";
import { withApiHandler } from "@/lib/api-handler";

/**
 * Dev-only impersonation. Sets `__dev_role` (Candidate Mode slot) or
 * `__dev_employee_role` (Employee Mode slot) based on the requested
 * slot. The cookies are then picked up by `getSession()` and override
 * the corresponding fields on AppSession.user.
 *
 * PRO-133: extended to handle Employee Mode roles + a "reset-all" slot
 * that clears both cookies simultaneously.
 */
export const POST = withApiHandler(
  async (req) => {
    if (process.env.NODE_ENV !== "development") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = (await req.json()) as { slot?: string; role?: string };
    const slot = body.slot ?? "candidate";
    const role = body.role;
    const response = NextResponse.json({ ok: true });

    const candidateRoleKeys = Object.keys(MODE_ACCESS);
    const employeeRoleKeys = Object.keys(EMPLOYEE_MODE_ACCESS);

    if (slot === "reset-all") {
      response.cookies.delete("__dev_role");
      response.cookies.delete("__dev_employee_role");
      return response;
    }

    if (!role) {
      return NextResponse.json({ error: "Missing role" }, { status: 400 });
    }

    if (slot === "candidate") {
      if (role === "reset") {
        response.cookies.delete("__dev_role");
      } else if (candidateRoleKeys.includes(role)) {
        response.cookies.set("__dev_role", role, {
          path: "/",
          httpOnly: false,
          sameSite: "lax",
        });
      } else {
        return NextResponse.json({ error: "Invalid Candidate Mode role" }, { status: 400 });
      }
      return response;
    }

    if (slot === "employee") {
      if (role === "reset") {
        response.cookies.delete("__dev_employee_role");
      } else if (employeeRoleKeys.includes(role)) {
        response.cookies.set("__dev_employee_role", role, {
          path: "/",
          httpOnly: false,
          sameSite: "lax",
        });
      } else {
        return NextResponse.json({ error: "Invalid Employee Mode role" }, { status: 400 });
      }
      return response;
    }

    return NextResponse.json({ error: "Invalid slot" }, { status: 400 });
  },
  { module: "dev/impersonate", requireAdmin: true },
);
