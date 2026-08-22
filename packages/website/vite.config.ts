import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // @ocular/motion is consumed via a local `file:` link (see DEVLOG/plan
    // notes on why — not yet published). Vite/Node resolve bare imports
    // from within a symlinked package's own node_modules first, so without
    // this, 'remotion'/'react' end up bundled twice (this package's copy +
    // ocular-motion's own devDependency copy), which Remotion's runtime
    // detects and throws on ("Multiple versions of Remotion detected").
    // dedupe forces both trees to resolve to this package's single copy.
    dedupe: ['react', 'react-dom', 'remotion'],
  },
  build: {
    target: 'es2020',
  },
});
