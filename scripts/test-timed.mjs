#!/usr/bin/env node
/**
 * Test performance tracking — runs each test suite and reports per-suite duration.
 * Used by CI and locally via `npm run test:timed`.
 * Mirrors vitest --durations / pytest --durations semantics for the tsx-based runner.
 */
import { spawnSync } from 'node:child_process';

const suites = [
  'src/server/report.test.ts',
  'src/server/scheduler-logic.test.ts',
  'src/server/settings.test.ts',
  'src/server/date-utils.test.ts',
  'src/server/karma.test.ts',
  'src/server/cron-matcher.test.ts',
  'src/server/feature-flags.test.ts',
];

console.log('Running test suites with timing...\n');
const results = [];
let failed = false;

for (const suite of suites) {
  const start = performance.now();
  const r = spawnSync('npx', ['tsx', suite], { stdio: 'inherit', shell: true });
  const durationMs = Math.round(performance.now() - start);
  results.push({ suite, durationMs, passed: r.status === 0 });
  if (r.status !== 0) failed = true;
  console.log(`  ⏱ ${suite}: ${durationMs}ms ${r.status === 0 ? '✓' : '✗'}\n`);
}

console.log('\n=== Test Performance Summary ===');
for (const { suite, durationMs, passed } of results) {
  console.log(`  ${passed ? '✓' : '✗'} ${suite.padEnd(40)} ${String(durationMs).padStart(5)}ms`);
}
const total = results.reduce((a, b) => a + b.durationMs, 0);
console.log(
  `\n  Total: ${total}ms (${(total / 1000).toFixed(2)}s) across ${results.length} suites`,
);

if (failed) process.exit(1);
