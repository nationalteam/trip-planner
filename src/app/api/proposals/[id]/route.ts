import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const proposal = await prisma.proposal.findUnique({ where: { id } });
  if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.itineraryItem.deleteMany({ where: { proposalId: id } });
  await prisma.proposal.delete({ where: { id } });

  return new NextResponse(null, { status: 204 });
}
