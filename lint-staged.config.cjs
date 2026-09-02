// Function-based config (not the plain array form in package.json) so each
// glob spawns exactly ONE shell command instead of lint-staged chaining two
// sequential child processes for the same file set — the two-command array
// form (`["eslint --fix", "prettier --write"]`) was hanging indefinitely on
// this machine specifically on the second command of the chain, reproducibly,
// even with lint-staged's own --no-stash flag and after clearing orphaned
// processes from earlier killed attempts. A single combined command per glob
// sidesteps whatever lint-staged-internal chaining bug that was.
'use strict';

function quoteAll(files) {
  return files.map((f) => `"${f}"`).join(' ');
}

module.exports = {
  '*.{ts,tsx}': (files) => `node scripts/lint-fix.cjs ${quoteAll(files)}`,
  '*.{json,md}': (files) => `node scripts/prettier-fix.cjs ${quoteAll(files)}`,
};
