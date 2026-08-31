# Changelog

All notable changes to ModVitals. Generated from conventional commits.

## [0.1.0] — 2026-08-31

### Features

- feat(quality): enforce Code Quality & Style — 9 signals
- feat: show resolved effective cron in debug mode
- feat: add 'Generate Report Now' snapshot menu action for on-demand health reports
- feat: add reporting frequency presets with cron-matcher, customCron, timezone
- feat: add anomaly/spike detection using 7-day rolling average in Redis
- feat: add mod leaderboard with inactive alerts to health report
- feat: add user karma stats to repeat offender section (karma enrichment)
- feat: add configurable settings form for report frequency, hour, and metric visibility
- feat: implement report formatting and posting with mod-only visibility
- feat: implement scheduler metric aggregation for daily report generation
- feat: implement event trigger handlers with Redis counters
- feat: scaffold ModVitals v0.1.0 Devvit project

### Fixes

- fix: respect settings toggles in overview, add anomaly detection to snapshots, add debug mode
- fix: settings validation endpoints must return { success: boolean } per Devvit spec
- fix: fix reports trend arrow, remove dead formatLeaderboardEntry, make formatAccountAge pure
- fix: add console.error context to all silent catch blocks in metrics.ts

### Refactors

- refactor: DRY cleanup pass - centralize keys, extract date-utils, add topFromHash helper, standardize field naming
- refactor: decouple report posting into posting.ts module
- refactor: split index.ts god module into orthogonal routes/ directory

### Chores

- chore: set version to 0.1.0 per semver plan
- chore: move SUBMISSION.md and VIDEO_SCRIPT.md into docs/ directory

### Docs

- docs: add complete Devpost submission content
- docs: update README, SUBMISSION, and VIDEO_SCRIPT with full v0.1.0 feature set
- docs: clarify report hour is timezone-relative, not UTC
- docs: update README with complete feature list (presets, snapshot, karma, leaderboard, anomaly)
- docs: add README, submission writeup, demo script, and env example

### Other

- test: wire up test harness with tsx, export pure functions, add edge case tests
- Make cron schedule runtime-configurable via mod settings
- Fix server context bridging: use createServer from @devvit/web/server with getRequestListener from @hono/node-server
