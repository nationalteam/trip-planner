import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildForbiddenResponse, requireAuth, requireTripRole } from '@/lib/auth';

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

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
  await prisma.proposal.deleteMany({ where: { tripId: id } });
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

  const body = await req.json();
  const { startDate, durationDays } = body;
  const hasStartDate = Object.prototype.hasOwnProperty.call(body, 'startDate');
  const hasDurationDays = Object.prototype.hasOwnProperty.call(body, 'durationDays');
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

  const data: { startDate?: string | null; durationDays?: number | null } = {};
  if (hasStartDate) data.startDate = normalizedStartDate;
  if (hasDurationDays) data.durationDays = normalizedDurationDays;

  const updated = await prisma.trip.update({
    where: { id },
    data,
  });

  return NextResponse.json({ ...updated, currentRole: access.role });
}
