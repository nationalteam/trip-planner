import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trip = await prisma.trip.findUnique({
    where: { id },
  });
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(trip);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.itineraryItem.deleteMany({ where: { tripId: id } });
  await prisma.proposal.deleteMany({ where: { tripId: id } });
  await prisma.trip.delete({ where: { id } });

  return new NextResponse(null, { status: 204 });
}
