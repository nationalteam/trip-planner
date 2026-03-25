import { NextRequest, NextResponse } from 'next/server';
import { buildForbiddenResponse, requireAuth, requireTripRole } from '@/lib/auth';
import { executeTripActions, validateChatActionPlan } from '@/lib/chatbot';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const access = await requireTripRole(id, auth.id, ['owner']);
  if (!access.ok) return buildForbiddenResponse();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request body. Expected a JSON object.' }, { status: 400 });
  }

  const rawActionPlan = (body as { actionPlan?: unknown }).actionPlan;
  let actionPlan;
  try {
    actionPlan = validateChatActionPlan(rawActionPlan);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid action plan' },
      { status: 400 }
    );
  }

  try {
    const result = await executeTripActions(id, auth.id, actionPlan);
    const activities = Array.isArray(result.activities) ? result.activities : [];
    const payload = {
      ...result,
      activities,
    } as Record<string, unknown>;
    delete payload.proposals;
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to execute actions' },
      { status: 400 }
    );
  }
}
