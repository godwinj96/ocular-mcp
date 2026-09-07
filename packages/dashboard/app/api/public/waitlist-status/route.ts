// Public, unauthenticated, read-only — the website (a static Vite SPA) polls
// this to decide whether its CTA should start checkout or collect a waitlist
// email. See lib/feature-flags.ts and middleware.ts's unauthenticatedPaths.
import { NextResponse } from 'next/server';
import { getFlag, WAITLIST_MODE_KEY } from '../../../../lib/feature-flags';
import { corsHeaders, corsPreflight } from '../../../../lib/public-cors';

export async function GET(request: Request): Promise<Response> {
  const enabled = await getFlag(WAITLIST_MODE_KEY);
  return NextResponse.json(
    { waitlistMode: enabled },
    { headers: corsHeaders(request.headers.get('origin')) },
  );
}

export async function OPTIONS(request: Request): Promise<Response> {
  return corsPreflight(request);
}
