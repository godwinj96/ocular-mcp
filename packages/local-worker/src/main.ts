import { LOCAL_IDLE_SHUTDOWN_MIN } from '@ocular/shared';
import { startSupervisor } from './supervisor/client.js';
import { startLocalMcpServer } from './mcp/server.js';
import { resolveExecutablePath, resolveProfileDir } from './browser/profile.js';
import { resolveCommand } from './cli/command.js';
import { clearCredentials, defaultBaseDir, loadCredentials } from './auth/credential-store.js';
import type { StoreDeps } from './auth/credential-store.js';
import { runLogin } from './auth/login.js';
import { config } from './config.js';

// stdout is reserved for MCP protocol frames — every human-facing line in
// this file goes to stderr. See docs/rules/09-error-handling-and-logging.md.
function say(line = ''): void {
  console.error(line);
}

function store(): StoreDeps {
  return { baseDir: defaultBaseDir(), platform: process.platform };
}

async function serve(): Promise<void> {
  const supervisor = await startSupervisor({
    idleShutdownMin: LOCAL_IDLE_SHUTDOWN_MIN,
    executablePath: resolveExecutablePath(),
    userDataDir: resolveProfileDir(),
  });
  const mcpServer = await startLocalMcpServer({ supervisor });

  const shutdown = async (): Promise<void> => {
    await mcpServer.close();
    await supervisor.stop();
    process.exit(0);
  };

  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

async function login(): Promise<number> {
  if (!config.authClientId) {
    say('Sign-in is not configured: OCULAR_AUTH_CLIENT_ID is unset.');
    return 1;
  }

  say();
  say('  Opening your browser to finish setup...');

  const outcome = await runLogin({
    connectUrl: config.connectUrl,
    store: store(),
    tokenClient: { clientId: config.authClientId },
  });

  if (outcome.kind !== 'ok') {
    say(`  Setup did not complete: ${outcome.detail}`);
    say();
    return 1;
  }

  say('  ✓ This machine is connected.');
  if (!outcome.credentialsHardened) {
    // Never claim the credential file is protected when it is not — on
    // Windows a failed icacls pass leaves it readable by other accounts.
    say(`  ! Could not restrict permissions on your credentials file: ${outcome.hardenDetail}`);
  }
  say();
  return 0;
}

async function logout(): Promise<number> {
  await clearCredentials(store());
  say('  Signed out on this machine.');
  return 0;
}

function help(): void {
  say();
  say('  useocular — visual perception for AI coding agents');
  say();
  say('    useocular            sign in on first run, otherwise serve MCP');
  say('    useocular login      connect this machine');
  say('    useocular logout     forget this machine');
  say('    useocular serve      always start the MCP server');
  say();
}

async function main(): Promise<void> {
  const command = resolveCommand(process.argv.slice(2), {
    // An MCP client pipes stdio; an interactive shell does not.
    isInteractive: process.stdin.isTTY === true,
    hasCredentials: (await loadCredentials(store())) !== null,
  });

  switch (command.kind) {
    case 'serve':
      await serve();
      return;
    case 'login':
      process.exitCode = await login();
      return;
    case 'logout':
      process.exitCode = await logout();
      return;
    case 'help':
      help();
      return;
    case 'unknown':
      say(`  Unknown command: ${command.arg}`);
      help();
      process.exitCode = 1;
      return;
  }
}

main().catch((error: unknown) => {
  // stdout is reserved for MCP protocol frames — never log there.
  console.error(error);
  process.exitCode = 1;
});
