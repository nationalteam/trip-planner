import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildForbiddenResponse, requireAuth, requireTripRole } from '@/lib/auth';
import { normalizeSuggestedTimeToTimeBlock } from '@/lib/time-block';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const proposal = await prisma.proposal.findUnique({
    where: { id },
    include: { itineraryItem: true },
  });
  if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const access = await requireTripRole(proposal.tripId, auth.id, ['owner']);
  if (!access.ok) return buildForbiddenResponse();

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

    const timeBlock = normalizeSuggestedTimeToTimeBlock(proposal.suggestedTime);

    let day = 1;
    while (true) {
      const taken = existingItems.some(
        (item: { day: number; timeBlock: string }) => item.day === day && item.timeBlock === timeBlock
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
