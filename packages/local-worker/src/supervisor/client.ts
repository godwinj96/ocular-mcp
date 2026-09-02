// Node-side client for the Go supervisor — spawns the compiled binary,
// parses its stdout handshake line, and speaks the newline-delimited JSON
// IPC protocol defined in supervisor/ipc.go. See
// docs/rules/13-local-worker-and-distribution.md §2 for the process
// architecture this implements the Node half of.

import { spawn, type ChildProcess } from 'node:child_process';
import { createConnection, type Socket } from 'node:net';
import { createInterface } from 'node:readline';
import { resolveSupervisorBinaryPath } from './binary-resolver.js';

export type IpcRequestType = 'warm' | 'capture_start' | 'capture_end' | 'status' | 'shutdown';

export interface IpcResponse {
  ok: boolean;
  state?: string;
  error?: string;
  /** DevTools WebSocket endpoint for the currently-warm browser, if any — see supervisor/browser.go. */
  cdpUrl?: string;
}

export interface SupervisorClient {
  send(type: IpcRequestType): Promise<IpcResponse>;
  stop(): Promise<void>;
}

// Parses the addr the supervisor prints ("unix:/path/to.sock" or
// "tcp:127.0.0.1:PORT" — see supervisor/ipc.go's listenLoopback) into
// node:net connection options.
function parseHandshakeAddr(line: string): { path: string } | { host: string; port: number } {
  const match = /^LISTENING (unix|tcp):(.+)$/.exec(line.trim());
  if (!match) {
    throw new Error(`Unexpected supervisor handshake line: ${JSON.stringify(line)}`);
  }
  const [, kind, addr] = match;
  if (kind === 'unix') {
    return { path: addr! };
  }
  const lastColon = addr!.lastIndexOf(':');
  return { host: addr!.slice(0, lastColon), port: Number(addr!.slice(lastColon + 1)) };
}

async function waitForHandshake(
  proc: ChildProcess,
): Promise<ReturnType<typeof parseHandshakeAddr>> {
  return new Promise((resolve, reject) => {
    if (!proc.stdout) {
      reject(new Error('Supervisor process has no stdout stream.'));
      return;
    }
    const rl = createInterface({ input: proc.stdout });
    const timeout = setTimeout(() => {
      rl.close();
      reject(new Error('Timed out waiting for supervisor LISTENING handshake.'));
    }, 10_000);

    rl.once('line', (line) => {
      clearTimeout(timeout);
      rl.close();
      try {
        resolve(parseHandshakeAddr(line));
      } catch (error) {
        reject(error as Error);
      }
    });

    proc.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    proc.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`Supervisor exited before handshake (code ${code}).`));
    });
  });
}

function connectSocket(addr: ReturnType<typeof parseHandshakeAddr>): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket =
      'path' in addr ? createConnection(addr.path) : createConnection(addr.port, addr.host);
    socket.once('connect', () => resolve(socket));
    socket.once('error', reject);
  });
}

export interface StartSupervisorOptions {
  idleShutdownMin: number;
  executablePath: string;
  userDataDir: string;
}

export async function startSupervisor(opts: StartSupervisorOptions): Promise<SupervisorClient> {
  // Resolves to a dev build under dist-supervisor/ if present, otherwise
  // downloads+checksum-verifies the current platform's release binary into
  // ~/.ocular/bin/ — see binary-resolver.ts. Throws with a clear message on
  // any resolution failure (unsupported platform, no pinned checksum yet,
  // download/verification failure) rather than a bare ENOENT from spawn().
  const binaryPath = await resolveSupervisorBinaryPath();

  const proc = spawn(
    binaryPath,
    [
      '-idle-shutdown-min',
      String(opts.idleShutdownMin),
      '-executable-path',
      opts.executablePath,
      '-user-data-dir',
      opts.userDataDir,
    ],
    { stdio: ['ignore', 'pipe', 'inherit'] },
  );

  const addr = await waitForHandshake(proc);
  const socket = await connectSocket(addr);
  const rl = createInterface({ input: socket });

  // One in-flight request at a time — the protocol is request/response over
  // a single persistent connection, not pipelined. A local MCP server only
  // ever has one capture in flight at a time from a single agent session,
  // so this is not a throughput constraint in practice.
  let pending: { resolve(v: IpcResponse): void; reject(e: Error): void } | null = null;

  rl.on('line', (line) => {
    if (!pending) return;
    const { resolve, reject } = pending;
    pending = null;
    try {
      resolve(JSON.parse(line) as IpcResponse);
    } catch (error) {
      reject(error as Error);
    }
  });

  socket.on('error', (error) => {
    if (pending) {
      pending.reject(error);
      pending = null;
    }
  });

  return {
    send: (type) =>
      new Promise((resolve, reject) => {
        if (pending) {
          reject(new Error('A supervisor request is already in flight.'));
          return;
        }
        pending = { resolve, reject };
        socket.write(JSON.stringify({ type }) + '\n');
      }),
    stop: async () => {
      // Found via live testing: sending 'shutdown' and immediately calling
      // proc.kill() races the supervisor's own internal shutdown handler —
      // main.go's IPC handler replies to 'shutdown' as soon as it receives
      // the request, but the actual browser.Terminate() call happens
      // afterward, on the main goroutine's select loop. Killing the Go
      // process before that runs skips Terminate() entirely, orphaning
      // chrome-headless-shell's child processes (observed directly: 3 stray
      // processes after a naive kill). Waiting for the process to exit on
      // its own (it calls os.Exit implicitly by returning from main after
      // Terminate() completes) guarantees Terminate() actually ran; only
      // force-kill as a bounded fallback if it doesn't exit promptly.
      try {
        await new Promise<IpcResponse>((resolve, reject) => {
          pending = { resolve, reject };
          socket.write(JSON.stringify({ type: 'shutdown' }) + '\n');
        });
      } catch {
        // Best-effort — the exit-wait/force-kill below is the real
        // cleanup guarantee regardless of whether this resolved.
      }
      socket.end();

      const exited = new Promise<void>((resolve) => proc.once('exit', () => resolve()));
      const timedOut = new Promise<void>((resolve) => setTimeout(resolve, 5_000));
      await Promise.race([exited, timedOut]);

      if (proc.exitCode === null && proc.signalCode === null) {
        // Supervisor didn't exit on its own in time — force-kill as a last
        // resort. This is the "leaves the browser tree orphaned" path, but
        // only as a bounded fallback, never the normal path.
        proc.kill();
      }
    },
  };
}
