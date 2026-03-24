import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildForbiddenResponse, requireAuth, requireTripRole } from '@/lib/auth';

async function findMaxItemDay(tx: {
  itineraryItem: {
    findMany: (args: unknown) => Promise<Array<{ day: number }>>;
  };
}, tripId: string): Promise<number> {
  const rows = await tx.itineraryItem.findMany({
    where: { tripId },
    select: { day: true },
    orderBy: { day: 'desc' },
    take: 1,
  });
  return rows[0]?.day ?? 0;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const access = await requireTripRole(id, auth.id, ['owner']);
  if (!access.ok) return buildForbiddenResponse();

  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  if (trip.durationDays != null) {
    return NextResponse.json({ error: 'Cannot add manual day when durationDays is set' }, { status: 400 });
  }

  const maxItemDay = await findMaxItemDay(prisma, id);
  const currentVisible = Math.max(trip.itineraryVisibleDays ?? 0, maxItemDay);
  const nextVisible = currentVisible + 1;

  const updatedTrip = await prisma.trip.update({
    where: { id },
    data: { itineraryVisibleDays: nextVisible },
  });

  return NextResponse.json({ trip: updatedTrip });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const access = await requireTripRole(id, auth.id, ['owner']);
  if (!access.ok) return buildForbiddenResponse();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request body. Expected a JSON object.' }, { status: 400 });
  }
  const { day } = body as { day?: unknown };
  if (!Number.isInteger(day) || day < 1) {
    return NextResponse.json({ error: 'Invalid day. Expected a positive integer.' }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const trip = await tx.trip.findUnique({ where: { id } });
    if (!trip) return { error: 'Trip not found', status: 404 as const };
    if (trip.durationDays != null) {
      return { error: 'Cannot delete manual day when durationDays is set', status: 400 as const };
    }

    const maxItemDayBefore = await findMaxItemDay(tx, id);
    const currentVisible = Math.max(trip.itineraryVisibleDays ?? 0, maxItemDayBefore);
    if (day > currentVisible) {
      return { error: 'Day is out of visible range', status: 400 as const };
    }

    const dayItems = await tx.itineraryItem.findMany({
      where: { tripId: id, day },
      select: { id: true },
      take: 1,
    });
    if (dayItems.length > 0) {
      return { error: 'Only empty day can be deleted', status: 400 as const };
    }

    await tx.itineraryItem.updateMany({
      where: { tripId: id, day: { gt: day } },
      data: { day: { decrement: 1 } },
    });

    const maxItemDayAfter = maxItemDayBefore > day ? maxItemDayBefore - 1 : maxItemDayBefore;
    const nextVisible = Math.max(maxItemDayAfter, currentVisible - 1);
    const updatedTrip = await tx.trip.update({
      where: { id },
      data: { itineraryVisibleDays: nextVisible > 0 ? nextVisible : null },
    });

    const updatedItinerary = await tx.itineraryItem.findMany({
      where: { tripId: id },
      include: { proposal: true },
      orderBy: [{ day: 'asc' }, { timeBlock: 'asc' }, { order: 'asc' }],
    });

    return { trip: updatedTrip, itinerary: updatedItinerary };
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
