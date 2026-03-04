import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email/resend";
import { buildResultsEmail } from "@/lib/email/templates/results";

/**
 * GET /api/cron/send-results
 * Vercel cron job: finds completed assessments older than 7 days
 * where results email hasn't been sent yet, and sends them.
 */
export async function GET(request: NextRequest) {
  // Authenticate cron requests via CRON_SECRET
  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Find candidates with completed assessments older than 7 days
    // who haven't received results emails yet
    const candidates = await prisma.candidate.findMany({
      where: {
        status: { in: ["RECOMMENDED", "REVIEW_REQUIRED", "DO_NOT_ADVANCE"] },
        resultsEmailSentAt: null,
        assessment: {
          completedAt: { lt: sevenDaysAgo },
        },
        org: { isDemo: false },
      },
      include: {
        primaryRole: true,
        org: true,
        assessment: {
          include: { subtestResults: true },
        },
      },
      take: 20, // Process in batches to stay within timeout
    });

    let sent = 0;
    const errors: string[] = [];

    for (const candidate of candidates) {
      if (!candidate.assessment) continue;

      const subtests = candidate.assessment.subtestResults;
      const cognitive = subtests.filter((s) => s.layer === "COGNITIVE_CORE");
      const technical = subtests.filter((s) => s.layer === "TECHNICAL_APTITUDE");
      const behavioral = subtests.filter((s) => s.layer === "BEHAVIORAL_INTEGRITY");

      const avgPercentile = (arr: typeof subtests) =>
        arr.length > 0
          ? Math.round(arr.reduce((sum, s) => sum + s.percentile, 0) / arr.length)
          : 50;

      const { subject, html } = buildResultsEmail({
        candidateName: candidate.firstName,
        roleName: candidate.primaryRole.name,
        companyName: candidate.org.name,
        cognitivePercentile: avgPercentile(cognitive),
        technicalPercentile: avgPercentile(technical),
        behavioralPercentile: avgPercentile(behavioral),
        narrative: `Thank you for completing the ${candidate.primaryRole.name} assessment. Your results have been reviewed by the recruiting team.`,
      });

      try {
        await sendEmail({ to: candidate.email, subject, html });
        await prisma.candidate.update({
          where: { id: candidate.id },
          data: { resultsEmailSentAt: new Date() },
        });
        sent++;
      } catch (err) {
        errors.push(`Failed for ${candidate.email}: ${err instanceof Error ? err.message : "Unknown"}`);
      }
    }

    return NextResponse.json({
      processed: candidates.length,
      sent,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error("Cron send-results error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
