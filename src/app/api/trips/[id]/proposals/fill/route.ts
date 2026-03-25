import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fillProposalDetails } from '@/lib/llm';
import { geocodeWithGoogleMaps } from '@/lib/geocoding';
import { buildForbiddenResponse, requireAuth, requireTripRole } from '@/lib/auth';
import { withProposalDeprecationHeaders } from '@/lib/api-deprecation';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deprecated = <T extends Response>(res: T) => withProposalDeprecationHeaders(req, res);
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return deprecated(auth);

  const { id } = await params;
  const access = await requireTripRole(id, auth.id, ['owner']);
  if (!access.ok) return deprecated(buildForbiddenResponse());

  const body = await req.json();
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const city = typeof body.city === 'string' ? body.city.trim() : '';

  if (!title || !city) {
    return deprecated(NextResponse.json(
      { error: 'title and city are required' },
      { status: 400 }
    ));
  }

  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip) return deprecated(NextResponse.json({ error: 'Trip not found' }, { status: 404 }));

  const [filled, geocoded] = await Promise.all([
    fillProposalDetails(title, city),
    geocodeWithGoogleMaps(`${title}, ${city}`),
  ]);

  return deprecated(NextResponse.json({
    ...filled,
    lat: geocoded?.lat ?? null,
    lng: geocoded?.lng ?? null,
  }));
}
