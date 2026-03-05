import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const SORTABLE_FIELDS = ["createdAt", "lastName", "firstName", "status", "email"] as const;

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  // Lightweight existence check for invitation duplicate warning
  const emailCheck = searchParams.get("email");
  if (emailCheck) {
    const existing = await prisma.candidate.findUnique({
      where: { email_orgId: { email: emailCheck, orgId: session.user.orgId! } },
      select: { id: true, status: true },
    });
    return NextResponse.json({ exists: !!existing, status: existing?.status ?? null });
  }

  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const role = searchParams.get("role") || "";
  const rawSortBy = searchParams.get("sortBy") || "createdAt";
  const sortBy = (SORTABLE_FIELDS as readonly string[]).includes(rawSortBy) ? rawSortBy : "createdAt";
  const sortDir = searchParams.get("sortDir") || "desc";
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "25"), 100);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { orgId: session.user.orgId };

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  if (status) {
    where.status = status;
  }

  if (role) {
    where.primaryRole = { slug: role };
  }

  const [candidates, total] = await Promise.all([
    prisma.candidate.findMany({
      where,
      include: {
        primaryRole: true,
        assessment: {
          include: {
            compositeScores: true,
            redFlags: true,
          },
        },
      },
      orderBy: { [sortBy]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.candidate.count({ where }),
  ]);

  return NextResponse.json({
    candidates,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}
