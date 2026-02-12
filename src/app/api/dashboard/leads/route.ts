import { InterestLabel, LeadStage, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  stage: z.nativeEnum(LeadStage).optional(),
  interest_label: z.nativeEnum(InterestLabel).optional(),
  assigned_to: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(25),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const parsedQuery = querySchema.safeParse({
    stage: url.searchParams.get("stage") ?? undefined,
    interest_label: url.searchParams.get("interest_label") ?? undefined,
    assigned_to: url.searchParams.get("assigned_to") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    page_size: url.searchParams.get("page_size") ?? undefined,
  });

  if (!parsedQuery.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid query params",
        details: parsedQuery.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { stage, interest_label: interestLabel, assigned_to: assignedTo, page, page_size: pageSize } = parsedQuery.data;

  const where: Prisma.LeadWhereInput = {};
  if (stage) where.stage = stage;
  if (interestLabel) where.interestLabel = interestLabel;
  if (assignedTo) where.assignedTo = assignedTo;

  const [total, leads] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        createdAt: true,
        customerName: true,
        phone: true,
        score: true,
        interestLabel: true,
        stage: true,
        source: true,
        assignedTo: true,
        salesRep: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    data: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      leads,
    },
  });
}
