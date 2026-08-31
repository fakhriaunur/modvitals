import assert from 'node:assert/strict';
import { FLAG_DEFINITIONS } from './feature-flags.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ok(cond: boolean, msg: string): void {
  assert.ok(cond, msg);
  console.log(`  ✓ ${msg}`);
}

function assertStrictEqual<T>(actual: T, expected: T, msg: string): void {
  assert.strictEqual(actual, expected, msg);
  console.log(`  ✓ ${msg}`);
}

// ---------------------------------------------------------------------------
// Flag definitions integrity
// ---------------------------------------------------------------------------

console.log('\n--- FLAG_DEFINITIONS ---');

ok(Object.keys(FLAG_DEFINITIONS).length >= 6, 'at least 6 flags defined');
ok('enhancedKarma' in FLAG_DEFINITIONS, 'enhancedKarma exists');
ok('anomalyV2' in FLAG_DEFINITIONS, 'anomalyV2 exists');
ok('anomalyV2Rollout' in FLAG_DEFINITIONS, 'anomalyV2Rollout exists');
ok('leaderboardV2' in FLAG_DEFINITIONS, 'leaderboardV2 exists');
ok('debugModeEnhanced' in FLAG_DEFINITIONS, 'debugModeEnhanced exists');
ok('snapshotEnabled' in FLAG_DEFINITIONS, 'snapshotEnabled exists');

for (const [key, def] of Object.entries(FLAG_DEFINITIONS)) {
  ok(typeof def.description === 'string' && def.description.length > 10, `${key} has description`);
  ok(typeof def.defaultEnabled === 'boolean', `${key} has defaultEnabled boolean`);
  ok(typeof def.owner === 'string' && def.owner.length > 0, `${key} has owner`);
  if (def.defaultRolloutPercent !== undefined) {
    ok(def.defaultRolloutPercent >= 0 && def.defaultRolloutPercent <= 100, `${key} rollout 0-100`);
  }
}

// Verify rollout bucket determinism (pure hashToBucket property via isFeatureEnabled logic)
// We can't call isFeatureEnabled without Redis, but we can test that FLAG_DEFINITIONS
// with 100% rollout would be enabled, and 0% would still check subreddit hash.
assertStrictEqual(
  FLAG_DEFINITIONS.anomalyV2Rollout.defaultRolloutPercent,
  100,
  'anomalyV2Rollout default 100%',
);
assertStrictEqual(
  FLAG_DEFINITIONS.enhancedKarma.defaultEnabled,
  true,
  'enhancedKarma default true',
);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('\n=== Results: feature-flags definition checks passed ===\n');
