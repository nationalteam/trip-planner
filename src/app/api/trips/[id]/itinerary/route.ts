import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const items = await prisma.itineraryItem.findMany({
    where: { tripId: params.id },
    include: { proposal: true },
    orderBy: [{ day: 'asc' }],
  });
  return NextResponse.json(items);
}
