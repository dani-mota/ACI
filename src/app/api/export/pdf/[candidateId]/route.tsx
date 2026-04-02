import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { PDFScorecard, type PDFScorecardProps } from "@/components/profile/pdf-scorecard";
import { getSession } from "@/lib/auth";
import { withApiHandler } from "@/lib/api-handler";
import { canView } from "@/lib/rbac";

interface RouteParams {
  params: Promise<{ candidateId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  return withApiHandler(async () => {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canView(session.user.role, "pdfExport")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    if (!candidate || candidate.orgId !== session.user.orgId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
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
  }, { module: "export/pdf/[candidateId]" })(_request, { params });
}
