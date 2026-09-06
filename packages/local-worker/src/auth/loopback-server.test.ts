import { describe, expect, it } from 'vitest';
import { LoginCancelledError, LoginTimeoutError, startLoopbackServer } from './loopback-server.js';

const STATE = 'expected-state-value';

async function hit(url: string): Promise<{ status: number; body: string }> {
  const res = await fetch(url);
  return { status: res.status, body: await res.text() };
}

describe('startLoopbackServer', () => {
  it('binds to 127.0.0.1, not every interface — a firewall prompt breaks the invisibility promise', async () => {
    const server = await startLoopbackServer({ expectedState: STATE });
    try {
      expect(server.redirectUri).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/callback$/);
      expect(server.port).toBeGreaterThan(0);
    } finally {
      await server.close();
    }
  });

  it('resolves with the authorization code on a valid callback', async () => {
    const server = await startLoopbackServer({ expectedState: STATE });
    try {
      const pending = server.waitForCode();
      const res = await hit(`${server.redirectUri}?code=auth-code-123&state=${STATE}`);
      expect(res.status).toBe(200);
      await expect(pending).resolves.toBe('auth-code-123');
    } finally {
      await server.close();
    }
  });

  it('rejects a state mismatch and never surfaces the code — this is the CSRF guard', async () => {
    const server = await startLoopbackServer({ expectedState: STATE });
    try {
      const pending = server.waitForCode();
      const res = await hit(`${server.redirectUri}?code=attacker-code&state=wrong-state`);
      expect(res.status).toBe(400);
      await expect(pending).rejects.toBeInstanceOf(LoginCancelledError);
      await expect(pending).rejects.toThrow(/state mismatch/);
    } finally {
      await server.close();
    }
  });

  it('rejects a callback with no state at all', async () => {
    const server = await startLoopbackServer({ expectedState: STATE });
    try {
      const pending = server.waitForCode();
      const res = await hit(`${server.redirectUri}?code=some-code`);
      expect(res.status).toBe(400);
      await expect(pending).rejects.toBeInstanceOf(LoginCancelledError);
    } finally {
      await server.close();
    }
  });

  it('rejects when the provider returns an error, surfacing its description', async () => {
    const server = await startLoopbackServer({ expectedState: STATE });
    try {
      const pending = server.waitForCode();
      const res = await hit(
        `${server.redirectUri}?error=access_denied&error_description=User%20declined`,
      );
      expect(res.status).toBe(400);
      await expect(pending).rejects.toThrow(/User declined/);
    } finally {
      await server.close();
    }
  });

  it('rejects a state-valid callback that carries no code', async () => {
    const server = await startLoopbackServer({ expectedState: STATE });
    try {
      const pending = server.waitForCode();
      await hit(`${server.redirectUri}?state=${STATE}`);
      await expect(pending).rejects.toThrow(/no authorization code/);
    } finally {
      await server.close();
    }
  });

  it('404s any path other than /callback without settling the login', async () => {
    const server = await startLoopbackServer({ expectedState: STATE });
    try {
      const res = await hit(`http://127.0.0.1:${server.port}/anything-else`);
      expect(res.status).toBe(404);

      // The login is still pending — a stray probe must not resolve it.
      const pending = server.waitForCode();
      await hit(`${server.redirectUri}?code=real-code&state=${STATE}`);
      await expect(pending).resolves.toBe('real-code');
    } finally {
      await server.close();
    }
  });

  it('ignores a second callback — the first result wins', async () => {
    const server = await startLoopbackServer({ expectedState: STATE });
    try {
      const pending = server.waitForCode();
      await hit(`${server.redirectUri}?code=first&state=${STATE}`);
      await hit(`${server.redirectUri}?code=second&state=${STATE}`);
      await expect(pending).resolves.toBe('first');
    } finally {
      await server.close();
    }
  });

  it('times out rather than listening forever on an abandoned login', async () => {
    const server = await startLoopbackServer({ expectedState: STATE, timeoutMs: 40 });
    try {
      await expect(server.waitForCode()).rejects.toBeInstanceOf(LoginTimeoutError);
    } finally {
      await server.close();
    }
  });

  it('picks a different ephemeral port per server, so two logins cannot collide', async () => {
    const a = await startLoopbackServer({ expectedState: STATE });
    const b = await startLoopbackServer({ expectedState: STATE });
    try {
      expect(a.port).not.toBe(b.port);
    } finally {
      await a.close();
      await b.close();
    }
  });

  it('stops listening after close', async () => {
    const server = await startLoopbackServer({ expectedState: STATE });
    const uri = server.redirectUri;
    await server.close();
    await expect(hit(`${uri}?code=x&state=${STATE}`)).rejects.toThrow();
  });
});
