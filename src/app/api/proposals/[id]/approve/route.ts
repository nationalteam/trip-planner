import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const proposal = await prisma.proposal.findUnique({
    where: { id },
    include: { itineraryItem: true },
  });
  if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updated = await prisma.proposal.update({
    where: { id },
    data: { status: 'approved' },
  });

  let itineraryItem = proposal.itineraryItem;

  if (!itineraryItem) {
    const existingItems = await prisma.itineraryItem.findMany({
      where: { tripId: proposal.tripId },
      orderBy: { day: 'asc' },
    });

    const timeBlockMap: Record<string, string> = {
      morning: 'morning',
      lunch: 'morning',
      afternoon: 'afternoon',
      dinner: 'dinner',
      night: 'dinner',
    };
    const timeBlock = timeBlockMap[proposal.suggestedTime] || 'afternoon';

    let day = 1;
    while (true) {
      const taken = existingItems.some(
        item => item.day === day && item.timeBlock === timeBlock
      );
      if (!taken) break;
      day++;
    }

    itineraryItem = await prisma.itineraryItem.create({
      data: {
        tripId: proposal.tripId,
        proposalId: proposal.id,
        day,
        timeBlock,
      },
    });
  }

  const fullItineraryItem = await prisma.itineraryItem.findUnique({
    where: { id: itineraryItem.id },
    include: { proposal: true },
  });

  return NextResponse.json({ proposal: updated, itineraryItem: fullItineraryItem });
}
