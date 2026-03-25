import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildForbiddenResponse, requireAuth, requireTripRole } from '@/lib/auth';
import { isValidDateOnly } from '@/lib/dates';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const access = await requireTripRole(id, auth.id, ['owner', 'viewer']);
  if (!access.ok) return buildForbiddenResponse();

  const trip = await prisma.trip.findUnique({
    where: { id },
  });
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ...trip, currentRole: access.role });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const access = await requireTripRole(id, auth.id, ['owner']);
  if (!access.ok) return buildForbiddenResponse();

  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.itineraryItem.deleteMany({ where: { tripId: id } });
  await prisma.activity.deleteMany({ where: { tripId: id } });
  await prisma.tripMember.deleteMany({ where: { tripId: id } });
  await prisma.trip.delete({ where: { id } });

  return new NextResponse(null, { status: 204 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const access = await requireTripRole(id, auth.id, ['owner']);
  if (!access.ok) return buildForbiddenResponse();

  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json(
      { error: 'Invalid request body. Expected a JSON object.' },
      { status: 400 },
    );
  }
  const { startDate, durationDays, name, cities } = body as {
    startDate?: unknown;
    durationDays?: unknown;
    name?: unknown;
    cities?: unknown;
  };
  const hasStartDate = Object.prototype.hasOwnProperty.call(body, 'startDate');
  const hasDurationDays = Object.prototype.hasOwnProperty.call(body, 'durationDays');
  const hasName = Object.prototype.hasOwnProperty.call(body, 'name');
  const hasCities = Object.prototype.hasOwnProperty.call(body, 'cities');
  const normalizedStartDate = typeof startDate === 'string' && startDate.trim().length > 0
    ? startDate.trim()
    : startDate == null || startDate === ''
      ? null
      : startDate;
  const normalizedDurationDays = durationDays == null || durationDays === ''
    ? null
    : Number(durationDays);

  if (normalizedStartDate != null && typeof normalizedStartDate !== 'string') {
    return NextResponse.json({ error: 'Invalid startDate. Expected YYYY-MM-DD.' }, { status: 400 });
  }

  if (typeof normalizedStartDate === 'string' && !isValidDateOnly(normalizedStartDate)) {
    return NextResponse.json({ error: 'Invalid startDate. Expected YYYY-MM-DD.' }, { status: 400 });
  }

  if (
    normalizedDurationDays != null &&
    (!Number.isInteger(normalizedDurationDays) || normalizedDurationDays <= 0)
  ) {
    return NextResponse.json({ error: 'Invalid durationDays. Expected a positive integer.' }, { status: 400 });
  }

  if (hasName && (typeof name !== 'string' || !name.trim())) {
    return NextResponse.json({ error: 'Invalid name. Expected non-empty string.' }, { status: 400 });
  }
  if (hasCities) {
    if (!Array.isArray(cities) || cities.length === 0 || cities.some((city) => typeof city !== 'string' || !city.trim())) {
      return NextResponse.json(
        { error: 'Invalid cities. Expected a non-empty array of non-empty strings.' },
        { status: 400 },
      );
    }
  }

  const data: { name?: string; cities?: string; startDate?: string | null; durationDays?: number | null } = {};
  if (hasName) data.name = (name as string).trim();
  if (hasCities) data.cities = JSON.stringify((cities as string[]).map((city) => city.trim()));
  if (hasStartDate) data.startDate = normalizedStartDate;
  if (hasDurationDays) data.durationDays = normalizedDurationDays;

  const updated = await prisma.trip.update({
    where: { id },
    data,
  });

  return NextResponse.json({ ...updated, currentRole: access.role });
}
