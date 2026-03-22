import { DELETE } from '@/app/api/proposals/[id]/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    proposal: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    itineraryItem: {
      deleteMany: jest.fn(),
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

describe('DELETE /api/proposals/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: 'u-1', email: 'u1@example.com', name: 'U1' });
    mockRequireTripRole.mockResolvedValue({ ok: true, role: 'owner' });
  });

  it('deletes the proposal and returns 204 when found', async () => {
    const fakeProposal = {
      id: 'proposal-1',
      tripId: 'trip-1',
      type: 'food',
      title: 'Le Bistro',
      status: 'pending',
    };
    (mockPrisma.proposal.findUnique as jest.Mock).mockResolvedValue(fakeProposal);
    (mockPrisma.itineraryItem.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
    (mockPrisma.proposal.delete as jest.Mock).mockResolvedValue(fakeProposal);

    const req = new NextRequest('http://localhost/api/proposals/proposal-1', { method: 'DELETE' });
    const context = { params: Promise.resolve({ id: 'proposal-1' }) };
    const res = await DELETE(req, context);

    expect(res.status).toBe(204);
    expect(mockPrisma.itineraryItem.deleteMany).toHaveBeenCalledWith({ where: { proposalId: 'proposal-1' } });
    expect(mockPrisma.proposal.delete).toHaveBeenCalledWith({ where: { id: 'proposal-1' } });
  });

  it('returns 404 when proposal is not found', async () => {
    (mockPrisma.proposal.findUnique as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/proposals/nonexistent', { method: 'DELETE' });
    const context = { params: Promise.resolve({ id: 'nonexistent' }) };
    const res = await DELETE(req, context);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe('Not found');
    expect(mockPrisma.proposal.delete).not.toHaveBeenCalled();
  });
});
