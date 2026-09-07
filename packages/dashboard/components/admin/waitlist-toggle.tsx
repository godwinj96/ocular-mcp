'use client';

import { useState } from 'react';
import { Toggle } from '../ui/toggle';
import { Lamp } from '../ui/lamp';
import { toggleWaitlistModeAction } from '../../app/admin/actions';

export function WaitlistToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);

  function handleToggle(): void {
    // Optimistic: flip immediately, reconcile with whatever the server
    // actually persisted once the action resolves. A toggle that visibly
    // lags its own click reads as broken.
    setEnabled((current) => !current);
    void toggleWaitlistModeAction().then(setEnabled);
  }

  return (
    <div className="flex flex-col gap-3">
      <Toggle checked={enabled} label="Waitlist mode" onToggle={handleToggle} />
      {enabled && (
        <Lamp
          state="caution"
          label="waitlist mode is live — checkout is hidden on the public site"
        />
      )}
    </div>
  );
}
