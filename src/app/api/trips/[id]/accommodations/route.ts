import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildForbiddenResponse, requireAuth, requireTripRole } from '@/lib/auth';
import {
  detectOverlappingAccommodation,
  isValidAccommodationRange,
} from '@/lib/accommodation';

function normalizeOptionalFiniteNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value == null || value === '') return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return value;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const access = await requireTripRole(id, auth.id, ['owner', 'viewer']);
  if (!access.ok) return buildForbiddenResponse();

  const accommodations = await prisma.accommodation.findMany({
    where: { tripId: id },
    orderBy: [{ checkInDate: 'asc' }, { createdAt: 'asc' }],
  });

  return NextResponse.json(accommodations);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const access = await requireTripRole(id, auth.id, ['owner']);
  if (!access.ok) return buildForbiddenResponse();

  const trip = await prisma.trip.findUnique({ where: { id }, select: { id: true } });
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request body. Expected a JSON object.' }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const address = typeof payload.address === 'string' ? payload.address.trim() : '';
  const checkInDate = typeof payload.checkInDate === 'string' ? payload.checkInDate.trim() : '';
  const checkOutDate = typeof payload.checkOutDate === 'string' ? payload.checkOutDate.trim() : '';
  const notes = typeof payload.notes === 'string' ? payload.notes.trim() : null;
  const hasLat = Object.prototype.hasOwnProperty.call(payload, 'lat');
  const hasLng = Object.prototype.hasOwnProperty.call(payload, 'lng');
  const lat = normalizeOptionalFiniteNumber(payload.lat);
  const lng = normalizeOptionalFiniteNumber(payload.lng);

  if (!name || !address || !checkInDate || !checkOutDate) {
    return NextResponse.json(
      { error: 'name, address, checkInDate, and checkOutDate are required.' },
      { status: 400 }
    );
  }

  if (!isValidAccommodationRange(checkInDate, checkOutDate)) {
    return NextResponse.json(
      { error: 'Invalid date range. checkInDate must be before checkOutDate and both must be YYYY-MM-DD.' },
      { status: 400 }
    );
  }

  if (hasLat !== hasLng) {
    return NextResponse.json({ error: 'Invalid coordinates. lat and lng must be provided together.' }, { status: 400 });
  }
  if ((hasLat || hasLng) && (lat === undefined || lng === undefined)) {
    return NextResponse.json({ error: 'Invalid coordinates. lat/lng must be finite numbers when provided.' }, { status: 400 });
  }

  const existing = await prisma.accommodation.findMany({
    where: { tripId: id },
    select: { id: true, checkInDate: true, checkOutDate: true },
  });

  if (detectOverlappingAccommodation({ checkInDate, checkOutDate }, existing)) {
    return NextResponse.json({ error: 'Accommodation date range overlaps with an existing stay.' }, { status: 400 });
  }

  const created = await prisma.accommodation.create({
    data: {
      tripId: id,
      name,
      address,
      checkInDate,
      checkOutDate,
      notes,
      lat: hasLat ? (lat ?? null) : null,
      lng: hasLng ? (lng ?? null) : null,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
