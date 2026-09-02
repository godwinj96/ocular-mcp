#!/usr/bin/env node
// Reads the SHA-256 sidecar files produced by release-supervisor.yml's build
// matrix (one per platform, downloaded into ARTIFACTS_DIR) and writes them
// into packages/local-worker/supervisor-checksums.json — the manifest
// binary-resolver.ts trusts at download time. Extracted into a real script
// file (not an inline heredoc in the workflow YAML) after the inline version
// failed: a `<<'EOF'` heredoc terminator must be unindented, and the one
// nested inside the YAML `run:` block's indentation never matched, so the
// step failed in ~1s without ever running the script body.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REF_NAME = process.env.GITHUB_REF_NAME;
const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR ?? 'artifacts';
const MANIFEST_PATH = process.env.MANIFEST_PATH ?? 'packages/local-worker/supervisor-checksums.json';

if (!REF_NAME || !REF_NAME.startsWith('supervisor-v')) {
  throw new Error(`Expected GITHUB_REF_NAME like "supervisor-v0.1.0", got: ${REF_NAME}`);
}
const version = REF_NAME.slice('supervisor-v'.length);

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
manifest.version = version;

for (const key of Object.keys(manifest.binaries)) {
  const shaFile = fs.readdirSync(ARTIFACTS_DIR).find((f) => f.startsWith(`${key}-`) && f.endsWith('.sha256'));
  if (!shaFile) {
    throw new Error(`Missing checksum artifact for platform "${key}" in ${ARTIFACTS_DIR}`);
  }
  const hash = fs.readFileSync(path.join(ARTIFACTS_DIR, shaFile), 'utf8').trim().split(/\s+/)[0];
  manifest.binaries[key] = hash;
}

fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Wrote ${MANIFEST_PATH} for version ${version}:`, manifest.binaries);
