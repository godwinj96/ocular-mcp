import { z } from 'zod';

// The worker heartbeat body — validated at the boundary like every other
// external input, and deliberately narrow: this carries an identity and some
// integers, and there is no field here that could carry a capture target even
// if a future caller tried to send one. See CLAUDE.md's exfiltration-surface
// boundary.
//
// `workerId` is opaque to us -- a client-generated uuid the supervisor persists
// in its own config directory. Not a hardware id, not a MAC address, not
// anything derived from the machine: a stable random token the user can delete
// by deleting the file.
//
// Lives in `shared` (not mcp-server, where it started) because the body now
// crosses a package boundary twice: mcp-server validates what the local
// worker sends, then forwards the same validated shape to the dashboard's
// internal heartbeat endpoint, which is the durable writer. One schema, two
// consumers — see docs/rules/02-repo-structure.md §0.6.
export const heartbeatBodySchema = z.object({
  workerId: z.string().min(8).max(128),
  /** Hostname, so a user with two machines can tell them apart. */
  label: z.string().max(120).nullish(),
  version: z.string().max(40).nullish(),
  platform: z.enum(['darwin', 'win32', 'linux']).nullish(),

  // Captures completed since the previous heartbeat. Bounded so a malformed or
  // hostile client cannot inflate a counter arbitrarily -- an honest worker
  // reporting every five minutes will never approach this.
  localCaptures: z.number().int().min(0).max(10_000).optional(),
  cloudCaptures: z.number().int().min(0).max(10_000).optional(),
});

export type HeartbeatBody = z.infer<typeof heartbeatBodySchema>;
