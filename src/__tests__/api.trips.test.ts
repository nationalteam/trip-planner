import { GET, POST } from '@/app/api/trips/route';
import { NextRequest, NextResponse } from 'next/server';

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    trip: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    tripMember: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
}));

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockRequireAuth = requireAuth as jest.Mock;

describe('GET /api/trips', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: 'u-1', email: 'u1@example.com', name: 'U1' });
  });

  it('returns a list of trips as JSON', async () => {
    const fakeTrips = [
      { id: '1', name: 'Trip A', cities: '["Paris"]', createdAt: '2024-01-01T00:00:00.000Z', _count: { proposals: 2, itineraryItems: 1 } },
    ];
    (mockPrisma.trip.findMany as jest.Mock).mockResolvedValue(fakeTrips);

    const req = new NextRequest('http://localhost/api/trips');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual(fakeTrips);
    expect(mockPrisma.trip.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { members: { some: { userId: 'u-1' } } },
      })
    );
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
    const req = new NextRequest('http://localhost/api/trips');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/trips', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: 'u-1', email: 'u1@example.com', name: 'U1' });
  });

  it('creates a trip and returns 201', async () => {
    const newTrip = { id: '2', name: 'My Trip', cities: '["London","Berlin"]', createdAt: new Date() };
    const tx = {
      trip: { create: jest.fn().mockResolvedValue(newTrip) },
      tripMember: { create: jest.fn().mockResolvedValue({ id: 'tm-1' }) },
    };
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (cb) => cb(tx));

    const req = new NextRequest('http://localhost/api/trips', {
      method: 'POST',
      body: JSON.stringify({ name: 'My Trip', cities: ['London', 'Berlin'] }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.name).toBe('My Trip');
    expect(tx.trip.create).toHaveBeenCalledWith({
      data: {
        name: 'My Trip',
        cities: JSON.stringify(['London', 'Berlin']),
        startDate: null,
        durationDays: null,
      },
    });
    expect(tx.tripMember.create).toHaveBeenCalledWith({
      data: { tripId: '2', userId: 'u-1', role: 'owner' },
    });
  });

  it('creates a trip with optional startDate and durationDays', async () => {
    const newTrip = {
      id: '2',
      name: 'My Trip',
      cities: '["London","Berlin"]',
      startDate: '2026-04-01',
      durationDays: 7,
      createdAt: new Date(),
    };
    const tx = {
      trip: { create: jest.fn().mockResolvedValue(newTrip) },
      tripMember: { create: jest.fn().mockResolvedValue({ id: 'tm-1' }) },
    };
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (cb) => cb(tx));

    const req = new NextRequest('http://localhost/api/trips', {
      method: 'POST',
      body: JSON.stringify({
        name: 'My Trip',
        cities: ['London', 'Berlin'],
        startDate: '2026-04-01',
        durationDays: 7,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(tx.trip.create).toHaveBeenCalledWith({
      data: {
        name: 'My Trip',
        cities: JSON.stringify(['London', 'Berlin']),
        startDate: '2026-04-01',
        durationDays: 7,
      },
    });
  });

  it('returns 400 for invalid startDate format', async () => {
    const req = new NextRequest('http://localhost/api/trips', {
      method: 'POST',
      body: JSON.stringify({
        name: 'My Trip',
        cities: ['London', 'Berlin'],
        startDate: '04/01/2026',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/startDate/);
  });

  it('returns 400 for non-positive durationDays', async () => {
    const req = new NextRequest('http://localhost/api/trips', {
      method: 'POST',
      body: JSON.stringify({
        name: 'My Trip',
        cities: ['London', 'Berlin'],
        durationDays: 0,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/durationDays/);
  });
});
