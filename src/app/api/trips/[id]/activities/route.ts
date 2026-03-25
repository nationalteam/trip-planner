import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateProposals } from '@/lib/llm';
import { getCoordinateCentroid, normalizeCoordinateBatch } from '@/lib/coordinates';
import { geocodeWithGoogleMaps } from '@/lib/geocoding';
import { buildForbiddenResponse, requireAuth, requireTripRole } from '@/lib/auth';

interface GeneratedActivity {
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

type ResolvedActivity = GeneratedActivity & { lat: number; lng: number };
type ActivitySortField = 'createdAt' | 'title' | 'city' | 'status';
type SortOrder = 'asc' | 'desc';

function hasResolvedCoordinates(activity: ResolvedActivity | null): activity is ResolvedActivity {
  return activity !== null;
}

function mapGoogleTypesToActivityType(types: string[]): 'food' | 'hotel' | 'place' {
  const normalized = types.map((type) => type.toLowerCase());
  if (normalized.includes('lodging')) return 'hotel';
  if (normalized.includes('restaurant') || normalized.includes('food') || normalized.includes('cafe')) return 'food';
  return 'place';
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const access = await requireTripRole(id, auth.id, ['owner', 'viewer']);
  if (!access.ok) return buildForbiddenResponse();

  const sortBy = req.nextUrl.searchParams.get('sortBy');
  const order = req.nextUrl.searchParams.get('order');
  const supportedSortBy: ActivitySortField[] = ['createdAt', 'title', 'city', 'status'];
  const resolvedSortBy: ActivitySortField = supportedSortBy.includes(sortBy as ActivitySortField)
    ? (sortBy as ActivitySortField)
    : 'createdAt';
  const resolvedOrder: SortOrder = order === 'asc' ? 'asc' : 'desc';

  const activities = await prisma.proposal.findMany({
    where: { tripId: id },
    orderBy: { [resolvedSortBy]: resolvedOrder },
  });
  return NextResponse.json(activities);
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
        { error: 'Manual activity requires non-empty title, description, and city' },
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
        { error: 'Failed to resolve coordinates for this activity. Please try again or provide valid lat/lng.' },
        { status: 400 }
      );
    }

    const normalized = normalizeCoordinateBatch([resolvedCoordinates])[0];
    const activity = await prisma.proposal.create({
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

    return NextResponse.json(activity, { status: 201 });
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
      return NextResponse.json(
        { error: 'Google place activity requires non-empty placeId, title, lat, and lng' },
        { status: 400 }
      );
    }

    const duplicate = await prisma.proposal.findFirst({
      where: {
        tripId: id,
        googlePlaceId: placeId,
      },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json({ error: 'This place is already added to the trip' }, { status: 409 });
    }

    const normalized = normalizeCoordinateBatch([{ lat: parsedLat, lng: parsedLng }])[0];
    const activity = await prisma.proposal.create({
      data: {
        tripId: id,
        type: mapGoogleTypesToActivityType(types),
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

    return NextResponse.json(activity, { status: 201 });
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
  const existingActivities = await prisma.proposal.findMany({
    where: { tripId: id },
  });
  const existingCenter = getCoordinateCentroid(
    existingActivities.filter((activity) => activity.city === city)
  );

  const generated: GeneratedActivity[] = await generateProposals(allPreferences, city, existingActivities);
  const withCoordinates = await Promise.all(generated.map(async (activity) => {
    const geocoded = await geocodeWithGoogleMaps(`${activity.title}, ${activity.city || city}`);
    return geocoded ? { ...activity, ...geocoded } : null;
  }));
  const normalizedGenerated = normalizeCoordinateBatch(
    withCoordinates.filter(hasResolvedCoordinates),
    { reference: existingCenter ?? undefined }
  );

  const activities = await prisma.$transaction(
    normalizedGenerated.map((activity) =>
      prisma.proposal.create({
        data: {
          tripId: id,
          type: activity.type || 'place',
          title: activity.title,
          description: activity.description,
          reason: activity.reason || '',
          lat: activity.lat,
          lng: activity.lng,
          city: activity.city || city,
          suggestedTime: activity.suggestedTime || 'afternoon',
          durationMinutes: activity.durationMinutes || null,
          status: 'pending',
        },
      })
    )
  );

  return NextResponse.json(activities, { status: 201 });
}
