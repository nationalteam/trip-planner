import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateProposals } from '@/lib/llm';
import { normalizeCoordinates } from '@/lib/coordinates';

interface GeneratedProposal {
  type?: string;
  title: string;
  description: string;
  reason?: string;
  lat: number;
  lng: number;
  city?: string;
  suggestedTime?: string;
  durationMinutes?: number | null;
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

  const generated: GeneratedProposal[] = await generateProposals(allPreferences, city, existingProposals);
  const normalizedGenerated = generated
    .map((proposal) => {
      const coords = normalizeCoordinates(proposal.lat, proposal.lng);
      if (!coords) return null;
      return {
        ...proposal,
        ...coords,
      };
    })
    .filter((proposal): proposal is GeneratedProposal => proposal !== null);

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
