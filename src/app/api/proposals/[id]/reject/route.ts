import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildForbiddenResponse, requireAuth, requireTripRole } from '@/lib/auth';
import { withProposalDeprecationHeaders } from '@/lib/api-deprecation';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deprecated = <T extends Response>(res: T) => withProposalDeprecationHeaders(req, res);
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return deprecated(auth);

  const { id } = await params;
  const proposal = await prisma.proposal.findUnique({ where: { id } });
  if (!proposal) return deprecated(NextResponse.json({ error: 'Not found' }, { status: 404 }));

  const access = await requireTripRole(proposal.tripId, auth.id, ['owner']);
  if (!access.ok) return deprecated(buildForbiddenResponse());

  const updated = await prisma.proposal.update({
    where: { id },
    data: { status: 'rejected' },
  });

  return deprecated(NextResponse.json(updated));
}
