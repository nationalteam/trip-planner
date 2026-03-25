import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildForbiddenResponse, requireAuth, requireTripRole } from '@/lib/auth';
import { normalizeSuggestedTimeToTimeBlock } from '@/lib/time-block';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const activity = await prisma.activity.findUnique({
    where: { id },
    include: { itineraryItem: true },
  });
  if (!activity) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const access = await requireTripRole(activity.tripId, auth.id, ['owner']);
  if (!access.ok) return buildForbiddenResponse();

  const updated = await prisma.activity.update({
    where: { id },
    data: { status: 'approved' },
  });

  let itineraryItem = activity.itineraryItem;

  if (!itineraryItem) {
    const existingItems = await prisma.itineraryItem.findMany({
      where: { tripId: activity.tripId },
      orderBy: { day: 'asc' },
    });

    const timeBlock = normalizeSuggestedTimeToTimeBlock(activity.suggestedTime);

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
        tripId: activity.tripId,
        activityId: activity.id,
        day,
        timeBlock,
      },
    });
  }

  const fullItineraryItem = await prisma.itineraryItem.findUnique({
    where: { id: itineraryItem.id },
    include: { activity: true },
  });

  return NextResponse.json({ activity: updated, itineraryItem: fullItineraryItem });
}
