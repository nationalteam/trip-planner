import { NextRequest } from 'next/server';

const LEGACY_PROPOSALS_SEGMENT = /\/proposals(?=\/|$)/;
const PROPOSALS_API_SUNSET = 'Tue, 30 Jun 2026 23:59:59 GMT';
const observedLegacyPaths = new Set<string>();

export function withProposalDeprecationHeaders<T extends Response>(req: NextRequest, res: T): T {
  if (!LEGACY_PROPOSALS_SEGMENT.test(req.nextUrl.pathname)) return res;

  const successorPath = req.nextUrl.pathname.replace(LEGACY_PROPOSALS_SEGMENT, '/activities');
  const successorUrl = `${req.nextUrl.origin}${successorPath}`;
  if (!observedLegacyPaths.has(req.nextUrl.pathname)) {
    observedLegacyPaths.add(req.nextUrl.pathname);
    console.warn(`[deprecated-api] ${req.method} ${req.nextUrl.pathname} -> use ${successorPath}`);
  }
  res.headers.set('Deprecation', 'true');
  res.headers.set('Link', `<${successorUrl}>; rel="successor-version"`);
  res.headers.set('Sunset', PROPOSALS_API_SUNSET);
  res.headers.set('X-Legacy-Endpoint', 'proposals');
  res.headers.set('Warning', '299 - "Deprecated API: use /api/activities endpoints"');
  return res;
}
