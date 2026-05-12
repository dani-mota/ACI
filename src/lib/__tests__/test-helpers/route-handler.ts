/**
 * PRO-133: thin harness for testing Next.js App Router route handlers.
 *
 * Pattern Dani's guardrail #1 requires: integration tests against real
 * route handlers, not just unit tests on the helpers. This harness
 * establishes the convention for PRO-133 + future tickets (PRO-136,
 * 137, 138, 139) to reuse.
 *
 * Usage at the call site:
 *
 *   import { vi } from "vitest";
 *   vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));
 *   import { getSession } from "@/lib/auth";
 *   import { GET } from "@/app/api/employees/route";
 *   import { invokeRoute } from "@/lib/__tests__/test-helpers/route-handler";
 *
 *   it("returns 200 for HR_TALENT_LEADER", async () => {
 *     vi.mocked(getSession).mockResolvedValue(employeeOnlyUser("HR_TALENT_LEADER"));
 *     const res = await invokeRoute(GET);
 *     expect(res.status).toBe(200);
 *   });
 *
 * The harness handles request construction; callers handle session
 * mocking + assertions. Keeps tests focused on gate behavior.
 */

import { NextRequest } from "next/server";

type RouteContext = { params: Promise<Record<string, string>> };

type RouteHandler = (
  req: NextRequest,
  ctx: RouteContext,
) => Promise<Response>;

export interface InvokeOpts {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  params?: Record<string, string>;
  searchParams?: Record<string, string>;
  headers?: Record<string, string>;
}

export async function invokeRoute(
  handler: RouteHandler,
  opts: InvokeOpts = {},
): Promise<Response> {
  const method = opts.method ?? "GET";
  const url = new URL("http://localhost/test");
  if (opts.searchParams) {
    for (const [k, v] of Object.entries(opts.searchParams)) {
      url.searchParams.set(k, v);
    }
  }

  // NextRequest's RequestInit is structurally compatible with the
  // standard RequestInit but with stricter `signal`. Build a minimal
  // init object that satisfies both.
  const init: { method: string; headers: Record<string, string>; body?: string } = {
    method,
    headers: {
      "content-type": "application/json",
      ...(opts.headers ?? {}),
    },
  };
  if (opts.body !== undefined && method !== "GET") {
    init.body = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
  }

  const req = new NextRequest(url.toString(), init);
  // Always pass a ctx — Next.js handlers expect `params` to be a Promise.
  // Empty object is fine when the route doesn't use params.
  const ctx: RouteContext = { params: Promise.resolve(opts.params ?? {}) };

  return await handler(req, ctx);
}
