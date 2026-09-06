// What should `useocular` actually do when invoked? See
// docs/design/first-run-auth-and-payment.md §4.2.
//
// This is trickier than it looks because ONE command has two audiences:
//
//   - A human at a terminal running `npx useocular` for the first time, who
//     per the founder's decision should get a browser opening on sign-in and
//     payment.
//   - An MCP client (Claude Code, Cursor) spawning the exact same command as
//     a stdio server, where stdout is reserved for protocol frames and
//     printing "Opening your browser..." would corrupt the stream.
//
// Guessing wrong in either direction is bad: block an MCP client on a browser
// prompt it cannot answer, or silently start a server for a human who is
// waiting to be told how to sign in.
//
// The discriminator is whether stdin is a TTY. An MCP client always pipes
// stdio; an interactive shell does not. Explicit subcommands bypass the
// heuristic entirely, so there is always a deterministic escape hatch.

export type CliCommand =
  | { kind: 'login' }
  | { kind: 'logout' }
  | { kind: 'serve' }
  | { kind: 'help' }
  | { kind: 'unknown'; arg: string };

export interface InvocationContext {
  /** True when a human is at a terminal. MCP clients pipe stdio, so this is false for them. */
  isInteractive: boolean;
  hasCredentials: boolean;
}

export function resolveCommand(argv: readonly string[], context: InvocationContext): CliCommand {
  const [first] = argv;

  // Explicit subcommands always win, on any platform, TTY or not.
  if (first === 'login') return { kind: 'login' };
  if (first === 'logout') return { kind: 'logout' };
  if (first === 'serve') return { kind: 'serve' };
  if (first === 'help' || first === '--help' || first === '-h') return { kind: 'help' };
  if (first !== undefined) return { kind: 'unknown', arg: first };

  // No subcommand. A human at a terminal with no credentials is the first-run
  // case the founder's flow describes.
  if (context.isInteractive && !context.hasCredentials) return { kind: 'login' };

  // Everything else serves MCP: an MCP client (piped stdio), or an
  // interactive user who is already signed in and just ran the bare command.
  return { kind: 'serve' };
}
