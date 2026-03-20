/**
 * PRO-57: Assessment session binding
 *
 * Binds an assessment invitation to a single browser session via an HttpOnly
 * cookie. Prevents URL sharing / proxy test-taking by rejecting requests
 * whose cookie does not match the stored sessionBindingId.
 */
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";

const COOKIE_NAME = "assess-session";

// Use Secure only in production (localhost doesn't support Secure cookies)
const IS_PROD = process.env.NODE_ENV === "production";
const COOKIE_ATTRS = `HttpOnly; ${IS_PROD ? "Secure; " : ""}SameSite=Lax; Path=/`;

/**
 * Validate the caller's session cookie against the stored binding on the
 * invitation.  Returns `{ valid: true, sessionId }` when:
 *   - No session has been bound yet (first request), OR
 *   - The cookie matches the stored sessionBindingId.
 *
 * Returns `{ valid: false }` when the cookie is missing or mismatched.
 */
export function validateAssessSession(
  invitation: { id: string; sessionBindingId: string | null },
  request: NextRequest,
): { valid: boolean; sessionId?: string } {
  const cookie = request.cookies.get(COOKIE_NAME);

  // First request — no binding yet, will be bound shortly.
  if (!invitation.sessionBindingId) {
    return { valid: true };
  }

  // Cookie missing or mismatched — reject.
  if (!cookie?.value || cookie.value !== invitation.sessionBindingId) {
    return { valid: false };
  }

  return { valid: true, sessionId: cookie.value };
}

/**
 * Bind a new session to the invitation. Generates a UUID, stores it in the
 * database, and returns the Set-Cookie header value so the caller can attach
 * it to the response.
 */
export async function bindAssessSession(
  invitationId: string,
): Promise<{ sessionId: string; setCookieHeader: string }> {
  const sessionId = crypto.randomUUID();

  await prisma.assessmentInvitation.update({
    where: { id: invitationId },
    data: { sessionBindingId: sessionId },
  });

  const setCookieHeader = `${COOKIE_NAME}=${sessionId}; ${COOKIE_ATTRS}`;

  return { sessionId, setCookieHeader };
}
