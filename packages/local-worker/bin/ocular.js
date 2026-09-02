#!/usr/bin/env node
// Thin CLI entrypoint — this is what `npx useocular` actually runs. Kept as
// a separate shebanged file rather than putting `#!/usr/bin/env node` on
// dist/main.js directly, since dist/main.js is esbuild's bundle output and
// shouldn't need hand-editing after every build.
import '../dist/main.js';
