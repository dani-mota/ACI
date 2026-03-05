import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email/resend";
import { buildResultsEmail } from "@/lib/email/templates/results";
import { getSession } from "@/lib/auth";

/**
 * POST /api/email/results
 * Send assessment results email to a candidate.
 * Body: { candidateId: string }
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { candidateId } = body;

  if (!candidateId) {
    return NextResponse.json({ error: "candidateId required" }, { status: 400 });
  }

  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      primaryRole: true,
      org: true,
      assessment: {
        include: {
          subtestResults: true,
          compositeScores: true,
        },
      },
    },
  });

  if (!candidate || !candidate.assessment) {
    return NextResponse.json({ error: "Candidate or assessment not found" }, { status: 404 });
  }

  // Calculate layer-level percentiles
  const subtests = candidate.assessment.subtestResults;
  const cognitive = subtests.filter((s) => s.layer === "COGNITIVE_CORE");
  const technical = subtests.filter((s) => s.layer === "TECHNICAL_APTITUDE");
  const behavioral = subtests.filter((s) => s.layer === "BEHAVIORAL_INTEGRITY");

  const avgPercentile = (arr: typeof subtests) =>
    arr.length > 0
      ? Math.round(arr.reduce((sum, s) => sum + s.percentile, 0) / arr.length)
      : 50;

  const cognitivePercentile = avgPercentile(cognitive);
  const technicalPercentile = avgPercentile(technical);
  const behavioralPercentile = avgPercentile(behavioral);

  const narrative = generateNarrative(
    candidate.firstName,
    cognitivePercentile,
    technicalPercentile,
    behavioralPercentile
  );

  const { subject, html } = buildResultsEmail({
    candidateName: candidate.firstName,
    roleName: candidate.primaryRole.name,
    companyName: candidate.org.name,
    cognitivePercentile,
    technicalPercentile,
    behavioralPercentile,
    narrative,
  });

  await sendEmail({
    to: candidate.email,
    subject,
    html,
  });

  // Mark results email as sent
  await prisma.candidate.update({
    where: { id: candidateId },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}

function generateNarrative(
  name: string,
  cognitive: number,
  technical: number,
  behavioral: number
): string {
  const parts: string[] = [];

  if (cognitive >= 75) {
    parts.push(`${name}, your cognitive assessment results were strong, indicating well-developed analytical and reasoning capabilities.`);
  } else if (cognitive >= 50) {
    parts.push(`${name}, your cognitive assessment results were within the typical range, reflecting solid foundational reasoning abilities.`);
  } else {
    parts.push(`${name}, your cognitive assessment results suggest areas for continued development in analytical reasoning.`);
  }

  if (technical >= 75) {
    parts.push("Your technical aptitude scores demonstrate a high degree of domain-relevant problem-solving skill.");
  } else if (technical >= 50) {
    parts.push("Your technical aptitude scores indicate competent problem-solving abilities in role-relevant areas.");
  } else {
    parts.push("Your technical aptitude scores suggest opportunities to strengthen domain-specific problem-solving skills.");
  }

  if (behavioral >= 75) {
    parts.push("Your behavioral integrity indicators were notably strong, reflecting consistent and principled approaches to workplace scenarios.");
  } else if (behavioral >= 50) {
    parts.push("Your behavioral integrity results fall within expected ranges for your experience level.");
  } else {
    parts.push("Your behavioral assessment highlights areas where additional awareness of procedural expectations may be beneficial.");
  }

  return parts.join(" ");
}
