import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildForbiddenResponse, requireAuth, requireTripRole } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const access = await requireTripRole(id, auth.id, ['owner']);
  if (!access.ok) return buildForbiddenResponse();

  const { email } = await req.json();
  if (typeof email !== 'string' || !email.trim()) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, email: true, name: true },
  });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  if (user.id === auth.id) {
    return NextResponse.json({ error: 'Owner already has access' }, { status: 400 });
  }

  const member = await prisma.tripMember.upsert({
    where: {
      tripId_userId: {
        tripId: id,
        userId: user.id,
      },
    },
    create: {
      tripId: id,
      userId: user.id,
      role: 'viewer',
    },
    update: {
      role: 'viewer',
    },
  });

  return NextResponse.json({
    id: member.id,
    role: member.role,
    user,
  });
}
