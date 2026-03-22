import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

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

  const { name, cities } = await req.json();
  const trip = await prisma.$transaction(async (tx) => {
    const createdTrip = await tx.trip.create({
      data: {
        name,
        cities: JSON.stringify(cities),
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
