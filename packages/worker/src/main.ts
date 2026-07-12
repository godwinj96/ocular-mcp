import { SelfHostedProvider } from './providers/self-hosted-provider.js';
import { startWorker } from './worker.js';

const provider = new SelfHostedProvider();

startWorker(provider).catch((error: unknown) => {
  // no logger wired up yet; replace with pino at M1
  console.error(error);
  process.exitCode = 1;
});
