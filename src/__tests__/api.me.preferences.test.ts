import { GET, POST, PUT } from '@/app/api/me/preferences/route';
import { NextRequest, NextResponse } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    preference: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
}));

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockRequireAuth = requireAuth as jest.Mock;

describe('/api/me/preferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: 'u-1', email: 'u1@example.com', name: 'U1' });
  });

  it('GET returns current user preference', async () => {
    (mockPrisma.preference.findFirst as jest.Mock).mockResolvedValue({ id: 'p1', userId: 'u-1', likes: '[]', dislikes: '[]', budget: null });

    const req = new NextRequest('http://localhost/api/me/preferences');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockPrisma.preference.findFirst).toHaveBeenCalledWith({ where: { userId: 'u-1' } });
  });

  it('POST creates preference for current user', async () => {
    (mockPrisma.preference.findFirst as jest.Mock).mockResolvedValue(null);
    (mockPrisma.preference.create as jest.Mock).mockResolvedValue({ id: 'p1' });

    const req = new NextRequest('http://localhost/api/me/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ likes: ['x'], dislikes: [], budget: 'budget' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(mockPrisma.preference.create).toHaveBeenCalled();
  });

  it('PUT updates existing preference for current user', async () => {
    (mockPrisma.preference.findFirst as jest.Mock).mockResolvedValue({ id: 'p1', userId: 'u-1' });
    (mockPrisma.preference.update as jest.Mock).mockResolvedValue({ id: 'p1' });

    const req = new NextRequest('http://localhost/api/me/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ likes: [], dislikes: [], budget: null }),
    });

    const res = await PUT(req);
    expect(res.status).toBe(200);
    expect(mockPrisma.preference.update).toHaveBeenCalled();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValueOnce(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));

    const req = new NextRequest('http://localhost/api/me/preferences');
    const res = await GET(req);

    expect(res.status).toBe(401);
  });
});
