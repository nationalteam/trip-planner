import { POST } from '@/app/api/trips/[id]/chat/execute/route';
import { NextRequest, NextResponse } from 'next/server';

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
  requireTripRole: jest.fn(),
  buildForbiddenResponse: jest.fn(() => new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })),
}));

jest.mock('@/lib/chatbot', () => ({
  executeTripActions: jest.fn(),
}));

import { requireAuth, requireTripRole } from '@/lib/auth';
import { executeTripActions } from '@/lib/chatbot';

const mockRequireAuth = requireAuth as jest.Mock;
const mockRequireTripRole = requireTripRole as jest.Mock;
const mockExecuteTripActions = executeTripActions as jest.Mock;

describe('POST /api/trips/[id]/chat/execute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: 'owner-1', email: 'owner@example.com', name: 'Owner' });
    mockRequireTripRole.mockResolvedValue({ ok: true, role: 'owner' });
  });

  it('executes validated actions for owner', async () => {
    mockExecuteTripActions.mockResolvedValue({
      results: [{ type: 'proposal.create', status: 'success' }],
      trip: { id: 'trip-1', name: 'Updated Trip' },
      proposals: [{ id: 'p-1', title: 'New Place' }],
      itinerary: [],
    });

    const req = new NextRequest('http://localhost/api/trips/trip-1/chat/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actionPlan: [
          {
            type: 'proposal.create',
            title: 'New Place',
            description: 'Good',
            city: 'Tokyo',
          },
        ],
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'trip-1' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.results).toEqual([{ type: 'proposal.create', status: 'success' }]);
    expect(data.trip?.name).toBe('Updated Trip');
    expect(mockExecuteTripActions).toHaveBeenCalledWith(
      'trip-1',
      'owner-1',
      expect.any(Array)
    );
  });

  it('rejects invalid action payload', async () => {
    const req = new NextRequest('http://localhost/api/trips/trip-1/chat/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actionPlan: [
          {
            type: 'itinerary.addProposal',
            proposalId: 'p-1',
            day: 0,
            timeBlock: 'morning',
          },
        ],
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'trip-1' }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/day/i);
    expect(mockExecuteTripActions).not.toHaveBeenCalled();
  });

  it('rejects unsupported action type', async () => {
    const req = new NextRequest('http://localhost/api/trips/trip-1/chat/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actionPlan: [
          {
            type: 'trip.delete',
          },
        ],
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'trip-1' }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/unsupported action/i);
    expect(mockExecuteTripActions).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated request', async () => {
    mockRequireAuth.mockResolvedValueOnce(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));

    const req = new NextRequest('http://localhost/api/trips/trip-1/chat/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionPlan: [] }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'trip-1' }) });
    expect(res.status).toBe(401);
  });

  it('rejects viewer role', async () => {
    mockRequireTripRole.mockResolvedValueOnce({ ok: false });

    const req = new NextRequest('http://localhost/api/trips/trip-1/chat/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionPlan: [] }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'trip-1' }) });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });
});
