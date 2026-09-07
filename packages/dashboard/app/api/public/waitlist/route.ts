// Public, unauthenticated waitlist submission from the website's CTA when
// waitlist mode is on. See lib/waitlist.ts for validation/dedupe and
// middleware.ts's unauthenticatedPaths.
//
// NO RATE LIMITING here, noted rather than silently absent: this is a
// low-value target (an email collection form, not billing or auth) and the
// unique index on lower(email) already stops the same address from being
// resubmitted, but nothing here stops many DIFFERENT fake addresses being
// posted quickly. Acceptable for a pre-launch waitlist at expected scale;
// revisit with real rate limiting (mcp-server already has
// redis-rate-limiter.ts to lift the pattern from) if this list becomes a
// target.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { addToWaitlist } from '../../../../lib/waitlist';
import { corsHeaders, corsPreflight } from '../../../../lib/public-cors';

const bodySchema = z.object({ email: z.string().max(320) });

export async function POST(request: Request): Promise<Response> {
  const headers = corsHeaders(request.headers.get('origin'));

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'INVALID_BODY' }, { status: 400, headers });
  }

  const result = await addToWaitlist(parsed.data.email);
  if (!result.ok && result.reason === 'invalid_email') {
    return NextResponse.json({ ok: false, error: 'INVALID_EMAIL' }, { status: 400, headers });
  }

  // already_joined reads as success to the caller -- from the person
  // typing's perspective "you're on the list" is true either way, and
  // confirming "you already joined" would just be a way to enumerate which
  // emails are already registered.
  return NextResponse.json({ ok: true }, { headers });
}

export async function OPTIONS(request: Request): Promise<Response> {
  return corsPreflight(request);
}
