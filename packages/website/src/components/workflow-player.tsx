import { useMemo } from 'react';
import { Player } from '@remotion/player';
import { useReducedMotion } from 'framer-motion';
import { FPS, HEIGHT, TOTAL_FRAMES, WIDTH, WorkflowDemo } from '../remotion/workflow-demo.js';

// Replaces the earlier static ScanReveal panel — this is the "signature
// moment" the workflow motion graphic was asked to be, not a code block
// dropped in decoratively. Live @remotion/player (not a pre-rendered video)
// per the explicit call to prioritize visual quality over the site's JS
// budget for this one element (see DEVLOG's Phase 6 note).
export function WorkflowPlayer() {
  const reduceMotion = useReducedMotion();

  // Reduced motion: render paused on the final ("success") frame as a
  // static still, matching the accessibility contract every other motion
  // element on this site already follows.
  const initialFrame = useMemo(() => (reduceMotion ? TOTAL_FRAMES - 1 : 0), [reduceMotion]);

  return (
    <div className="relative aspect-[32/10] w-full overflow-hidden rounded-xl border border-white/10">
      <Player
        component={WorkflowDemo}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        compositionWidth={WIDTH}
        compositionHeight={HEIGHT}
        initialFrame={initialFrame}
        autoPlay={!reduceMotion}
        loop={!reduceMotion}
        controls={false}
        clickToPlay={false}
        showVolumeControls={false}
        // No <Audio> in the composition — initiallyMuted avoids the Player's
        // internal AudioContext.resume() call, which browsers block without a
        // user gesture and which otherwise stalls autoPlay entirely (confirmed
        // via a live browser check: playback was frozen at frame 0 until this
        // was added).
        initiallyMuted
        acknowledgeRemotionLicense
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
