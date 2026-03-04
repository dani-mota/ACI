import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getRoleContext, type RoleContext } from "@/lib/assessment/role-context";

const ANTHROPIC_TIMEOUT_MS = 15_000;

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = ANTHROPIC_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timeoutId),
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    token,
    construct,
    prompt,
    assessmentId,
    sequenceOrder,
    triggerItemId,
    roleId,
    // Second-call fields (candidate response submission)
    interactionId,
    candidateResponse,
    responseTimeMs,
  } = body;

  // Validate assessment token — this endpoint is called by candidates, not authenticated users
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const invitation = await prisma.assessmentInvitation.findUnique({
    where: { linkToken: token },
  });
  if (!invitation || invitation.status === "EXPIRED") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Load role context for domain-aware prompts (null-safe for backward compat)
  let roleContext: RoleContext | null = null;
  if (roleId) {
    roleContext = await getRoleContext(roleId);
    if (roleContext.isGeneric) roleContext = null;
  }

  if (!construct) {
    return NextResponse.json({ error: "Missing construct" }, { status: 400 });
  }

  // ── Second call: candidate submitted a response ──────────────────────────
  if (interactionId && candidateResponse) {
    // Update the AIInteraction with the candidate's response
    const interaction = await prisma.aIInteraction.findUnique({
      where: { id: interactionId },
    });

    if (!interaction) {
      return NextResponse.json({ error: "Interaction not found" }, { status: 404 });
    }

    // Analyze the response with Claude (or fallback)
    let aiAnalysis: string | null = null;
    let evidenceFor: string[] = [];
    let confidenceLevel: number | null = null;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      try {
        const response = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 300,
            messages: [
              {
                role: "user",
                content: `Analyze this candidate response for construct: ${construct}.${
                  roleContext
                    ? `\nRole context: ${roleContext.roleName} — ${roleContext.environment}. Key responsibilities include: ${roleContext.keyTasks.slice(0, 3).join(", ")}.`
                    : ""
                }
Question: "${interaction.aiPrompt}"
Response: "${candidateResponse}"

Return JSON only (no other text):
{"evidenceFor":[],"evidenceAgainst":[],"confidenceLevel":0.5,"insight":""}`,
              },
            ],
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const text = data.content?.[0]?.text || "";
          try {
            const parsed = JSON.parse(text);
            aiAnalysis = text;
            evidenceFor = parsed.evidenceFor || [];
            confidenceLevel = typeof parsed.confidenceLevel === "number" ? parsed.confidenceLevel : null;
          } catch {
            // JSON parse failed — store raw text
            aiAnalysis = text;
          }
        }
      } catch (err) {
        console.error("Anthropic API error during analysis:", err);
      }
    }

    await prisma.aIInteraction.update({
      where: { id: interactionId },
      data: {
        candidateResponse,
        responseTimeMs: responseTimeMs || null,
        aiAnalysis,
        evidenceFor: evidenceFor as any,
        confidenceLevel,
      },
    });

    return NextResponse.json({ success: true });
  }

  // ── First call: generate a follow-up question ────────────────────────────
  if (!prompt) {
    return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  let followUp = generateFallbackFollowUp(construct);

  if (apiKey) {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 150,
          messages: [
            {
              role: "user",
              content: `You are an assessment proctor.${
                roleContext
                  ? ` The candidate is being assessed for the role of ${roleContext.roleName}. Domain context: ${roleContext.environment}. Key tasks include: ${roleContext.keyTasks.slice(0, 4).join(", ")}. Technical skills expected: ${roleContext.technicalSkills.slice(0, 4).join(", ")}.`
                  : ""
              } The construct being measured is ${construct}.
The original question was: "${prompt}"
The candidate responded: "${body.candidateResponse || "(no prior response)"}"

Generate ONE short, probing follow-up question (1-2 sentences) that digs deeper into their reasoning or tests the boundary of their understanding.${
                roleContext ? " Frame the question in the context of the role's domain." : ""
              } Be professional and neutral. Only output the question, nothing else.`,
            },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        followUp = data.content?.[0]?.text || followUp;
      }
    } catch (err) {
      console.error("Anthropic API error:", err);
    }
  }

  // Store the AIInteraction record if assessmentId is provided
  let createdInteractionId: string | undefined;
  if (assessmentId) {
    try {
      const created = await prisma.aIInteraction.create({
        data: {
          assessmentId,
          construct: construct as any,
          sequenceOrder: sequenceOrder ?? 1,
          triggerItemId: triggerItemId || null,
          aiPrompt: followUp,
        },
      });
      createdInteractionId = created.id;
    } catch (err) {
      console.error("Failed to create AIInteraction record:", err);
      // Non-fatal — assessment delivery continues
    }
  }

  return NextResponse.json({ followUp, interactionId: createdInteractionId });
}

function generateFallbackFollowUp(construct: string): string {
  const followUps: Record<string, string[]> = {
    FLUID_REASONING: [
      "Can you walk me through the specific logic steps you used to arrive at that conclusion?",
      "How would your approach change if one of the key assumptions was different?",
    ],
    ETHICAL_JUDGMENT: [
      "What potential consequences did you consider when forming your response?",
      "How would you handle it if your supervisor disagreed with your decision?",
    ],
    SYSTEMS_DIAGNOSTICS: [
      "What data would you need to confirm your diagnosis before taking action?",
      "How would you prioritize if multiple root causes were identified simultaneously?",
    ],
    LEARNING_VELOCITY: [
      "What indicators do you use to assess whether you've truly mastered a new concept?",
      "How do you adapt your learning approach when initial methods aren't working?",
    ],
    DEFAULT: [
      "Can you elaborate on the reasoning behind your response?",
      "What alternative approaches did you consider before settling on this answer?",
    ],
  };

  const pool = followUps[construct] || followUps.DEFAULT;
  return pool[Math.floor(Math.random() * pool.length)];
}
