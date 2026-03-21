import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pref = await prisma.preference.findFirst({
    where: { userId: id },
  });
  return NextResponse.json(pref || null);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { likes, dislikes, budget } = await req.json();
  const pref = await prisma.preference.create({
    data: {
      userId: id,
      likes: JSON.stringify(likes),
      dislikes: JSON.stringify(dislikes),
      budget: budget || null,
    },
  });
  return NextResponse.json(pref, { status: 201 });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { likes, dislikes, budget } = await req.json();
  const existing = await prisma.preference.findFirst({ where: { userId: id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const pref = await prisma.preference.update({
    where: { id: existing.id },
    data: {
      likes: JSON.stringify(likes),
      dislikes: JSON.stringify(dislikes),
      budget: budget || null,
    },
  });
  return NextResponse.json(pref);
}
