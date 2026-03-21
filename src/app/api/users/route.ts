import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const users = await prisma.user.findMany({
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const { name } = await req.json();
  const user = await prisma.user.create({ data: { name } });
  return NextResponse.json(user, { status: 201 });
}
