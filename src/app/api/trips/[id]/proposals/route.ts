import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateProposals } from '@/lib/llm';
import { getCoordinateCentroid, normalizeCoordinateBatch } from '@/lib/coordinates';
import { geocodeWithGoogleMaps } from '@/lib/geocoding';
import { buildForbiddenResponse, requireAuth, requireTripRole } from '@/lib/auth';
import { withProposalDeprecationHeaders } from '@/lib/api-deprecation';

interface GeneratedProposal {
  type?: string;
  title: string;
  description: string;
  reason?: string;
  lat?: number;
  lng?: number;
  city?: string;
  suggestedTime?: string;
  durationMinutes?: number | null;
}

type ResolvedProposal = GeneratedProposal & { lat: number; lng: number };
type ProposalSortField = 'createdAt' | 'title' | 'city' | 'status';
type SortOrder = 'asc' | 'desc';

function hasResolvedCoordinates(proposal: ResolvedProposal | null): proposal is ResolvedProposal {
  return proposal !== null;
}

function mapGoogleTypesToProposalType(types: string[]): 'food' | 'hotel' | 'place' {
  const normalized = types.map((type) => type.toLowerCase());
  if (normalized.includes('lodging')) return 'hotel';
  if (normalized.includes('restaurant') || normalized.includes('food') || normalized.includes('cafe')) return 'food';
  return 'place';
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deprecated = <T extends Response>(res: T) => withProposalDeprecationHeaders(req, res);
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return deprecated(auth);

  const { id } = await params;
  const access = await requireTripRole(id, auth.id, ['owner', 'viewer']);
  if (!access.ok) return deprecated(buildForbiddenResponse());

  const sortBy = req.nextUrl.searchParams.get('sortBy');
  const order = req.nextUrl.searchParams.get('order');
  const supportedSortBy: ProposalSortField[] = ['createdAt', 'title', 'city', 'status'];
  const resolvedSortBy: ProposalSortField = supportedSortBy.includes(sortBy as ProposalSortField)
    ? (sortBy as ProposalSortField)
    : 'createdAt';
  const resolvedOrder: SortOrder = order === 'asc' ? 'asc' : 'desc';

  const proposals = await prisma.proposal.findMany({
    where: { tripId: id },
    orderBy: { [resolvedSortBy]: resolvedOrder },
  });
  return deprecated(NextResponse.json(proposals));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deprecated = <T extends Response>(res: T) => withProposalDeprecationHeaders(req, res);
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return deprecated(auth);

  const { id } = await params;
  const access = await requireTripRole(id, auth.id, ['owner']);
  if (!access.ok) return deprecated(buildForbiddenResponse());

  const body = await req.json();

  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip) return deprecated(NextResponse.json({ error: 'Trip not found' }, { status: 404 }));

  if (body?.mode === 'manual') {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const city = typeof body.city === 'string' ? body.city.trim() : '';

    if (!title || !description || !city) {
      return deprecated(NextResponse.json(
        { error: 'Manual proposal requires non-empty title, description, and city' },
        { status: 400 }
      ));
    }

    const parsedLat = Number(body.lat);
    const parsedLng = Number(body.lng);
    const hasManualCoordinates = Number.isFinite(parsedLat) && Number.isFinite(parsedLng);
    const resolvedCoordinates = hasManualCoordinates
      ? { lat: parsedLat, lng: parsedLng }
      : await geocodeWithGoogleMaps(`${title}, ${city}`);
    if (!resolvedCoordinates) {
      return deprecated(NextResponse.json(
        { error: 'Failed to resolve coordinates for this proposal. Please try again or provide valid lat/lng.' },
        { status: 400 }
      ));
    }

    const normalized = normalizeCoordinateBatch([resolvedCoordinates])[0];
    const proposal = await prisma.proposal.create({
      data: {
        tripId: id,
        type: body.type || 'place',
        title,
        description,
        reason: '',
        lat: normalized.lat,
        lng: normalized.lng,
        city,
        suggestedTime: body.suggestedTime || 'afternoon',
        durationMinutes: body.durationMinutes || null,
        status: 'pending',
      },
    });

    return deprecated(NextResponse.json(proposal, { status: 201 }));
  }

  if (body?.mode === 'google_place') {
    const placeId = typeof body.placeId === 'string' ? body.placeId.trim() : '';
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const description = typeof body.description === 'string' && body.description.trim()
      ? body.description.trim()
      : 'Imported from Google Maps';
    const city = typeof body.city === 'string' && body.city.trim()
      ? body.city.trim()
      : 'Unknown';
    const formattedAddress = typeof body.formattedAddress === 'string' ? body.formattedAddress.trim() : '';
    const parsedLat = Number(body.lat);
    const parsedLng = Number(body.lng);
    const hasCoordinates = Number.isFinite(parsedLat) && Number.isFinite(parsedLng);
    const types = Array.isArray(body.types)
      ? body.types.filter((type: unknown): type is string => typeof type === 'string' && type.trim().length > 0)
      : [];

    if (!placeId || !title || !hasCoordinates) {
      return deprecated(NextResponse.json(
        { error: 'Google place proposal requires non-empty placeId, title, lat, and lng' },
        { status: 400 }
      ));
    }

    const duplicate = await prisma.proposal.findFirst({
      where: {
        tripId: id,
        googlePlaceId: placeId,
      },
      select: { id: true },
    });
    if (duplicate) {
      return deprecated(NextResponse.json({ error: 'This place is already added to the trip' }, { status: 409 }));
    }

    const normalized = normalizeCoordinateBatch([{ lat: parsedLat, lng: parsedLng }])[0];
    const proposal = await prisma.proposal.create({
      data: {
        tripId: id,
        type: mapGoogleTypesToProposalType(types),
        title,
        description,
        reason: '',
        lat: normalized.lat,
        lng: normalized.lng,
        city,
        suggestedTime: body.suggestedTime || 'afternoon',
        durationMinutes: body.durationMinutes || null,
        status: 'pending',
        googlePlaceId: placeId,
        formattedAddress: formattedAddress || null,
        googleTypes: types.length > 0 ? JSON.stringify(types) : null,
      },
    });

    return deprecated(NextResponse.json(proposal, { status: 201 }));
  }

  const city = body?.city;
  if (!city) {
    return deprecated(NextResponse.json({ error: 'City is required' }, { status: 400 }));
  }

  const members = await prisma.tripMember.findMany({
    where: { tripId: id },
    select: { userId: true },
  });
  const allPreferences = await prisma.preference.findMany({
    where: {
      userId: {
        in: members.map((member) => member.userId),
      },
    },
  });
  const existingProposals = await prisma.proposal.findMany({
    where: { tripId: id },
  });
  const existingCenter = getCoordinateCentroid(
    existingProposals.filter((proposal) => proposal.city === city)
  );

  const generated: GeneratedProposal[] = await generateProposals(allPreferences, city, existingProposals);
  const withCoordinates = await Promise.all(generated.map(async (proposal) => {
    const geocoded = await geocodeWithGoogleMaps(`${proposal.title}, ${proposal.city || city}`);
    return geocoded ? { ...proposal, ...geocoded } : null;
  }));
  const normalizedGenerated = normalizeCoordinateBatch(
    withCoordinates.filter(hasResolvedCoordinates),
    { reference: existingCenter ?? undefined }
  );

  const proposals = await prisma.$transaction(
    normalizedGenerated.map((p) =>
      prisma.proposal.create({
        data: {
          tripId: id,
          type: p.type || 'place',
          title: p.title,
          description: p.description,
          reason: p.reason || '',
          lat: p.lat,
          lng: p.lng,
          city: p.city || city,
          suggestedTime: p.suggestedTime || 'afternoon',
          durationMinutes: p.durationMinutes || null,
          status: 'pending',
        },
      })
    )
  );

  return deprecated(NextResponse.json(proposals, { status: 201 }));
}
