import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSession, hashPassword, setSessionCookie, validateEmail, validatePassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { email, password, name } = await req.json();

  if (!validateEmail(email) || !validatePassword(password) || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      name: name.trim(),
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  const { rawToken, session } = await createSession(user.id);
  const res = NextResponse.json(user, { status: 201 });
  setSessionCookie(res, rawToken, session.expiresAt);
  return res;
}
