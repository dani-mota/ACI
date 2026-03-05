import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

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
  const rl = checkRateLimit(`tts:${token}`, RATE_LIMITS.tts);
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
    (invitation.expiresAt && new Date() > invitation.expiresAt)
  ) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
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

  try {
    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
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
          output_format: "mp3_44100_128",
        }),
      },
    );

    if (!ttsResponse.ok) {
      console.error(
        `[TTS] ElevenLabs error: ${ttsResponse.status} ${ttsResponse.statusText}`,
      );
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
    console.error("[TTS] Proxy error:", err);
    return new Response(
      JSON.stringify({ error: "TTS proxy error", fallback: true }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
}
