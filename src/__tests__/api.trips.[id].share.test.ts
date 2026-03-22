import { POST } from '@/app/api/trips/[id]/share/route';
import { NextRequest, NextResponse } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    tripMember: {
      upsert: jest.fn(),
    },
  },
}));

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
  requireTripRole: jest.fn(),
  buildForbiddenResponse: jest.fn(() => NextResponse.json({ error: 'Forbidden' }, { status: 403 })),
}));

import { prisma } from '@/lib/prisma';
import { requireAuth, requireTripRole } from '@/lib/auth';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockRequireAuth = requireAuth as jest.Mock;
const mockRequireTripRole = requireTripRole as jest.Mock;

describe('POST /api/trips/[id]/share', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: 'owner-1', email: 'owner@example.com', name: 'Owner' });
    mockRequireTripRole.mockResolvedValue({ ok: true, role: 'owner' });
  });

  it('shares trip with existing user as viewer', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u-2', email: 'viewer@example.com', name: 'Viewer' });
    (mockPrisma.tripMember.upsert as jest.Mock).mockResolvedValue({ id: 'tm-1', role: 'viewer' });

    const req = new NextRequest('http://localhost/api/trips/trip-1/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'viewer@example.com' }),
    });
    const context = { params: Promise.resolve({ id: 'trip-1' }) };

    const res = await POST(req, context);
    expect(res.status).toBe(200);
    expect(mockPrisma.tripMember.upsert).toHaveBeenCalled();
  });

  it('returns 404 when target user is missing', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/trips/trip-1/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'missing@example.com' }),
    });
    const context = { params: Promise.resolve({ id: 'trip-1' }) };

    const res = await POST(req, context);
    expect(res.status).toBe(404);
  });

  it('returns 403 when caller is not owner', async () => {
    mockRequireTripRole.mockResolvedValue({ ok: false, status: 403 });

    const req = new NextRequest('http://localhost/api/trips/trip-1/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'viewer@example.com' }),
    });
    const context = { params: Promise.resolve({ id: 'trip-1' }) };

    const res = await POST(req, context);
    expect(res.status).toBe(403);
  });
});
