import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { validateAssessSession } from "@/lib/session/assess-session"; // Fix: PRO-69

/**
 * GET /api/assess/[token]/tts-config
 *
 * Returns a short-lived session credential for browser-direct ElevenLabs TTS.
 * Rate limited: 1 request per 60 minutes per token (credential has 90-min TTL).
 *
 * Amendment B-1: The browser opens and manages the ElevenLabs WebSocket directly.
 * This route returns the credential without exposing the full API key.
 *
 * For the current HTTP proxy approach (Stage 4), this route is informational —
 * the client can check TTS availability without the full key.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  // Rate limit: 1 per 60 minutes per token
  // Fix: PRO-9 — use Redis-backed rate limiter
  const rl = await checkRateLimitAsync(`tts-config:${token}`, { maxRequests: 1, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
    });
  }

  // Validate token
  const invitation = await prisma.assessmentInvitation.findUnique({
    where: { linkToken: token },
  });

  // Fix: PRO-69 — reject COMPLETED tokens alongside EXPIRED
  if (!invitation || invitation.status === "EXPIRED" || invitation.status === "COMPLETED" || (invitation.expiresAt && new Date() > invitation.expiresAt)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Fix: PRO-69 — session binding validation
  const sessionCheck = validateAssessSession(invitation, request);
  if (!sessionCheck.valid) {
    return new Response(JSON.stringify({ error: "Session required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Check TTS configuration
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!apiKey || !voiceId) {
    return new Response(JSON.stringify({
      available: false,
      fallback: true,
      reason: "TTS not configured",
    }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Return TTS config (no full API key — just availability + voice settings)
  // When we migrate to browser-direct WebSocket, this will return a signed session token
  const ttl = 90 * 60 * 1000; // 90 minutes
  const validUntil = new Date(Date.now() + ttl).toISOString();

  return new Response(JSON.stringify({
    available: true,
    // Fix: PRO-69 — removed voiceId from response body
    model: "eleven_flash_v2_5",
    validUntil,
    ttlMs: ttl,
    voiceSettings: {
      stability: 0.6,
      similarity_boost: 0.8,
      style: 0.3,
      use_speaker_boost: true,
    },
    // proxy endpoint for current architecture
    proxyEndpoint: `/api/assess/${token}/tts`,
  }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
