import { LOCAL_IDLE_SHUTDOWN_MIN } from '@ocular/shared';
import { startSupervisor } from './supervisor/client.js';
import { startLocalMcpServer } from './mcp/server.js';
import { resolveExecutablePath, resolveProfileDir } from './browser/profile.js';

async function main(): Promise<void> {
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

main().catch((error: unknown) => {
  // stdout is reserved for MCP protocol frames — never log there.
  console.error(error);
  process.exitCode = 1;
});
