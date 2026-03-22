import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildForbiddenResponse, requireAuth, requireTripRole } from '@/lib/auth';

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
