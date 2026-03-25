import { NextRequest } from 'next/server';

const LEGACY_PROPOSALS_SEGMENT = /\/proposals(?=\/|$)/;

export function withProposalDeprecationHeaders<T extends Response>(req: NextRequest, res: T): T {
  if (!LEGACY_PROPOSALS_SEGMENT.test(req.nextUrl.pathname)) return res;

  const successorPath = req.nextUrl.pathname.replace(LEGACY_PROPOSALS_SEGMENT, '/activities');
  const successorUrl = `${req.nextUrl.origin}${successorPath}`;
  res.headers.set('Deprecation', 'true');
  res.headers.set('Link', `<${successorUrl}>; rel="successor-version"`);
  res.headers.set('Warning', '299 - "Deprecated API: use /api/activities endpoints"');
  return res;
}
