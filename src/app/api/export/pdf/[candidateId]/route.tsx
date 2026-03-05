import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { PDFScorecard, type PDFScorecardProps } from "@/components/profile/pdf-scorecard";
import { getSession } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ candidateId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { candidateId } = await params;

    // ------------------------------------------------------------------
    // Fetch candidate with full assessment data (mirrors profile page)
    // ------------------------------------------------------------------
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      include: {
        primaryRole: true,
        notes: {
          include: { author: true },
          orderBy: { createdAt: "desc" },
        },
        assessment: {
          include: {
            subtestResults: true,
            compositeScores: true,
            predictions: true,
            redFlags: true,
          },
        },
      },
    });

    if (!candidate) {
      return NextResponse.json(
        { error: "Candidate not found" },
        { status: 404 }
      );
    }

    if (!candidate.assessment) {
      return NextResponse.json(
        { error: "Assessment data not available for this candidate" },
        { status: 400 }
      );
    }

    // ------------------------------------------------------------------
    // Shape data to match PDFScorecardProps
    // ------------------------------------------------------------------
    const pdfData: PDFScorecardProps = {
      candidate: {
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        email: candidate.email,
        status: candidate.status,
        primaryRole: {
          name: candidate.primaryRole.name,
          slug: candidate.primaryRole.slug,
        },
        assessment: {
          subtestResults: candidate.assessment.subtestResults.map((sr) => ({
            construct: sr.construct,
            layer: sr.layer,
            percentile: sr.percentile,
          })),
          compositeScores: candidate.assessment.compositeScores.map((cs) => ({
            roleSlug: cs.roleSlug,
            percentile: cs.percentile,
            passed: cs.passed,
            distanceFromCutline: cs.distanceFromCutline,
          })),
          predictions: candidate.assessment.predictions
            ? {
                rampTimeLabel: candidate.assessment.predictions.rampTimeLabel,
                rampTimeMonths: candidate.assessment.predictions.rampTimeMonths,
                supervisionLoad: candidate.assessment.predictions.supervisionLoad,
                supervisionScore: candidate.assessment.predictions.supervisionScore,
                performanceCeiling: candidate.assessment.predictions.performanceCeiling,
                ceilingCareerPath: candidate.assessment.predictions.ceilingCareerPath as string[],
                attritionRisk: candidate.assessment.predictions.attritionRisk,
                attritionStrategies: candidate.assessment.predictions.attritionStrategies as string[],
              }
            : null,
          redFlags: candidate.assessment.redFlags.map((rf) => ({
            severity: rf.severity,
            title: rf.title,
            description: rf.description,
          })),
        },
        notes: candidate.notes.map((n) => ({
          content: n.content,
          author: { name: n.author.name },
          createdAt: n.createdAt.toISOString(),
        })),
      },
    };

    // ------------------------------------------------------------------
    // Render PDF to buffer
    // ------------------------------------------------------------------
    const pdfBuffer = await renderToBuffer(
      <PDFScorecard candidate={pdfData.candidate} />
    );

    // ------------------------------------------------------------------
    // Build filename
    // ------------------------------------------------------------------
    const safeName = `${candidate.firstName}_${candidate.lastName}`
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .toLowerCase();
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `ACI_Scorecard_${safeName}_${dateStamp}.pdf`;

    // ------------------------------------------------------------------
    // Return PDF response
    // ------------------------------------------------------------------
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[PDF Export] Failed to generate scorecard:", error);

    return NextResponse.json(
      {
        error: "Failed to generate PDF scorecard",
        details:
          process.env.NODE_ENV === "development" && error instanceof Error
            ? error.message
            : undefined,
      },
      { status: 500 }
    );
  }
}
