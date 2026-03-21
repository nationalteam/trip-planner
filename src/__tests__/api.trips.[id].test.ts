import { GET, DELETE } from '@/app/api/trips/[id]/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    trip: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    proposal: {
      deleteMany: jest.fn(),
    },
    itineraryItem: {
      deleteMany: jest.fn(),
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

describe('DELETE /api/trips/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes the trip and returns 204 when found', async () => {
    const fakeTrip = { id: 'trip-1', name: 'Paris Adventure', cities: '["Paris"]', createdAt: new Date() };
    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue(fakeTrip);
    (mockPrisma.itineraryItem.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
    (mockPrisma.proposal.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
    (mockPrisma.trip.delete as jest.Mock).mockResolvedValue(fakeTrip);

    const req = new NextRequest('http://localhost/api/trips/trip-1', { method: 'DELETE' });
    const context = { params: Promise.resolve({ id: 'trip-1' }) };
    const res = await DELETE(req, context);

    expect(res.status).toBe(204);
    expect(mockPrisma.itineraryItem.deleteMany).toHaveBeenCalledWith({ where: { tripId: 'trip-1' } });
    expect(mockPrisma.proposal.deleteMany).toHaveBeenCalledWith({ where: { tripId: 'trip-1' } });
    expect(mockPrisma.trip.delete).toHaveBeenCalledWith({ where: { id: 'trip-1' } });
  });

  it('returns 404 when trip is not found', async () => {
    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/trips/nonexistent', { method: 'DELETE' });
    const context = { params: Promise.resolve({ id: 'nonexistent' }) };
    const res = await DELETE(req, context);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe('Not found');
    expect(mockPrisma.trip.delete).not.toHaveBeenCalled();
  });
});
