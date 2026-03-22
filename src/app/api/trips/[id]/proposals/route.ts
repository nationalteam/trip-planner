import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateProposals } from '@/lib/llm';
import { getCoordinateCentroid, normalizeCoordinateBatch } from '@/lib/coordinates';
import { geocodeWithGoogleMaps } from '@/lib/geocoding';

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

function hasResolvedCoordinates(proposal: ResolvedProposal | null): proposal is ResolvedProposal {
  return proposal !== null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const proposals = await prisma.proposal.findMany({
    where: { tripId: id },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(proposals);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { city } = await req.json();

  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

  const allPreferences = await prisma.preference.findMany();
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
