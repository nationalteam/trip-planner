import { POST, DELETE } from '@/app/api/trips/[id]/public-link/route';
import { GET as publicGet } from '@/app/api/public/trips/[token]/route';
import { NextRequest, NextResponse } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    trip: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
  requireTripRole: jest.fn(),
  buildForbiddenResponse: jest.fn(() => NextResponse.json({ error: 'Forbidden' }, { status: 403 })),
}));

jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomBytes: jest.fn(() => Buffer.from('aabbccddeeff00112233445566778899aabbccdd', 'hex')),
}));

import { prisma } from '@/lib/prisma';
import { requireAuth, requireTripRole } from '@/lib/auth';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockRequireAuth = requireAuth as jest.Mock;
const mockRequireTripRole = requireTripRole as jest.Mock;

describe('POST /api/trips/[id]/public-link', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: 'owner-1', email: 'owner@example.com', name: 'Owner' });
    mockRequireTripRole.mockResolvedValue({ ok: true, role: 'owner' });
  });

  it('generates a new share token when none exists', async () => {
    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue({ id: 'trip-1', shareToken: null });
    (mockPrisma.trip.update as jest.Mock).mockResolvedValue({ shareToken: 'abc123' });

    const req = new NextRequest('http://localhost/api/trips/trip-1/public-link', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: 'trip-1' }) });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.shareToken).toBeDefined();
  });

  it('returns existing token if already set', async () => {
    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue({ id: 'trip-1', shareToken: 'existing-token' });
    (mockPrisma.trip.update as jest.Mock).mockResolvedValue({ shareToken: 'existing-token' });

    const req = new NextRequest('http://localhost/api/trips/trip-1/public-link', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: 'trip-1' }) });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.shareToken).toBe('existing-token');
  });

  it('returns 404 when trip not found', async () => {
    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/trips/trip-1/public-link', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: 'trip-1' }) });

    expect(res.status).toBe(404);
  });

  it('returns 403 when caller is not owner', async () => {
    mockRequireTripRole.mockResolvedValue({ ok: false });

    const req = new NextRequest('http://localhost/api/trips/trip-1/public-link', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: 'trip-1' }) });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/trips/[id]/public-link', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: 'owner-1', email: 'owner@example.com', name: 'Owner' });
    mockRequireTripRole.mockResolvedValue({ ok: true, role: 'owner' });
  });

  it('revokes share token', async () => {
    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue({ id: 'trip-1', shareToken: 'some-token' });
    (mockPrisma.trip.update as jest.Mock).mockResolvedValue({ id: 'trip-1', shareToken: null });

    const req = new NextRequest('http://localhost/api/trips/trip-1/public-link', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: 'trip-1' }) });

    expect(res.status).toBe(204);
    expect(mockPrisma.trip.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { shareToken: null } })
    );
  });
});

describe('GET /api/public/trips/[token]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns trip data for valid token', async () => {
    const mockTrip = {
      id: 'trip-1',
      name: 'Tokyo Adventure',
      cities: '["Tokyo"]',
      shareToken: 'valid-token',
      activities: [{ id: 'a-1', title: 'Senso-ji', status: 'approved' }],
      itineraryItems: [],
    };
    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue(mockTrip);

    const req = new NextRequest('http://localhost/api/public/trips/valid-token');
    const res = await publicGet(req, { params: Promise.resolve({ token: 'valid-token' }) });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe('Tokyo Adventure');
    expect(data.shareToken).toBeUndefined();
  });

  it('returns 404 for invalid token', async () => {
    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/public/trips/bad-token');
    const res = await publicGet(req, { params: Promise.resolve({ token: 'bad-token' }) });

    expect(res.status).toBe(404);
  });

  it('returns 400 for missing token', async () => {
    const req = new NextRequest('http://localhost/api/public/trips/');
    const res = await publicGet(req, { params: Promise.resolve({ token: '' }) });

    expect(res.status).toBe(400);
  });
});
