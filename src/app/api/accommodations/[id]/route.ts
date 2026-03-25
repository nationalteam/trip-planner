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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const accommodation = await prisma.accommodation.findUnique({ where: { id } });
  if (!accommodation) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const access = await requireTripRole(accommodation.tripId, auth.id, ['owner']);
  if (!access.ok) return buildForbiddenResponse();

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
  const data: Record<string, unknown> = {};

  if (Object.prototype.hasOwnProperty.call(payload, 'name')) {
    if (typeof payload.name !== 'string' || !payload.name.trim()) {
      return NextResponse.json({ error: 'Invalid name. Expected non-empty string.' }, { status: 400 });
    }
    data.name = payload.name.trim();
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'address')) {
    if (typeof payload.address !== 'string' || !payload.address.trim()) {
      return NextResponse.json({ error: 'Invalid address. Expected non-empty string.' }, { status: 400 });
    }
    data.address = payload.address.trim();
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'notes')) {
    if (payload.notes == null || payload.notes === '') {
      data.notes = null;
    } else if (typeof payload.notes !== 'string') {
      return NextResponse.json({ error: 'Invalid notes. Expected string or null.' }, { status: 400 });
    } else {
      data.notes = payload.notes.trim();
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'lat')) {
    const lat = normalizeOptionalFiniteNumber(payload.lat);
    if (lat === undefined) {
      return NextResponse.json({ error: 'Invalid lat. Expected finite number or null.' }, { status: 400 });
    }
    data.lat = lat;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'lng')) {
    const lng = normalizeOptionalFiniteNumber(payload.lng);
    if (lng === undefined) {
      return NextResponse.json({ error: 'Invalid lng. Expected finite number or null.' }, { status: 400 });
    }
    data.lng = lng;
  }

  const nextCheckInDate = Object.prototype.hasOwnProperty.call(payload, 'checkInDate')
    ? (typeof payload.checkInDate === 'string' ? payload.checkInDate.trim() : '')
    : accommodation.checkInDate;
  const nextCheckOutDate = Object.prototype.hasOwnProperty.call(payload, 'checkOutDate')
    ? (typeof payload.checkOutDate === 'string' ? payload.checkOutDate.trim() : '')
    : accommodation.checkOutDate;

  if (Object.prototype.hasOwnProperty.call(payload, 'checkInDate') && !nextCheckInDate) {
    return NextResponse.json({ error: 'Invalid checkInDate. Expected YYYY-MM-DD string.' }, { status: 400 });
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'checkOutDate') && !nextCheckOutDate) {
    return NextResponse.json({ error: 'Invalid checkOutDate. Expected YYYY-MM-DD string.' }, { status: 400 });
  }

  if (!isValidAccommodationRange(nextCheckInDate, nextCheckOutDate)) {
    return NextResponse.json(
      { error: 'Invalid date range. checkInDate must be before checkOutDate and both must be YYYY-MM-DD.' },
      { status: 400 }
    );
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'checkInDate')) data.checkInDate = nextCheckInDate;
  if (Object.prototype.hasOwnProperty.call(payload, 'checkOutDate')) data.checkOutDate = nextCheckOutDate;

  const existing = await prisma.accommodation.findMany({
    where: { tripId: accommodation.tripId },
    select: { id: true, checkInDate: true, checkOutDate: true },
  });

  if (detectOverlappingAccommodation({ id, checkInDate: nextCheckInDate, checkOutDate: nextCheckOutDate }, existing)) {
    return NextResponse.json({ error: 'Accommodation date range overlaps with an existing stay.' }, { status: 400 });
  }

  const updated = await prisma.accommodation.update({
    where: { id },
    data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const accommodation = await prisma.accommodation.findUnique({ where: { id } });
  if (!accommodation) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const access = await requireTripRole(accommodation.tripId, auth.id, ['owner']);
  if (!access.ok) return buildForbiddenResponse();

  await prisma.accommodation.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
