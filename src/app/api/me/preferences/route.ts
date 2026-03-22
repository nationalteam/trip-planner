import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const pref = await prisma.preference.findFirst({
    where: { userId: auth.id },
  });
  return NextResponse.json(pref || null);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { likes, dislikes, budget } = await req.json();
  const existing = await prisma.preference.findFirst({ where: { userId: auth.id } });
  if (existing) return NextResponse.json({ error: 'Preference already exists' }, { status: 409 });

  const pref = await prisma.preference.create({
    data: {
      userId: auth.id,
      likes: JSON.stringify(likes || []),
      dislikes: JSON.stringify(dislikes || []),
      budget: budget || null,
    },
  });

  return NextResponse.json(pref, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { likes, dislikes, budget } = await req.json();
  const existing = await prisma.preference.findFirst({ where: { userId: auth.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const pref = await prisma.preference.update({
    where: { id: existing.id },
    data: {
      likes: JSON.stringify(likes || []),
      dislikes: JSON.stringify(dislikes || []),
      budget: budget || null,
    },
  });
  return NextResponse.json(pref);
}
