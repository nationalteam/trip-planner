import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const proposal = await prisma.proposal.findUnique({ where: { id } });
  if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updated = await prisma.proposal.update({
    where: { id },
    data: { status: 'rejected' },
  });

  return NextResponse.json(updated);
}
