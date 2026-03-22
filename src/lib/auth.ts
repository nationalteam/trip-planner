import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'crypto';
import { promisify } from 'util';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SESSION_COOKIE_NAME } from '@/lib/auth-constants';

const scrypt = promisify(scryptCallback);

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${Buffer.from(derived).toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, hashHex] = storedHash.split(':');
  if (!salt || !hashHex) return false;

  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = Buffer.from(derived);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(password: string): boolean {
  return typeof password === 'string' && password.length >= 8;
}

export function buildUnauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export function buildForbiddenResponse() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

export async function getAuthUserFromRequest(req: NextRequest): Promise<AuthUser | null> {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  if (!session) return null;

  if (session.expiresAt <= new Date()) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  return session.user;
}

export async function requireAuth(req: NextRequest): Promise<AuthUser | NextResponse> {
  const user = await getAuthUserFromRequest(req);
  if (!user) return buildUnauthorizedResponse();
  return user;
}

export async function createSession(userId: string) {
  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return { rawToken, session };
}

export function setSessionCookie(res: NextResponse, rawToken: string, expiresAt: Date) {
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: rawToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: new Date(0),
    path: '/',
  });
}

export async function requireTripRole(tripId: string, userId: string, roles: Array<'owner' | 'viewer'>) {
  const membership = await prisma.tripMember.findUnique({
    where: {
      tripId_userId: {
        tripId,
        userId,
      },
    },
  });

  if (!membership) {
    return { ok: false as const, status: 403 as const };
  }

  if (!roles.includes(membership.role as 'owner' | 'viewer')) {
    return { ok: false as const, status: 403 as const };
  }

  return { ok: true as const, role: membership.role as 'owner' | 'viewer' };
}
