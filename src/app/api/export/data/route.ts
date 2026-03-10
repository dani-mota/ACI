import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/**
 * GET /api/export/data?type=items|constructs|full&format=csv|json
 * Export assessment data for psychometric analysis.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Restrict to TA_LEADER and ADMIN
  if (!["TA_LEADER", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "constructs";
  const format = searchParams.get("format") || "csv";

  const orgId = session.user.orgId;

  if (type === "items") {
    return exportItemResponses(orgId, format);
  } else if (type === "full") {
    return exportFullData(orgId, format);
  }
  return exportConstructScores(orgId, format);
}

async function exportItemResponses(orgId: string, format: string) {
  const responses = await prisma.itemResponse.findMany({
    where: {
      assessment: {
        candidate: { orgId },
      },
    },
    include: {
      assessment: {
        include: { candidate: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const rows = responses.map((r) => ({
    candidateId: r.assessment.candidateId,
    candidateName: `${r.assessment.candidate.firstName} ${r.assessment.candidate.lastName}`,
    assessmentId: r.assessmentId,
    itemId: r.itemId,
    itemType: r.itemType,
    response: r.response,
    responseTimeMs: r.responseTimeMs,
    rawScore: r.rawScore,
  }));

  return formatResponse(rows, format, "item-responses");
}

async function exportConstructScores(orgId: string, format: string) {
  const results = await prisma.subtestResult.findMany({
    where: {
      assessment: {
        candidate: { orgId },
      },
    },
    include: {
      assessment: {
        include: { candidate: { include: { primaryRole: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const rows = results.map((r) => ({
    candidateId: r.assessment.candidateId,
    candidateName: `${r.assessment.candidate.firstName} ${r.assessment.candidate.lastName}`,
    role: r.assessment.candidate.primaryRole.name,
    construct: r.construct,
    layer: r.layer,
    rawScore: r.rawScore,
    percentile: r.percentile,
    itemCount: r.itemCount,
    responseTimeAvgMs: r.responseTimeAvgMs,
  }));

  return formatResponse(rows, format, "construct-scores");
}

async function exportFullData(orgId: string, format: string) {
  const candidates = await prisma.candidate.findMany({
    where: { orgId, assessment: { isNot: null } },
    include: {
      primaryRole: true,
      assessment: {
        include: {
          subtestResults: true,
          compositeScores: true,
          predictions: true,
          redFlags: true,
          survey: true,
        },
      },
    },
  });

  const rows = candidates.map((c) => {
    const a = c.assessment;
    const subtests: Record<string, number> = {};
    a?.subtestResults.forEach((s) => {
      subtests[`${s.construct}_raw`] = s.rawScore;
      subtests[`${s.construct}_pct`] = s.percentile;
    });

    const composite = a?.compositeScores[0];
    const prediction = a?.predictions;
    const survey = a?.survey;

    return {
      candidateId: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      role: c.primaryRole.name,
      status: c.status,
      compositeScore: composite?.score ?? null,
      compositePercentile: composite?.percentile ?? null,
      passed: composite?.passed ?? null,
      ...subtests,
      rampTimeMonths: prediction?.rampTimeMonths ?? null,
      supervisionLoad: prediction?.supervisionLoad ?? null,
      performanceCeiling: prediction?.performanceCeiling ?? null,
      attritionRisk: prediction?.attritionRisk ?? null,
      redFlagCount: a?.redFlags?.length ?? 0,
      surveyDifficulty: survey?.difficulty ?? null,
      surveyFairness: survey?.fairness ?? null,
      surveyFaceValidity: survey?.faceValidity ?? null,
    };
  });

  return formatResponse(rows, format, "full-export");
}

function formatResponse(rows: Record<string, unknown>[], format: string, filename: string) {
  if (format === "json") {
    return new NextResponse(JSON.stringify(rows, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}.json"`,
      },
    });
  }

  // CSV
  if (rows.length === 0) {
    return new NextResponse("No data", {
      headers: { "Content-Type": "text/csv" },
    });
  }

  const headers = Object.keys(rows[0]);
  const csvLines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          if (val === null || val === undefined) return "";
          const str = String(val);
          return str.includes(",") || str.includes('"') || str.includes("\n")
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(",")
    ),
  ];

  return new NextResponse(csvLines.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}.csv"`,
    },
  });
}
