// The durable write side of the worker heartbeat. mcp-server's /worker/heartbeat
// forwards here after authenticating the caller's own bearer token — see
// packages/mcp-server/src/internal/dashboard-client.ts and
// docs/rules/02-repo-structure.md §0.6 ("the dashboard is the account-state
// service; both render-path services report into it, nothing else owns
// worker/audit persistence").
//
// Service-to-service, not user-facing: authenticated with a static shared
// secret (INTERNAL_SERVICE_SECRET), not an AuthKit session or the end user's
// own token verified a second time — mcp-server already did that. Listed in
// middleware.ts's unauthenticatedPaths for the same reason /connect and
// /webhooks/bachs are: this route controls its own auth, no AuthKit bounce.
import { timingSafeEqual, createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { heartbeatBodySchema } from '@ocular/shared';
import { recordHeartbeat } from '../../../../lib/workers';
import { recordAuditEvent } from '../../../../lib/audit';

const internalHeartbeatSchema = heartbeatBodySchema.extend({
  accountId: z.string().min(1),
});

// Constant-time compare over fixed-length digests, not the raw secrets --
// avoids both a length-based timing signal and a length mismatch throwing out
// of timingSafeEqual before comparison even starts.
function secretsMatch(provided: string, expected: string): boolean {
  const providedDigest = createHash('sha256').update(provided).digest();
  const expectedDigest = createHash('sha256').update(expected).digest();
  return timingSafeEqual(providedDigest, expectedDigest);
}

export async function POST(request: Request): Promise<Response> {
  const expectedSecret = process.env.INTERNAL_SERVICE_SECRET;
  if (!expectedSecret) {
    // Same "not configured yet" shape as webhooks/bachs's route -- 503 keeps
    // a misconfigured deploy visible instead of silently accepting calls.
    return new Response('Internal service secret not configured', { status: 503 });
  }

  const authHeader = request.headers.get('authorization') ?? '';
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!bearerToken || !secretsMatch(bearerToken, expectedSecret)) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const parsed = internalHeartbeatSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'INVALID_BODY' }, { status: 400 });
  }

  const { accountId, workerId, label, version, platform, localCaptures, cloudCaptures } =
    parsed.data;

  const { firstSeen } = await recordHeartbeat({
    accountId,
    workerId,
    label: label ?? null,
    version: version ?? null,
    platform: platform ?? null,
    localCaptures,
    cloudCaptures,
  });

  // One audit line the first time a machine ever reports, and never again --
  // a heartbeat every few minutes would otherwise bury the activity log in
  // the least interesting event it has.
  if (firstSeen) {
    await recordAuditEvent(accountId, 'worker.connected', label ? { label } : {}, 'worker');
  }

  return NextResponse.json({ ok: true });
}
