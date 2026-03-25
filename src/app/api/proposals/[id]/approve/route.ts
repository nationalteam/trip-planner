import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildForbiddenResponse, requireAuth, requireTripRole } from '@/lib/auth';
import { normalizeSuggestedTimeToTimeBlock } from '@/lib/time-block';
import { withProposalDeprecationHeaders } from '@/lib/api-deprecation';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deprecated = <T extends Response>(res: T) => withProposalDeprecationHeaders(req, res);
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return deprecated(auth);

  const { id } = await params;
  const proposal = await prisma.proposal.findUnique({
    where: { id },
    include: { itineraryItem: true },
  });
  if (!proposal) return deprecated(NextResponse.json({ error: 'Not found' }, { status: 404 }));

  const access = await requireTripRole(proposal.tripId, auth.id, ['owner']);
  if (!access.ok) return deprecated(buildForbiddenResponse());

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

  return deprecated(NextResponse.json({ proposal: updated, itineraryItem: fullItineraryItem }));
}
