import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildForbiddenResponse, requireAuth, requireTripRole } from '@/lib/auth';
import { normalizeSuggestedTimeToTimeBlock } from '@/lib/time-block';

type SlotEntry = { day: number; timeBlock: string };
type ItineraryItemWithActivity = {
  id: string;
  tripId: string;
  activityId: string;
  day: number;
  timeBlock: string;
  order: number;
  activity: Record<string, unknown>;
};

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

    // Track slots taken during this batch so we don't double-book within the same call
    const takenSlots: SlotEntry[] = existingItems.map((item) => ({
      day: item.day,
      timeBlock: item.timeBlock,
    }));

    const alreadyHasItemIds: string[] = [];
    const newlyCreatedItems: ItineraryItemWithActivity[] = [];

    for (const activity of pendingActivities) {
      if (activity.itineraryItem) {
        alreadyHasItemIds.push(activity.itineraryItem.id);
        continue;
      }

      const timeBlock = normalizeSuggestedTimeToTimeBlock(activity.suggestedTime);
      let day = 1;
      while (takenSlots.some((s) => s.day === day && s.timeBlock === timeBlock)) {
        day++;
      }
      takenSlots.push({ day, timeBlock });

      const newItem = await tx.itineraryItem.create({
        data: { tripId, activityId: activity.id, day, timeBlock },
        include: { activity: true },
      }) as ItineraryItemWithActivity;
      newlyCreatedItems.push(newItem);
    }

    const existingFullItems: ItineraryItemWithActivity[] = alreadyHasItemIds.length > 0
      ? await tx.itineraryItem.findMany({
          where: { id: { in: alreadyHasItemIds } },
          include: { activity: true },
        }) as ItineraryItemWithActivity[]
      : [];

    const updatedActivities = await tx.activity.findMany({
      where: { tripId, id: { in: pendingActivities.map((a) => a.id) } },
    });

    return {
      activities: updatedActivities,
      itineraryItems: [...existingFullItems, ...newlyCreatedItems],
    };
  });

  return NextResponse.json(result);
}
