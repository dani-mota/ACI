/**
 * PRO-130: Generate or fetch the Cognitive Signature for an employee.
 *
 * POST /api/employees/[id]/cognitive-signature
 *
 * Caching strategy: ONLY the AI output is cached on Assessment.cognitiveSignature.
 * Failed Haiku attempts bump cognitiveSignatureAttemptedAt without writing to the
 * cache, so a transient outage cannot permanently stick a fallback on an employee.
 *
 * Strict-mode double-fire guard: writes use updateMany() with the version/null
 * condition baked into WHERE so a second concurrent request finds count===0 and
 * falls through to the read path. No double Haiku calls.
 *
 * PRO-133: canAccessMode now takes session and checks both role +
 * employeeRole additively. PEOPLE_MANAGER and HR_TALENT_LEADER access
 * to this endpoint is governed by canViewAnyEmployee — see commit 3.
 */

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessMode } from "@/lib/rbac";
import { canViewAnyEmployee, PR2_PENDING_REASON } from "@/lib/employee-permissions";
import { withApiHandler } from "@/lib/api-handler";
import { AI_CONFIG } from "@/lib/assessment/config";
import { sanitizeAriaOutput } from "@/lib/assessment/sanitize";
import {
  CURRENT_PROMPT_VERSION,
  buildCognitiveSignaturePrompt,
  buildFallbackSignature,
  containsForbiddenLanguage,
} from "@/lib/assessment/prompts/cognitive-signature";

const HAIKU_TIMEOUT_MS = 8_000;
const RETRY_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes between Haiku retries after failure
const MAX_OUTPUT_TOKENS = 300;
const TEMPERATURE = 0.5;

interface SuccessBody {
  signature: string;
  source: "ai" | "fallback";
}

export const POST = withApiHandler(
  async (_req, ctx) => {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canAccessMode(session, "employees")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!canViewAnyEmployee(session)) {
      return NextResponse.json(
        { error: "Forbidden", reason: PR2_PENDING_REASON },
        { status: 403 },
      );
    }

    const params = await ctx.params;
    const candidateId = params.id;
    if (!candidateId) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    // Load the candidate's employee assessment within the user's org.
    // 404 (not 403) for cross-org or non-EMPLOYEE — don't leak existence.
    const candidate = await prisma.candidate.findFirst({
      where: {
        id: candidateId,
        orgId: session.user.orgId,
        assessment: { assessmentMode: "EMPLOYEE" },
      },
      select: {
        firstName: true,
        assessment: {
          select: {
            id: true,
            cognitiveSignature: true,
            cognitiveSignaturePromptVersion: true,
            cognitiveSignatureAttemptedAt: true,
            subtestResults: { select: { construct: true, percentile: true, layer: true } },
          },
        },
      },
    });

    if (!candidate || !candidate.assessment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const a = candidate.assessment;

    // 1. Hot path — cached AI signature, current prompt version
    if (a.cognitiveSignature !== null && a.cognitiveSignaturePromptVersion === CURRENT_PROMPT_VERSION) {
      return NextResponse.json<SuccessBody>({
        signature: a.cognitiveSignature,
        source: "ai",
      });
    }

    const promptInput = {
      firstName: candidate.firstName,
      subtestResults: a.subtestResults,
    };

    // 2. Cooldown check — recently attempted, don't retry yet, return fresh fallback
    if (a.cognitiveSignatureAttemptedAt !== null) {
      const elapsed = Date.now() - a.cognitiveSignatureAttemptedAt.getTime();
      if (elapsed < RETRY_COOLDOWN_MS) {
        return NextResponse.json<SuccessBody>({
          signature: buildFallbackSignature(promptInput),
          source: "fallback",
        });
      }
    }

    // 3. Generation path — try Haiku
    const { system, user } = buildCognitiveSignaturePrompt(promptInput);
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      Sentry.captureMessage("ANTHROPIC_API_KEY missing in cognitive-signature route");
      await markAttempted(a.id);
      return NextResponse.json<SuccessBody>({
        signature: buildFallbackSignature(promptInput),
        source: "fallback",
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HAIKU_TIMEOUT_MS);

    let rawOutput: string | null = null;
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: AI_CONFIG.realtimeModel,
          max_tokens: MAX_OUTPUT_TOKENS,
          temperature: TEMPERATURE,
          system,
          messages: [{ role: "user", content: user }],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        Sentry.captureMessage(`Haiku non-2xx in cognitive-signature: ${response.status} ${text.slice(0, 200)}`);
      } else {
        const json = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
        rawOutput = json.content?.find((c) => c.type === "text")?.text ?? null;
      }
    } catch (err) {
      Sentry.captureException(err, { extra: { route: "cognitive-signature" } });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!rawOutput) {
      await markAttempted(a.id);
      return NextResponse.json<SuccessBody>({
        signature: buildFallbackSignature(promptInput),
        source: "fallback",
      });
    }

    // 4. Sanitize then forbidden-language check
    const { cleaned } = sanitizeAriaOutput(rawOutput);
    const trimmed = cleaned.trim();

    if (trimmed.length === 0 || containsForbiddenLanguage(trimmed)) {
      Sentry.captureMessage("cognitive-signature output failed forbidden-language or empty check; using fallback");
      await markAttempted(a.id);
      return NextResponse.json<SuccessBody>({
        signature: buildFallbackSignature(promptInput),
        source: "fallback",
      });
    }

    // 5. Persist the AI signature with the strict-mode-safe guard
    const update = await prisma.assessment.updateMany({
      where: {
        id: a.id,
        OR: [
          { cognitiveSignature: null },
          { cognitiveSignaturePromptVersion: { lt: CURRENT_PROMPT_VERSION } },
        ],
      },
      data: {
        cognitiveSignature: trimmed,
        cognitiveSignaturePromptVersion: CURRENT_PROMPT_VERSION,
        cognitiveSignatureAttemptedAt: new Date(),
      },
    });

    if (update.count === 0) {
      // Lost the race — another request stored a value first. Re-read and return it.
      const fresh = await prisma.assessment.findUnique({
        where: { id: a.id },
        select: { cognitiveSignature: true },
      });
      if (fresh?.cognitiveSignature) {
        return NextResponse.json<SuccessBody>({ signature: fresh.cognitiveSignature, source: "ai" });
      }
    }

    return NextResponse.json<SuccessBody>({ signature: trimmed, source: "ai" });
  },
  { module: "employees/cognitive-signature" },
);

async function markAttempted(assessmentId: string) {
  // Record the attempt to gate retries. We set this even when cognitiveSignature stays NULL.
  await prisma.assessment.updateMany({
    where: { id: assessmentId },
    data: { cognitiveSignatureAttemptedAt: new Date() },
  });
}
