import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { checkRateLimitAsync, RATE_LIMITS } from "@/lib/rate-limit";
import { createLogger } from "@/lib/assessment/logger";
import { validateAssessSession } from "@/lib/session/assess-session";

const log = createLogger("tts-route");

export const maxDuration = 30;

/**
 * POST /api/assess/[token]/tts
 *
 * Server-proxied ElevenLabs streaming TTS endpoint.
 * Keeps the API key server-side, validates assessment token, rate-limits.
 *
 * Request body: { text: string }
 * Response: audio/mpeg stream (or JSON error)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  // Rate limit
  // Fix: PRO-9 — use Redis-backed rate limiter
  const rl = await checkRateLimitAsync(`tts:${token}`, RATE_LIMITS.tts, "tts");
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)),
      },
    });
  }

  // Validate token
  const invitation = await prisma.assessmentInvitation.findUnique({
    where: { linkToken: token },
  });

  if (
    !invitation ||
    invitation.status === "EXPIRED" ||
    invitation.status === "COMPLETED" || // Fix: PRO-69
    (invitation.expiresAt && new Date() > invitation.expiresAt)
  ) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Fix: PRO-67 — session validation, skip during Phase 0 (cookie not yet established)
  const assessment = await prisma.assessment.findFirst({
    where: { candidateId: invitation.candidateId },
    include: { assessmentState: { select: { phase0Complete: true } } },
    orderBy: { startedAt: "desc" },
  });

  if (assessment?.assessmentState?.phase0Complete) {
    const sessionCheck = validateAssessSession(invitation, request);
    if (!sessionCheck.valid) {
      return new Response(JSON.stringify({ error: "Session required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // Check env vars
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!apiKey || !voiceId) {
    return new Response(
      JSON.stringify({ error: "TTS not configured", fallback: true }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  // Parse request body
  let text: string;
  try {
    const body = await request.json();
    text = String(body.text || "").slice(0, 2000);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!text.trim()) {
    return new Response(JSON.stringify({ error: "Empty text" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Fix: PRO-24 — validate text matches a recent AI turn to prevent arbitrary TTS abuse
  // Skip during Phase 0 (scripted text, not AGENT messages)
  if (assessment?.assessmentState?.phase0Complete) {
    const recentAgentMessages = await prisma.conversationMessage.findMany({
      where: { assessmentId: assessment.id, role: "AGENT" },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { content: true },
    });

    const normalizedText = text.trim().toLowerCase();
    const isValidTurn = recentAgentMessages.some(
      (msg) => msg.content.toLowerCase().includes(normalizedText) ||
               normalizedText.includes(msg.content.toLowerCase().slice(0, 50)),
    );

    if (!isValidTurn) {
      return new Response(JSON.stringify({ error: "Text does not match any recent assessment turn" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  try {
    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_flash_v2_5",
          voice_settings: {
            stability: 0.6,
            similarity_boost: 0.8,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      },
    );

    if (!ttsResponse.ok) {
      log.error("ElevenLabs error", { status: ttsResponse.status, statusText: ttsResponse.statusText });
      return new Response(
        JSON.stringify({ error: "TTS provider error", fallback: true }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    // Stream audio back to client
    return new Response(ttsResponse.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-cache, no-store",
      },
    });
  } catch (err) {
    log.error("TTS proxy error", { error: String(err) });
    return new Response(
      JSON.stringify({ error: "TTS proxy error", fallback: true }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
}
