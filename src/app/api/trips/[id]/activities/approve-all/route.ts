import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildForbiddenResponse, requireAuth, requireTripRole } from '@/lib/auth';
import { normalizeSuggestedTimeToTimeBlock } from '@/lib/time-block';

type SlotEntry = { day: number; timeBlock: string };

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id: tripId } = await params;

  const access = await requireTripRole(tripId, auth.id, ['owner']);
  if (!access.ok) return buildForbiddenResponse();

  const result = await prisma.$transaction(async (tx) => {
    const pendingActivities = await tx.activity.findMany({
      where: { tripId, status: 'pending' },
      include: { itineraryItem: true },
    });

    if (pendingActivities.length === 0) {
      return { activities: [], itineraryItems: [] };
    }

    await tx.activity.updateMany({
      where: { tripId, status: 'pending' },
      data: { status: 'approved' },
    });

    const existingItems = await tx.itineraryItem.findMany({
      where: { tripId },
      orderBy: { day: 'asc' },
    });

    const createdItems = [];
    // Track slots taken during this batch so we don't double-book within the same call
    const takenSlots = existingItems.map((item: SlotEntry) => ({
      day: item.day,
      timeBlock: item.timeBlock,
    }));

    for (const activity of pendingActivities) {
      if (activity.itineraryItem) {
        const fullItem = await tx.itineraryItem.findUnique({
          where: { id: activity.itineraryItem.id },
          include: { activity: true },
        });
        if (fullItem) createdItems.push(fullItem);
        continue;
      }

      const timeBlock = normalizeSuggestedTimeToTimeBlock(activity.suggestedTime);
      let day = 1;
      while (takenSlots.some((s: SlotEntry) => s.day === day && s.timeBlock === timeBlock)) {
        day++;
      }
      takenSlots.push({ day, timeBlock });

      const newItem = await tx.itineraryItem.create({
        data: { tripId, activityId: activity.id, day, timeBlock },
      });
      const fullItem = await tx.itineraryItem.findUnique({
        where: { id: newItem.id },
        include: { activity: true },
      });
      if (fullItem) createdItems.push(fullItem);
    }

    const updatedActivities = await tx.activity.findMany({
      where: { tripId, id: { in: pendingActivities.map((a: { id: string }) => a.id) } },
    });

    return { activities: updatedActivities, itineraryItems: createdItems };
  });

  return NextResponse.json(result);
}
