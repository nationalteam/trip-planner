import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { organizeItinerary, type OrganizedItineraryItem } from '@/lib/llm';
import { buildForbiddenResponse, requireAuth, requireTripRole } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const access = await requireTripRole(id, auth.id, ['owner', 'viewer']);
  if (!access.ok) return buildForbiddenResponse();

  const items = await prisma.itineraryItem.findMany({
    where: { tripId: id },
    include: { proposal: true },
    orderBy: [{ day: 'asc' }, { timeBlock: 'asc' }, { order: 'asc' }],
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const access = await requireTripRole(id, auth.id, ['owner']);
  if (!access.ok) return buildForbiddenResponse();

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
      normalized.map((item, index) =>
        prisma.itineraryItem.update({
          where: { id: item.id },
          data: { day: item.day, timeBlock: item.timeBlock, order: index },
        })
      )
    );

    const updatedWithProposal = await prisma.itineraryItem.findMany({
      where: { id: { in: updatedItems.map(item => item.id) } },
      include: { proposal: true },
      orderBy: [{ day: 'asc' }, { timeBlock: 'asc' }, { order: 'asc' }],
    });

    return NextResponse.json(updatedWithProposal);
  } catch (error) {
    console.error(`Failed to organize itinerary for trip ${id}`, error);
    return NextResponse.json({ error: 'Failed to organize itinerary' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const access = await requireTripRole(id, auth.id, ['owner']);
  if (!access.ok) return buildForbiddenResponse();

  try {
    const body = await req.json();
    if (!Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request body: expected an array' }, { status: 400 });
    }

    const existingItems = await prisma.itineraryItem.findMany({ where: { tripId: id } });
    const existingIds = new Set(existingItems.map(item => item.id));
    const validTimeBlocks = new Set(['morning', 'afternoon', 'dinner']);

    for (const item of body) {
      if (typeof item.id !== 'string' || !existingIds.has(item.id)) {
        return NextResponse.json({ error: 'Invalid item id' }, { status: 400 });
      }
      if (!Number.isInteger(item.day) || item.day < 1) {
        return NextResponse.json({ error: 'Invalid day' }, { status: 400 });
      }
      if (!validTimeBlocks.has(item.timeBlock)) {
        return NextResponse.json({ error: 'Invalid timeBlock' }, { status: 400 });
      }
      if (!Number.isInteger(item.order) || item.order < 0) {
        return NextResponse.json({ error: 'Invalid order' }, { status: 400 });
      }
    }

    const updatedItems = await prisma.$transaction(
      body.map((item: { id: string; day: number; timeBlock: string; order: number }) =>
        prisma.itineraryItem.update({
          where: { id: item.id },
          data: { day: item.day, timeBlock: item.timeBlock, order: item.order },
          include: { proposal: true },
        })
      )
    );

    return NextResponse.json(updatedItems);
  } catch (error) {
    console.error(`Failed to update itinerary for trip ${id}`, error);
    return NextResponse.json({ error: 'Failed to update itinerary' }, { status: 500 });
  }
}
