import { NextRequest, NextResponse } from 'next/server';
import { buildForbiddenResponse, requireAuth, requireTripRole } from '@/lib/auth';
import { planTripActions } from '@/lib/chatbot';

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

  const { message, context } = body as { message?: unknown; context?: unknown };
  if (typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }

  try {
    const planned = await planTripActions(message.trim(), {
      tripId: id,
      userId: auth.id,
      extraContext: context,
    });
    return NextResponse.json(planned);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to plan chat actions';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}
