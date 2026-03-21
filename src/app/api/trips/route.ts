import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const trips = await prisma.trip.findMany({
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
  const { name, cities } = await req.json();
  const trip = await prisma.trip.create({
    data: {
      name,
      cities: JSON.stringify(cities),
    },
  });
  return NextResponse.json(trip, { status: 201 });
}
