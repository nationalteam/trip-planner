import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSession, setSessionCookie, validateEmail, verifyPassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!validateEmail(email) || typeof password !== 'string') {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const { rawToken, session } = await createSession(user.id);
  const res = NextResponse.json({ id: user.id, email: user.email, name: user.name });
  setSessionCookie(res, rawToken, session.expiresAt);
  return res;
}
