import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { isValidDateOnly } from '@/lib/dates';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const trips = await prisma.trip.findMany({
    where: {
      members: {
        some: { userId: auth.id },
      },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { proposals: true, itineraryItems: true },
      },
    },
  });
  return NextResponse.json(trips);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { name, cities, startDate, durationDays } = await req.json();

  const normalizedStartDate = typeof startDate === 'string' && startDate.trim().length > 0
    ? startDate.trim()
    : null;
  const normalizedDurationDays = durationDays == null || durationDays === ''
    ? null
    : Number(durationDays);

  if (normalizedStartDate && !isValidDateOnly(normalizedStartDate)) {
    return NextResponse.json({ error: 'Invalid startDate. Expected YYYY-MM-DD.' }, { status: 400 });
  }

  if (
    normalizedDurationDays != null &&
    (!Number.isInteger(normalizedDurationDays) || normalizedDurationDays <= 0)
  ) {
    return NextResponse.json({ error: 'Invalid durationDays. Expected a positive integer.' }, { status: 400 });
  }

  const trip = await prisma.$transaction(async (tx) => {
    const createdTrip = await tx.trip.create({
      data: {
        name,
        cities: JSON.stringify(cities),
        startDate: normalizedStartDate,
        durationDays: normalizedDurationDays,
      },
    });
    await tx.tripMember.create({
      data: {
        tripId: createdTrip.id,
        userId: auth.id,
        role: 'owner',
      },
    });
    return createdTrip;
  });

  return NextResponse.json(trip, { status: 201 });
}
