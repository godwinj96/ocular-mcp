// This machine's identity, as far as the cloud is concerned.
//
// An opaque random uuid written next to the credentials, NOT anything derived
// from the hardware. No MAC address, no serial, no machine-id, no fingerprint
// of any kind: those are stable in a way the user cannot revoke, and a product
// whose entire pitch is that it stays out of your way should not be minting
// permanent identifiers for the machines it runs on. Delete the file and this
// machine becomes a new one; that is the intended escape hatch.
//
// The hostname travels alongside it as a LABEL, which is a different thing --
// it exists so a user with a laptop and a desktop can tell the two rows apart,
// and it is only ever displayed back to the person who owns both.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { newWorkerId } from './heartbeat.js';
import { defaultBaseDir } from '../auth/credential-store.js';

export function workerIdPath(baseDir: string = defaultBaseDir()): string {
  return join(baseDir, 'worker-id');
}

/** Reads the persisted id, minting and storing one on first run. */
export async function loadWorkerId(baseDir: string = defaultBaseDir()): Promise<string> {
  const path = workerIdPath(baseDir);

  try {
    const existing = (await readFile(path, 'utf8')).trim();
    if (existing.length >= 8) return existing;
  } catch {
    // Missing or unreadable -- either way the answer is to mint a new one.
    // A machine that cannot persist its id still works; it simply appears as a
    // new machine each run, which is a cosmetic problem, not a functional one.
  }

  const fresh = newWorkerId();
  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, fresh, { mode: 0o600 });
  } catch {
    // Read-only home, locked-down container. Nothing to surface: the heartbeat
    // is advisory and capture is unaffected.
  }
  return fresh;
}
