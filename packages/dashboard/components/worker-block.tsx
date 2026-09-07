import { CodeBlock } from './ui/code-block';
import { KeyValues } from './ui/readouts';
import { Lamp, type LampState } from './ui/lamp';
import { ButtonLink } from './ui/button';
import { formatDay, formatRelative } from '../lib/format';
import type { Worker } from '../lib/workers';

// The largest thing on the root, by a wide margin. It is the answer to the one
// question the product exists to make un-askable.
//
// IDLE READS AS SUCCESS. This is the single most important decision in the
// block, and it is borrowed from GitHub's self-hosted runners, where "Idle"
// means connected and ready and is rendered as healthy -- not as absence.
// Ocular's whole three-tier lifecycle is ENGINEERED to sit idle: browser shut
// down, supervisor only, ~10-15MB. Greying the lamp when the product is working
// exactly as designed would make its best state look like its worst.
//
// There is no "capturing right now" state and there should not be. It would
// need polling to represent something that lasts about two seconds, that the
// user is already watching scroll past in their agent's terminal, and that they
// cannot act on. Building it manufactures a reason to keep the tab open, which
// is the failure mode for an ambient product, not a feature.

const MCP_CONFIG = `{
  "mcpServers": {
    "ocular": {
      "command": "npx",
      "args": ["-y", "useocular"]
    }
  }
}`;

const LAMP_FOR: Record<Worker['state'], { state: LampState; label: string }> = {
  connected: { state: 'live', label: 'connected' },
  offline: { state: 'caution', label: 'not reporting' },
  quiet: { state: 'caution', label: 'quiet' },
};

interface WorkerBlockProps {
  workers: Worker[];
  isSubscribed: boolean;
}

export function WorkerBlock({ workers, isSubscribed }: WorkerBlockProps) {
  if (workers.length === 0) {
    return <FirstRun isSubscribed={isSubscribed} />;
  }

  return (
    <div className="space-y-8">
      {workers.map((worker) => (
        <ConnectedWorker key={worker.id} worker={worker} />
      ))}
    </div>
  );
}

// At zero, the root is not a dashboard with empty slots -- it IS the next
// instruction. The config block is inline so the user never has to navigate
// back to the marketing site to find the thing they were told to paste. The
// moment the first heartbeat lands this is replaced permanently; there is no
// dismissible checklist and nothing that lingers after it is done.
function FirstRun({ isSubscribed }: { isSubscribed: boolean }) {
  return (
    <section>
      <Lamp state="inactive" label="not connected" />
      <h1 className="mt-stack-2 text-[30px] font-medium leading-[1.15] tracking-[-0.02em] text-text-primary">
        {isSubscribed ? 'Not connected — one step left.' : 'Not connected yet.'}
      </h1>

      {!isSubscribed ? (
        <>
          <p className="mt-stack-2 max-w-[60ch] text-[15px] leading-[1.6] text-text-secondary">
            Pick a plan and you&apos;re in. Then your agent can start looking at things.
          </p>
          <div className="mt-stack-3">
            <ButtonLink href="/billing" variant="primary">
              Pick a plan
            </ButtonLink>
          </div>
        </>
      ) : (
        <>
          <p className="mt-stack-2 max-w-[60ch] text-[15px] leading-[1.6] text-text-secondary">
            Add this to your agent&apos;s MCP config, then run your agent once. Ocular installs
            itself and shows up here.
          </p>
          <div className="mt-stack-3 max-w-[560px]">
            <CodeBlock code={MCP_CONFIG} label="Copy MCP config" />
          </div>
          <p className="mt-stack-2 font-mono text-[11.5px] text-text-tertiary">
            Nothing to download, and no key to paste.
          </p>
        </>
      )}
    </section>
  );
}

function ConnectedWorker({ worker }: { worker: Worker }) {
  const lamp = LAMP_FOR[worker.state];
  const seen = worker.heartbeatAt ?? worker.lastSeenAt;

  return (
    <section>
      <Lamp state={lamp.state} label={lamp.label} />

      {/* The split-weight headline is the website's own pattern: the dim clause
          sets up, the bright one lands. */}
      <h1 className="mt-stack-2 text-[30px] font-medium leading-[1.15] tracking-[-0.02em]">
        <span className="text-text-quaternary">
          {worker.state === 'connected' ? 'Ready on ' : 'Last seen on '}
        </span>
        <span className="text-text-primary">{worker.label ?? 'your machine'}</span>
      </h1>

      <p className="mt-stack-2 max-w-[60ch] text-[15px] leading-[1.6] text-text-secondary">
        {worker.state === 'connected'
          ? 'Idle. It wakes when your agent asks and shuts itself down when it stops.'
          : worker.state === 'quiet'
            ? 'Nothing is wrong — Ocular reports in when your machine is on and your agent connects.'
            : "It hasn't checked in recently. A closed laptop is the usual reason."}
      </p>

      <p className="mt-stack-1 font-mono text-[12px] text-text-tertiary">
        last check-in {formatRelative(seen)}
      </p>

      <KeyValues
        className="mt-stack-3 max-w-[420px]"
        rows={[
          { key: 'version', value: worker.version ?? '—' },
          { key: 'platform', value: worker.platform ?? '—' },
          { key: 'first connected', value: formatDay(worker.firstSeenAt) },
        ]}
      />
    </section>
  );
}
