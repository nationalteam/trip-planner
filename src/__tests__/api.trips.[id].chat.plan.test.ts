import { POST } from '@/app/api/trips/[id]/chat/plan/route';
import { NextRequest, NextResponse } from 'next/server';

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
  requireTripRole: jest.fn(),
  buildForbiddenResponse: jest.fn(() => new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })),
}));

jest.mock('@/lib/chatbot', () => ({
  planTripActions: jest.fn(),
}));

import { requireAuth, requireTripRole } from '@/lib/auth';
import { planTripActions } from '@/lib/chatbot';

const mockRequireAuth = requireAuth as jest.Mock;
const mockRequireTripRole = requireTripRole as jest.Mock;
const mockPlanTripActions = planTripActions as jest.Mock;

describe('POST /api/trips/[id]/chat/plan', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: 'owner-1', email: 'owner@example.com', name: 'Owner' });
    mockRequireTripRole.mockResolvedValue({ ok: true, role: 'owner' });
  });

  it('returns action plan preview for owner', async () => {
    mockPlanTripActions.mockResolvedValue({
      summary: 'Will generate proposals and organize itinerary.',
      actionPlan: [
        { type: 'proposal.generate', city: 'Tokyo' },
        { type: 'itinerary.organize' },
      ],
    });

    const req = new NextRequest('http://localhost/api/trips/trip-1/chat/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Generate Tokyo proposals and organize itinerary' }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'trip-1' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.summary).toMatch(/generate proposals/i);
    expect(data.actionPlan).toEqual([
      { type: 'proposal.generate', city: 'Tokyo' },
      { type: 'itinerary.organize' },
    ]);
    expect(mockPlanTripActions).toHaveBeenCalledWith(
      'Generate Tokyo proposals and organize itinerary',
      expect.objectContaining({ tripId: 'trip-1', userId: 'owner-1' })
    );
  });

  it('rejects unauthenticated request', async () => {
    mockRequireAuth.mockResolvedValueOnce(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));

    const req = new NextRequest('http://localhost/api/trips/trip-1/chat/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Generate proposals' }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'trip-1' }) });

    expect(res.status).toBe(401);
    expect(mockPlanTripActions).not.toHaveBeenCalled();
  });

  it('rejects viewer role', async () => {
    mockRequireTripRole.mockResolvedValueOnce({ ok: false });

    const req = new NextRequest('http://localhost/api/trips/trip-1/chat/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Generate proposals' }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'trip-1' }) });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe('Forbidden');
    expect(mockPlanTripActions).not.toHaveBeenCalled();
  });
});
