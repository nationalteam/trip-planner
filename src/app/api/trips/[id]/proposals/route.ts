import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateProposals } from '@/lib/llm';
import { getCoordinateCentroid, normalizeCoordinateBatch } from '@/lib/coordinates';
import { geocodeWithGoogleMaps } from '@/lib/geocoding';
import { buildForbiddenResponse, requireAuth, requireTripRole } from '@/lib/auth';

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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const access = await requireTripRole(id, auth.id, ['owner', 'viewer']);
  if (!access.ok) return buildForbiddenResponse();

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
  return NextResponse.json(proposals);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const access = await requireTripRole(id, auth.id, ['owner']);
  if (!access.ok) return buildForbiddenResponse();

  const body = await req.json();

  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

  if (body?.mode === 'manual') {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const city = typeof body.city === 'string' ? body.city.trim() : '';

    if (!title || !description || !city) {
      return NextResponse.json(
        { error: 'Manual proposal requires non-empty title, description, and city' },
        { status: 400 }
      );
    }

    const parsedLat = Number(body.lat);
    const parsedLng = Number(body.lng);
    const hasManualCoordinates = Number.isFinite(parsedLat) && Number.isFinite(parsedLng);
    const resolvedCoordinates = hasManualCoordinates
      ? { lat: parsedLat, lng: parsedLng }
      : await geocodeWithGoogleMaps(`${title}, ${city}`);
    if (!resolvedCoordinates) {
      return NextResponse.json(
        { error: 'Failed to resolve coordinates for this proposal. Please provide lat/lng manually.' },
        { status: 400 }
      );
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

    return NextResponse.json(proposal, { status: 201 });
  }

  const city = body?.city;
  if (!city) {
    return NextResponse.json({ error: 'City is required' }, { status: 400 });
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

  return NextResponse.json(proposals, { status: 201 });
}
