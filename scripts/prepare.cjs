// simple-git-hooks needs a writable .git/hooks directory to install into —
// fine for a local dev clone, but fails hard (command not found / permission
// errors) in CI/deploy sandboxes that don't need git hooks at all, e.g.
// Vercel's build environment (see DEVLOG's Session 15 note). CI is the
// standard signal every major CI/deploy provider sets, Vercel included.
if (!process.env.CI) {
  require('child_process').execSync('npx simple-git-hooks', { stdio: 'inherit' });
}
