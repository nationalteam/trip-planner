import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clearSessionCookie, hashToken } from '@/lib/auth';
import { SESSION_COOKIE_NAME } from '@/lib/auth-constants';

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await prisma.session.deleteMany({
      where: { tokenHash: hashToken(token) },
    });
  }

  const res = new NextResponse(null, { status: 204 });
  clearSessionCookie(res);
  return res;
}
