import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { PDFOnePager, type PDFOnePagerProps } from "@/components/profile/pdf-one-pager";
import { generateAllPanels } from "@/lib/intelligence";
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

    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      include: {
        primaryRole: true,
        assessment: {
          include: {
            subtestResults: true,
            compositeScores: true,
            predictions: true,
          },
        },
      },
    });

    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    if (!candidate.assessment) {
      return NextResponse.json({ error: "Assessment data not available" }, { status: 400 });
    }

    // Generate intelligence report panels for hiring actions
    const subtestScores = candidate.assessment.subtestResults.map((sr) => ({
      construct: sr.construct,
      percentile: sr.percentile,
    }));
    const panels = generateAllPanels(subtestScores, candidate.primaryRole.name);

    const pdfData: PDFOnePagerProps = {
      candidate: {
        firstName: candidate.firstName,
        lastName: candidate.lastName,
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
                performanceCeiling: candidate.assessment.predictions.performanceCeiling,
                attritionRisk: candidate.assessment.predictions.attritionRisk,
              }
            : null,
          completedAt: candidate.assessment.completedAt?.toISOString() ?? null,
        },
      },
      panels,
    };

    const pdfBuffer = await renderToBuffer(
      <PDFOnePager candidate={pdfData.candidate} panels={pdfData.panels} />
    );

    const safeName = `${candidate.firstName}_${candidate.lastName}`
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .toLowerCase();
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `ACI_OnePager_${safeName}_${dateStamp}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[PDF Export] Failed to generate one-pager:", error);
    return NextResponse.json(
      {
        error: "Failed to generate PDF one-pager",
        details: process.env.NODE_ENV === "development" && error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
