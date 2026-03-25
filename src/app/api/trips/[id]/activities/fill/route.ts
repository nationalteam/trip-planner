import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fillProposalDetails } from '@/lib/llm';
import { geocodeWithGoogleMaps } from '@/lib/geocoding';
import { buildForbiddenResponse, requireAuth, requireTripRole } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const access = await requireTripRole(id, auth.id, ['owner']);
  if (!access.ok) return buildForbiddenResponse();

  const body = await req.json();
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const city = typeof body.city === 'string' ? body.city.trim() : '';

  if (!title || !city) {
    return NextResponse.json(
      { error: 'title and city are required' },
      { status: 400 }
    );
  }

  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

  const [filled, geocoded] = await Promise.all([
    fillProposalDetails(title, city),
    geocodeWithGoogleMaps(`${title}, ${city}`),
  ]);

  return NextResponse.json({
    ...filled,
    lat: geocoded?.lat ?? null,
    lng: geocoded?.lng ?? null,
  });
}
