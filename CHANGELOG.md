# Changelog

All notable changes to ModVitals. Generated from conventional commits.

## 1.0.0 (2026-09-01)


### Features

* add 'Generate Report Now' snapshot menu action for on-demand health reports ([18b50a1](https://github.com/fakhriaunur/modvitals/commit/18b50a183557405827831cb5039b923ec80a54d3))
* add anomaly/spike detection using 7-day rolling average in Redis ([4f480d5](https://github.com/fakhriaunur/modvitals/commit/4f480d5c7d6436ed0c5745afdf6eb9ab14b385f4))
* add configurable settings form for report frequency, hour, and metric visibility ([0440402](https://github.com/fakhriaunur/modvitals/commit/04404028f03819c9a0c3926262fdea0506093f78))
* add mod leaderboard with inactive alerts to health report ([24f0056](https://github.com/fakhriaunur/modvitals/commit/24f0056829379aa8082a73df05d7825dddbb31e0))
* add reporting frequency presets with cron-matcher, customCron, timezone ([13a4e49](https://github.com/fakhriaunur/modvitals/commit/13a4e490de2441684b63a963d7a72943d018bc9c))
* add user karma stats to repeat offender section (karma enrichment) ([58888dc](https://github.com/fakhriaunur/modvitals/commit/58888dc0d1566049d4b4e14d498d728b6f130390))
* **build:** automate Build & Release + unified mise toolchain (1A+2A+3B+4A) ([1e539d6](https://github.com/fakhriaunur/modvitals/commit/1e539d60533cea2c8b36dd655fcc82ad661c4f29))
* implement event trigger handlers with Redis counters ([c53e661](https://github.com/fakhriaunur/modvitals/commit/c53e66166cfc44ccde696f97566ed7fb0e5d2d51))
* implement report formatting and posting with mod-only visibility ([1fdb2be](https://github.com/fakhriaunur/modvitals/commit/1fdb2bec1a568a58b0ca562741800aebff56cefc))
* implement scheduler metric aggregation for daily report generation ([c2533d8](https://github.com/fakhriaunur/modvitals/commit/c2533d8c199a89cd821865918418ef2718313bff))
* **quality:** enforce Code Quality & Style — 9 signals ([b4dd3b0](https://github.com/fakhriaunur/modvitals/commit/b4dd3b0018362ec90b0af4a3c9d18768acb713b5))
* scaffold ModVitals v0.1.0 Devvit project ([1c01cf1](https://github.com/fakhriaunur/modvitals/commit/1c01cf1435f280392aef1b0dc17aae071d1e4e3a))
* show resolved effective cron in debug mode ([662967a](https://github.com/fakhriaunur/modvitals/commit/662967a613d295f0782427de784825d59e80cab3))


### Bug Fixes

* add console.error context to all silent catch blocks in metrics.ts ([56ddc84](https://github.com/fakhriaunur/modvitals/commit/56ddc84b56c074cd5f21aadced103cd485febe9e))
* **ci:** avoid secrets in if - check DEVVIT_TOKEN inside run ([aa8f4f4](https://github.com/fakhriaunur/modvitals/commit/aa8f4f496a95546c7c4c421ca73b9b0c826a5ca9))
* **ci:** correct deploy workflow secrets guard syntax ([138f864](https://github.com/fakhriaunur/modvitals/commit/138f8646db6c642a400eaec10930d5c40d7ae3a0))
* fix reports trend arrow, remove dead formatLeaderboardEntry, make formatAccountAge pure ([d6840e1](https://github.com/fakhriaunur/modvitals/commit/d6840e1000b3b01f11ba6111d3abbd4a33b2ed74))
* respect settings toggles in overview, add anomaly detection to snapshots, add debug mode ([9a99ada](https://github.com/fakhriaunur/modvitals/commit/9a99ada7b0cf5829f661be98a41ec0739272289c))
* settings validation endpoints must return { success: boolean } per Devvit spec ([f1240db](https://github.com/fakhriaunur/modvitals/commit/f1240db808e3dcc73f93152c566a89d8db3a6948))

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
