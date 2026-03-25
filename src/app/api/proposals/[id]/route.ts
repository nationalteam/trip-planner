import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildForbiddenResponse, requireAuth, requireTripRole } from '@/lib/auth';
import { normalizeCoordinateBatch } from '@/lib/coordinates';
import { withProposalDeprecationHeaders } from '@/lib/api-deprecation';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deprecated = <T extends Response>(res: T) => withProposalDeprecationHeaders(req, res);
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return deprecated(auth);

  const { id } = await params;
  const proposal = await prisma.proposal.findUnique({ where: { id } });
  if (!proposal) return deprecated(NextResponse.json({ error: 'Not found' }, { status: 404 }));

  const access = await requireTripRole(proposal.tripId, auth.id, ['owner']);
  if (!access.ok) return deprecated(buildForbiddenResponse());

  await prisma.itineraryItem.deleteMany({ where: { proposalId: id } });
  await prisma.proposal.delete({ where: { id } });

  return deprecated(new NextResponse(null, { status: 204 }));
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deprecated = <T extends Response>(res: T) => withProposalDeprecationHeaders(req, res);
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return deprecated(auth);

  const { id } = await params;
  const proposal = await prisma.proposal.findUnique({ where: { id } });
  if (!proposal) return deprecated(NextResponse.json({ error: 'Not found' }, { status: 404 }));

  const access = await requireTripRole(proposal.tripId, auth.id, ['owner']);
  if (!access.ok) return deprecated(buildForbiddenResponse());

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return deprecated(NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }));
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return deprecated(NextResponse.json({ error: 'Invalid request body. Expected a JSON object.' }, { status: 400 }));
  }

  const payload = body as Record<string, unknown>;
  const data: Record<string, unknown> = {};

  if (Object.prototype.hasOwnProperty.call(payload, 'title')) {
    if (typeof payload.title !== 'string' || !payload.title.trim()) {
      return deprecated(NextResponse.json({ error: 'Invalid title. Expected non-empty string.' }, { status: 400 }));
    }
    data.title = payload.title.trim();
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'description')) {
    if (typeof payload.description !== 'string' || !payload.description.trim()) {
      return deprecated(NextResponse.json({ error: 'Invalid description. Expected non-empty string.' }, { status: 400 }));
    }
    data.description = payload.description.trim();
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'city')) {
    if (typeof payload.city !== 'string' || !payload.city.trim()) {
      return deprecated(NextResponse.json({ error: 'Invalid city. Expected non-empty string.' }, { status: 400 }));
    }
    data.city = payload.city.trim();
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'type')) {
    if (payload.type !== 'food' && payload.type !== 'place' && payload.type !== 'hotel') {
      return deprecated(NextResponse.json({ error: 'Invalid type. Expected one of food/place/hotel.' }, { status: 400 }));
    }
    data.type = payload.type;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'suggestedTime')) {
    if (!['morning', 'lunch', 'afternoon', 'dinner', 'night'].includes(String(payload.suggestedTime))) {
      return deprecated(NextResponse.json({ error: 'Invalid suggestedTime.' }, { status: 400 }));
    }
    data.suggestedTime = payload.suggestedTime;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'durationMinutes')) {
    const raw = payload.durationMinutes;
    if (raw == null || raw === '') {
      data.durationMinutes = null;
    } else if (!Number.isInteger(raw) || Number(raw) <= 0) {
      return deprecated(NextResponse.json({ error: 'Invalid durationMinutes. Expected a positive integer.' }, { status: 400 }));
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
      return deprecated(NextResponse.json({ error: 'Invalid coordinates. lat and lng must both be finite numbers.' }, { status: 400 }));
    }
    const normalized = normalizeCoordinateBatch([{ lat, lng }])[0];
    data.lat = normalized.lat;
    data.lng = normalized.lng;
  }

  const updated = await prisma.proposal.update({
    where: { id },
    data,
  });

  return deprecated(NextResponse.json(updated));
}
