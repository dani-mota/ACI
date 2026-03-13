/**
 * Shared API route wrapper with standardized error handling.
 *
 * Provides:
 * - Automatic try/catch with structured JSON error responses
 * - Sentry exception capture for every unhandled error
 * - Request ID generation for log correlation
 * - Optional auth/admin role checks
 *
 * Usage:
 *   export const GET = withApiHandler(async (req, ctx) => {
 *     // ... handler logic
 *     return NextResponse.json({ data });
 *   }, { module: "my-route" });
 */

import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { createLogger } from "@/lib/assessment/logger";
import { getSession } from "@/lib/auth";

type RouteContext = { params: Promise<Record<string, string>> };

type ApiHandler = (
  req: Request,
  ctx: RouteContext,
) => Promise<Response>;

export interface HandlerOptions {
  /** Logger module name — appears in structured logs */
  module: string;
  /** If true, calls getSession() and returns 401 if unauthenticated */
  requireAuth?: boolean;
  /** If true, checks for TA_LEADER or ADMIN role; implies requireAuth */
  requireAdmin?: boolean;
}

export function withApiHandler(
  handler: ApiHandler,
  opts: HandlerOptions,
): ApiHandler {
  return async (req: Request, ctx: RouteContext) => {
    const requestId = crypto.randomUUID().slice(0, 8);
    const log = createLogger(opts.module, requestId);

    try {
      // Auth checks
      if (opts.requireAuth || opts.requireAdmin) {
        const session = await getSession();
        if (!session) {
          return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 },
          );
        }
        if (
          opts.requireAdmin &&
          !["TA_LEADER", "ADMIN"].includes(session.user.role)
        ) {
          return NextResponse.json(
            { error: "Forbidden" },
            { status: 403 },
          );
        }
      }

      return await handler(req, ctx);
    } catch (err) {
      Sentry.captureException(err, {
        extra: { requestId, module: opts.module },
      });

      log.error("Unhandled API error", {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        requestId,
      });

      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  };
}
