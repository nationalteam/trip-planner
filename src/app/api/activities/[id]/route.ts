import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildForbiddenResponse, requireAuth, requireTripRole } from '@/lib/auth';
import { normalizeCoordinateBatch } from '@/lib/coordinates';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const activity = await prisma.activity.findUnique({ where: { id } });
  if (!activity) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const access = await requireTripRole(activity.tripId, auth.id, ['owner']);
  if (!access.ok) return buildForbiddenResponse();

  await prisma.itineraryItem.deleteMany({ where: { activityId: id } });
  await prisma.activity.delete({ where: { id } });

  return new NextResponse(null, { status: 204 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const activity = await prisma.activity.findUnique({ where: { id } });
  if (!activity) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const access = await requireTripRole(activity.tripId, auth.id, ['owner']);
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

  const payload = body as Record<string, unknown>;
  const data: Record<string, unknown> = {};

  if (Object.prototype.hasOwnProperty.call(payload, 'title')) {
    if (typeof payload.title !== 'string' || !payload.title.trim()) {
      return NextResponse.json({ error: 'Invalid title. Expected non-empty string.' }, { status: 400 });
    }
    data.title = payload.title.trim();
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'description')) {
    if (typeof payload.description !== 'string' || !payload.description.trim()) {
      return NextResponse.json({ error: 'Invalid description. Expected non-empty string.' }, { status: 400 });
    }
    data.description = payload.description.trim();
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'city')) {
    if (typeof payload.city !== 'string' || !payload.city.trim()) {
      return NextResponse.json({ error: 'Invalid city. Expected non-empty string.' }, { status: 400 });
    }
    data.city = payload.city.trim();
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'type')) {
    if (payload.type !== 'food' && payload.type !== 'place' && payload.type !== 'hotel') {
      return NextResponse.json({ error: 'Invalid type. Expected one of food/place/hotel.' }, { status: 400 });
    }
    data.type = payload.type;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'suggestedTime')) {
    if (!['morning', 'lunch', 'afternoon', 'dinner', 'night'].includes(String(payload.suggestedTime))) {
      return NextResponse.json({ error: 'Invalid suggestedTime.' }, { status: 400 });
    }
    data.suggestedTime = payload.suggestedTime;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'durationMinutes')) {
    const raw = payload.durationMinutes;
    if (raw == null || raw === '') {
      data.durationMinutes = null;
    } else if (!Number.isInteger(raw) || Number(raw) <= 0) {
      return NextResponse.json({ error: 'Invalid durationMinutes. Expected a positive integer.' }, { status: 400 });
    } else {
      data.durationMinutes = Number(raw);
    }
  }

  const hasLat = Object.prototype.hasOwnProperty.call(payload, 'lat');
  const hasLng = Object.prototype.hasOwnProperty.call(payload, 'lng');
  if (hasLat || hasLng) {
    const lat = Number(payload.lat);
    const lng = Number(payload.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: 'Invalid coordinates. lat and lng must both be finite numbers.' }, { status: 400 });
    }
    const normalized = normalizeCoordinateBatch([{ lat, lng }])[0];
    data.lat = normalized.lat;
    data.lng = normalized.lng;
  }

  const updated = await prisma.activity.update({
    where: { id },
    data,
  });

  return NextResponse.json(updated);
}
