/**
 * PRO-132: Lazy-on-expand evidence annotation generation.
 *
 * POST /api/employees/[id]/evidence/[construct]
 *
 * Triggered when a manager expands a construct row in the Evidence Layer
 * accordion. Generates the AI annotation for that one construct's top
 * candidate-message excerpt, caches it on EvidenceAnnotation, and returns
 * the result.
 *
 * Caching strategy mirrors PRO-130: only successful AI output is cached.
 * Failed Haiku attempts bump cognitiveSignatureAttemptedAt-style timestamp
 * (here `attemptedAt`) without writing the fallback to the cache, so a
 * transient outage cannot permanently stick a deterministic fallback on
 * an employee.
 *
 * Concurrent-Haiku-call non-fix (documented choice):
 * Two managers expanding the same construct simultaneously may both call
 * Haiku before the upsert lands. The unique constraint protects data
 * integrity (one row); two API calls are paid. Pennies/year. Not worth
 * an in-process lock that survives across server instances.
 *
 * PRO-133: canAccessMode now takes session and checks both role +
 * employeeRole additively. Per-target capability is gated via
 * `getEmployeeDataVisibility("evidence", ctx)` after fetching the
 * Candidate's user linkage — EMPLOYEE generates only on their own
 * dossier, PEOPLE_MANAGER only for direct reports.
 */

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessMode } from "@/lib/rbac";
import { getEmployeeDataVisibility } from "@/lib/employee-permissions";
import { withApiHandler } from "@/lib/api-handler";
import { AI_CONFIG } from "@/lib/assessment/config";
import { sanitizeAriaOutput } from "@/lib/assessment/sanitize";
import { CONSTRUCTS } from "@/lib/constructs";
import type { Construct } from "@/generated/prisma/enums";
import {
  CURRENT_PROMPT_VERSION,
  buildEvidenceAnnotationPrompt,
  buildFallbackAnnotation,
  containsForbiddenLanguage,
} from "@/lib/assessment/prompts/evidence-annotation";

const HAIKU_TIMEOUT_MS = 8_000;
/** 60-min cooldown between Haiku retries after a failure. Long enough that
 * brief Anthropic blips don't thrash the timeout budget across managers. */
const ANNOTATION_RETRY_COOLDOWN_MS = 60 * 60 * 1000;
const MAX_OUTPUT_TOKENS = 200;
const TEMPERATURE = 0.5;
const MIN_CONTENT_LENGTH = 50;

interface SuccessBody {
  excerpt: string | null;
  annotation: string | null;
  source: "ai" | "fallback" | "no_evidence";
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

    const params = await ctx.params;
    const candidateId = params.id;
    const constructParam = params.construct;
    if (!candidateId || !constructParam) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }
    if (!Object.keys(CONSTRUCTS).includes(constructParam)) {
      return NextResponse.json({ error: "Invalid construct" }, { status: 400 });
    }
    // After validation, narrow the type to the Prisma Construct enum.
    const construct = constructParam as Construct;

    // Load assessment scoped to user's org with assessmentMode = EMPLOYEE.
    // 404 (not 403) for cross-org or non-EMPLOYEE — don't leak existence.
    // PR#2: also fetch user-linkage context for the visibility gate.
    const candidate = await prisma.candidate.findFirst({
      where: {
        id: candidateId,
        orgId: session.user.orgId,
        assessment: { assessmentMode: "EMPLOYEE" },
      },
      select: {
        firstName: true,
        assessment: { select: { id: true } },
        userId: true,
        user: { select: { managerId: true } },
      },
    });
    if (!candidate || !candidate.assessment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const assessmentId = candidate.assessment.id;

    // PR#2 per-target capability gate.
    const visibility = getEmployeeDataVisibility("evidence", {
      session,
      targetEmployeeUserId: candidate.userId,
      targetEmployeeManagerId: candidate.user?.managerId ?? null,
    });
    if (visibility === "none") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Find the top qualifying candidate message for this construct.
    // AIEvaluationRun.messageId is a loose string FK (no Prisma relation),
    // so iterate runs in score order and look up the first qualifying CANDIDATE message.
    const runs = await prisma.aIEvaluationRun.findMany({
      where: { assessmentId, construct },
      orderBy: { aggregateScore: "desc" },
    });
    let messageContent: string | null = null;
    let messageId: string | null = null;
    for (const run of runs) {
      const msg = await prisma.conversationMessage.findUnique({
        where: { id: run.messageId },
        select: { id: true, content: true, role: true },
      });
      if (!msg) continue;
      if (msg.role !== "CANDIDATE") continue;
      if (msg.content.length < MIN_CONTENT_LENGTH) continue;
      messageContent = msg.content;
      messageId = msg.id;
      break;
    }

    if (!messageContent || !messageId) {
      return NextResponse.json<SuccessBody>({
        excerpt: null,
        annotation: null,
        source: "no_evidence",
      });
    }

    // Read existing annotation row (if any) for hot-path / cooldown decisions.
    const existing = await prisma.evidenceAnnotation.findUnique({
      where: { assessmentId_construct: { assessmentId, construct } },
    });

    // Hot path — cached AI annotation at the current prompt version.
    if (
      existing &&
      existing.annotation !== null &&
      existing.promptVersion === CURRENT_PROMPT_VERSION
    ) {
      return NextResponse.json<SuccessBody>({
        excerpt: messageContent,
        annotation: existing.annotation,
        source: "ai",
      });
    }

    // Cooldown — recently attempted but failed; serve fresh in-process fallback.
    if (existing?.attemptedAt) {
      const elapsed = Date.now() - existing.attemptedAt.getTime();
      if (elapsed < ANNOTATION_RETRY_COOLDOWN_MS) {
        return NextResponse.json<SuccessBody>({
          excerpt: messageContent,
          annotation: buildFallbackAnnotation({
            construct,
            employeeName: candidate.firstName,
          }),
          source: "fallback",
        });
      }
    }

    // Generation path — try Haiku.
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      Sentry.captureMessage("ANTHROPIC_API_KEY missing in evidence-annotation route");
      await markAttempted(assessmentId, construct, messageId);
      return NextResponse.json<SuccessBody>({
        excerpt: messageContent,
        annotation: buildFallbackAnnotation({
          construct,
          employeeName: candidate.firstName,
        }),
        source: "fallback",
      });
    }

    const { system, user } = buildEvidenceAnnotationPrompt({
      construct,
      employeeName: candidate.firstName,
      messageContent,
    });

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
        Sentry.captureMessage(
          `Haiku non-2xx in evidence-annotation: ${response.status} ${text.slice(0, 200)}`,
        );
      } else {
        const json = (await response.json()) as {
          content?: Array<{ type: string; text?: string }>;
        };
        rawOutput = json.content?.find((c) => c.type === "text")?.text ?? null;
      }
    } catch (err) {
      Sentry.captureException(err, { extra: { route: "evidence-annotation" } });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!rawOutput) {
      await markAttempted(assessmentId, construct, messageId);
      return NextResponse.json<SuccessBody>({
        excerpt: messageContent,
        annotation: buildFallbackAnnotation({
          construct,
          employeeName: candidate.firstName,
        }),
        source: "fallback",
      });
    }

    // Sanitize then forbidden-language check.
    const { cleaned } = sanitizeAriaOutput(rawOutput);
    const trimmed = cleaned.trim();
    if (trimmed.length === 0 || containsForbiddenLanguage(trimmed)) {
      Sentry.captureMessage(
        "evidence-annotation output failed forbidden-language or empty check; using fallback",
      );
      await markAttempted(assessmentId, construct, messageId);
      return NextResponse.json<SuccessBody>({
        excerpt: messageContent,
        annotation: buildFallbackAnnotation({
          construct,
          employeeName: candidate.firstName,
        }),
        source: "fallback",
      });
    }

    // Persist the AI annotation. Upsert keyed on the unique constraint so
    // simultaneous expand requests for the same construct converge on one row.
    await prisma.evidenceAnnotation.upsert({
      where: { assessmentId_construct: { assessmentId, construct } },
      create: {
        assessmentId,
        construct,
        messageId,
        annotation: trimmed,
        promptVersion: CURRENT_PROMPT_VERSION,
        attemptedAt: new Date(),
      },
      update: {
        messageId,
        annotation: trimmed,
        promptVersion: CURRENT_PROMPT_VERSION,
        attemptedAt: new Date(),
      },
    });

    return NextResponse.json<SuccessBody>({
      excerpt: messageContent,
      annotation: trimmed,
      source: "ai",
    });
  },
  { module: "employees/evidence/[construct]" },
);

async function markAttempted(
  assessmentId: string,
  construct: Construct,
  messageId: string,
) {
  // Record the attempt to gate retries. We set this even when annotation stays NULL.
  await prisma.evidenceAnnotation.upsert({
    where: { assessmentId_construct: { assessmentId, construct } },
    create: {
      assessmentId,
      construct,
      messageId,
      annotation: null,
      promptVersion: CURRENT_PROMPT_VERSION,
      attemptedAt: new Date(),
    },
    update: {
      messageId,
      attemptedAt: new Date(),
    },
  });
}
