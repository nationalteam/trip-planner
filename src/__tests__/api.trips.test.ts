import { GET, POST } from '@/app/api/trips/route';
import { NextRequest } from 'next/server';

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    trip: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('GET /api/trips', () => {
  it('returns a list of trips as JSON', async () => {
    const fakeTrips = [
      { id: '1', name: 'Trip A', cities: '["Paris"]', createdAt: '2024-01-01T00:00:00.000Z', _count: { proposals: 2, itineraryItems: 1 } },
    ];
    (mockPrisma.trip.findMany as jest.Mock).mockResolvedValue(fakeTrips);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual(fakeTrips);
    expect(mockPrisma.trip.findMany).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/trips', () => {
  it('creates a trip and returns 201', async () => {
    const newTrip = { id: '2', name: 'My Trip', cities: '["London","Berlin"]', createdAt: new Date() };
    (mockPrisma.trip.create as jest.Mock).mockResolvedValue(newTrip);

    const req = new NextRequest('http://localhost/api/trips', {
      method: 'POST',
      body: JSON.stringify({ name: 'My Trip', cities: ['London', 'Berlin'] }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.name).toBe('My Trip');
    expect(mockPrisma.trip.create).toHaveBeenCalledWith({
      data: { name: 'My Trip', cities: JSON.stringify(['London', 'Berlin']) },
    });
  });
});
