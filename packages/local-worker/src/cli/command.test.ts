import { describe, expect, it } from 'vitest';
import { resolveCommand } from './command.js';

const mcpClient = { isInteractive: false, hasCredentials: true };
const mcpClientFirstRun = { isInteractive: false, hasCredentials: false };
const humanFirstRun = { isInteractive: true, hasCredentials: false };
const humanSignedIn = { isInteractive: true, hasCredentials: true };

describe('resolveCommand — the bare invocation', () => {
  it('runs login for a human at a terminal with no credentials', () => {
    // The founder's flow: `npx useocular` opens a browser on first run.
    expect(resolveCommand([], humanFirstRun)).toEqual({ kind: 'login' });
  });

  it('serves MCP for an MCP client even with no credentials', () => {
    // Critical: an MCP client pipes stdio and cannot answer a browser prompt.
    // Blocking here would hang the client's startup with no way out, and any
    // message printed to stdout would corrupt the protocol stream.
    expect(resolveCommand([], mcpClientFirstRun)).toEqual({ kind: 'serve' });
  });

  it('serves MCP for a human who is already signed in', () => {
    expect(resolveCommand([], humanSignedIn)).toEqual({ kind: 'serve' });
  });

  it('serves MCP for a signed-in MCP client', () => {
    expect(resolveCommand([], mcpClient)).toEqual({ kind: 'serve' });
  });
});

describe('resolveCommand — explicit subcommands bypass the heuristic', () => {
  it('honours `login` even for a piped MCP-style invocation', () => {
    expect(resolveCommand(['login'], mcpClient)).toEqual({ kind: 'login' });
  });

  it('honours `serve` even for an interactive first run', () => {
    // The deterministic escape hatch: never guess when the user was explicit.
    expect(resolveCommand(['serve'], humanFirstRun)).toEqual({ kind: 'serve' });
  });

  it('honours `logout` in every context', () => {
    expect(resolveCommand(['logout'], humanSignedIn)).toEqual({ kind: 'logout' });
    expect(resolveCommand(['logout'], mcpClientFirstRun)).toEqual({ kind: 'logout' });
  });

  it('recognises the help flags', () => {
    for (const arg of ['help', '--help', '-h']) {
      expect(resolveCommand([arg], humanSignedIn)).toEqual({ kind: 'help' });
    }
  });

  it('reports an unrecognised subcommand instead of silently serving', () => {
    // Silently starting an MCP server because someone typed `logn` would be
    // baffling — it looks like a hang.
    expect(resolveCommand(['logn'], humanSignedIn)).toEqual({ kind: 'unknown', arg: 'logn' });
  });

  it('ignores arguments after the subcommand', () => {
    expect(resolveCommand(['login', '--verbose'], humanFirstRun)).toEqual({ kind: 'login' });
  });
});
