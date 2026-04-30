import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!token || typeof token !== 'string' || !token.trim()) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  const trip = await prisma.trip.findUnique({
    where: { shareToken: token },
    include: {
      activities: {
        where: { status: 'approved' },
        orderBy: { createdAt: 'asc' },
      },
      itineraryItems: {
        where: { activity: { status: 'approved' } },
        include: { activity: true },
        orderBy: [{ day: 'asc' }, { timeBlock: 'asc' }, { order: 'asc' }],
      },
    },
  });

  if (!trip) {
    return NextResponse.json({ error: 'Trip not found or link expired' }, { status: 404 });
  }

  // Strip sensitive fields
  const { shareToken: _shareToken, ...tripData } = trip;
  void _shareToken;

  return NextResponse.json(tripData);
}
