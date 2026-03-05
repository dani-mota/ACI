import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { PDFInterviewKit, type PDFInterviewKitProps } from "@/components/profile/pdf-interview-kit";
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
            redFlags: true,
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

    const pdfData: PDFInterviewKitProps = {
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
          redFlags: candidate.assessment.redFlags.map((rf) => ({
            severity: rf.severity,
            title: rf.title,
            description: rf.description,
          })),
        },
      },
    };

    const pdfBuffer = await renderToBuffer(
      <PDFInterviewKit candidate={pdfData.candidate} />
    );

    const safeName = `${candidate.firstName}_${candidate.lastName}`
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .toLowerCase();
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `ACI_InterviewKit_${safeName}_${dateStamp}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[PDF Export] Failed to generate interview kit:", error);
    return NextResponse.json(
      {
        error: "Failed to generate PDF interview kit",
        details: process.env.NODE_ENV === "development" && error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
