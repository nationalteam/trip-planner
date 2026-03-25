import { DELETE, PATCH } from '@/app/api/accommodations/[id]/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    accommodation: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
  requireTripRole: jest.fn(),
  buildForbiddenResponse: jest.fn(() => new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })),
}));

import { prisma } from '@/lib/prisma';
import { requireAuth, requireTripRole } from '@/lib/auth';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockRequireAuth = requireAuth as jest.Mock;
const mockRequireTripRole = requireTripRole as jest.Mock;

describe('PATCH /api/accommodations/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: 'u-1', email: 'u1@example.com', name: 'U1' });
    mockRequireTripRole.mockResolvedValue({ ok: true, role: 'owner' });
    (mockPrisma.accommodation.findUnique as jest.Mock).mockResolvedValue({
      id: 'acc-1',
      tripId: 'trip-1',
      checkInDate: '2026-04-01',
      checkOutDate: '2026-04-03',
    });
    (mockPrisma.accommodation.findMany as jest.Mock).mockResolvedValue([]);
  });

  it('updates accommodation when payload is valid', async () => {
    (mockPrisma.accommodation.update as jest.Mock).mockResolvedValue({ id: 'acc-1', name: 'Updated' });

    const req = new NextRequest('http://localhost/api/accommodations/acc-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Updated',
        checkInDate: '2026-04-02',
        checkOutDate: '2026-04-04',
      }),
    });
    const context = { params: Promise.resolve({ id: 'acc-1' }) };
    const res = await PATCH(req, context);

    expect(res.status).toBe(200);
    expect(mockPrisma.accommodation.update).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
      data: expect.objectContaining({
        name: 'Updated',
        checkInDate: '2026-04-02',
        checkOutDate: '2026-04-04',
      }),
    });
  });

  it('returns 400 when update causes overlap', async () => {
    (mockPrisma.accommodation.findMany as jest.Mock).mockResolvedValue([
      { id: 'acc-2', checkInDate: '2026-04-03', checkOutDate: '2026-04-05' },
    ]);

    const req = new NextRequest('http://localhost/api/accommodations/acc-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        checkInDate: '2026-04-02',
        checkOutDate: '2026-04-04',
      }),
    });
    const context = { params: Promise.resolve({ id: 'acc-1' }) };
    const res = await PATCH(req, context);

    expect(res.status).toBe(400);
    expect(mockPrisma.accommodation.update).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/accommodations/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: 'u-1', email: 'u1@example.com', name: 'U1' });
    mockRequireTripRole.mockResolvedValue({ ok: true, role: 'owner' });
    (mockPrisma.accommodation.findUnique as jest.Mock).mockResolvedValue({
      id: 'acc-1',
      tripId: 'trip-1',
      checkInDate: '2026-04-01',
      checkOutDate: '2026-04-03',
    });
  });

  it('deletes accommodation', async () => {
    (mockPrisma.accommodation.delete as jest.Mock).mockResolvedValue({ id: 'acc-1' });

    const req = new NextRequest('http://localhost/api/accommodations/acc-1', { method: 'DELETE' });
    const context = { params: Promise.resolve({ id: 'acc-1' }) };
    const res = await DELETE(req, context);

    expect(res.status).toBe(204);
    expect(mockPrisma.accommodation.delete).toHaveBeenCalledWith({ where: { id: 'acc-1' } });
  });
});
