#!/usr/bin/env node
/**
 * Build performance tracking — measures Vite build duration and exports metrics.
 * Used by CI (build_performance_tracking) and locally via `npm run build:timed`.
 * Writes `dist/build-metrics.json` with durationMs, timestamp, and compressed sizes.
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const start = performance.now();
const result = spawnSync('npx', ['vite', 'build'], { stdio: 'inherit', shell: true });
const durationMs = Math.round(performance.now() - start);

if (result.status !== 0) process.exit(result.status ?? 1);

// Collect artifact sizes (best-effort)
function sizeOf(path) {
  try {
    if (!existsSync(path)) return null;
    const stat = statSync(path);
    if (stat.isDirectory()) return null;
    return stat.size;
  } catch {
    return null;
  }
}

const metrics = {
  timestamp: new Date().toISOString(),
  durationMs,
  durationSec: (durationMs / 1000).toFixed(2),
  artifacts: {
    serverBundle: sizeOf(join('dist', 'server', 'index.cjs')),
    clientDir: existsSync(join('dist', 'client')) ? 'present' : 'missing',
  },
  nodeVersion: process.version,
};

try {
  writeFileSync(join('dist', 'build-metrics.json'), JSON.stringify(metrics, null, 2));
  console.log(`\n⏱  Build completed in ${metrics.durationSec}s (${durationMs}ms)`);
  console.log(`   Metrics written to dist/build-metrics.json`);
} catch (err) {
  console.warn('[build-timed] could not write metrics', err);
}
