import { GET } from '@/app/api/trips/[id]/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    trip: {
      findUnique: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('GET /api/trips/[id]', () => {
  it('returns the trip when found', async () => {
    const fakeTrip = { id: 'trip-1', name: 'Paris Adventure', cities: '["Paris"]', createdAt: new Date() };
    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue(fakeTrip);

    const req = new NextRequest('http://localhost/api/trips/trip-1');
    const context = { params: Promise.resolve({ id: 'trip-1' }) };
    const res = await GET(req, context);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.name).toBe('Paris Adventure');
  });

  it('returns 404 when trip is not found', async () => {
    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/trips/nonexistent');
    const context = { params: Promise.resolve({ id: 'nonexistent' }) };
    const res = await GET(req, context);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe('Not found');
  });
});
