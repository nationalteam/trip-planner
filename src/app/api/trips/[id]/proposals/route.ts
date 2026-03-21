import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateProposals } from '@/lib/llm';

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

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const proposals = await prisma.proposal.findMany({
    where: { tripId: params.id },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(proposals);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { city } = await req.json();

  const trip = await prisma.trip.findUnique({ where: { id: params.id } });
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

  const allPreferences = await prisma.preference.findMany();
  const approved = await prisma.proposal.findMany({
    where: { tripId: params.id, status: 'approved' },
  });

  const generated: GeneratedProposal[] = await generateProposals(allPreferences, city, approved);

  const proposals = await prisma.$transaction(
    generated.map((p) =>
      prisma.proposal.create({
        data: {
          tripId: params.id,
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
