import { config } from './config.js';
import { startMcpServer } from './mcp/server.js';

startMcpServer({ port: config.port }).catch((error: unknown) => {
  // no logger wired up yet; replace with pino at M1
  console.error(error);
  process.exitCode = 1;
});
