import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const items = await prisma.itineraryItem.findMany({
    where: { tripId: id },
    include: { proposal: true },
    orderBy: [{ day: 'asc' }],
  });
  return NextResponse.json(items);
}
