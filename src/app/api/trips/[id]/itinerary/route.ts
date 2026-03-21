import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { organizeItinerary, type OrganizedItineraryItem } from '@/lib/llm';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const items = await prisma.itineraryItem.findMany({
    where: { tripId: id },
    include: { proposal: true },
    orderBy: [{ day: 'asc' }],
  });
  return NextResponse.json(items);
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

    const items = await prisma.itineraryItem.findMany({
      where: { tripId: id },
      include: { proposal: true },
      orderBy: [{ day: 'asc' }],
    });
    if (items.length === 0) {
      return NextResponse.json([]);
    }

    const organized = await organizeItinerary(items);
    const itemIds = new Set(items.map(item => item.id));
    const validTimeBlocks = new Set(['morning', 'afternoon', 'dinner']);
    const normalized = organized.filter(
      (item): item is OrganizedItineraryItem =>
        typeof item?.id === 'string' &&
        itemIds.has(item.id) &&
        Number.isInteger(item.day) &&
        item.day >= 1 &&
        validTimeBlocks.has(item.timeBlock)
    );

    if (normalized.length !== items.length) {
      return NextResponse.json({ error: 'LLM returned incomplete or invalid itinerary mapping' }, { status: 500 });
    }

    const updatedItems = await prisma.$transaction(
      normalized.map(item =>
        prisma.itineraryItem.update({
          where: { id: item.id },
          data: { day: item.day, timeBlock: item.timeBlock },
        })
      )
    );

    const updatedWithProposal = await prisma.itineraryItem.findMany({
      where: { id: { in: updatedItems.map(item => item.id) } },
      include: { proposal: true },
      orderBy: [{ day: 'asc' }],
    });

    return NextResponse.json(updatedWithProposal);
  } catch (error) {
    console.error(`Failed to organize itinerary for trip ${id}`, error);
    return NextResponse.json({ error: 'Failed to organize itinerary' }, { status: 500 });
  }
}
