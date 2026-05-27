# ModVitals — Devpost Submission

**Reddit Mod Tools Hackathon — May 2026**

---

## Elevator Pitch

> Real-time subreddit health reports with karma enrichment, anomaly detection, and mod leaderboards — automated, mod-only, and fully configurable from the mod panel.

---

## About the Project

### Inspiration

Academic research from CHI 2026 confirms what moderators have been saying for years: **74.5% of mods experience queue collisions**, where multiple moderators unknowingly process the same content. Moderators juggle fragmented tools — mod log for history, third-party dashboards for stats, and manual spreadsheets for trend tracking — but none of these provide an automated, unified view of subreddit health.

Scouring r/modhelp and r/ModSupport reveals a recurring theme: moderators want to know "how is our subreddit doing this week?" without manually stitching together data from five different sources. Yet Reddit's native mod log is capped at 90 days, and no existing Devvit app delivers a scheduled, enriched, multi-dimensional health digest.

Existing Devvit apps each cover one dimension:
- **modlogstats** shows raw mod log counts but no trends, no schedules, no enrichment
- **modqueue-tools** helps clear queues faster but doesn't measure team throughput
- **sub-stats-bot** provides on-demand stats but has no scheduler, no anomaly detection, no per-mod breakdown

No one has combined all these signals into a single automated report. ModVitals was born from that gap — a complete, zero-config health monitor that tells your mod team exactly what's happening, every reporting period, without anyone lifting a finger.

### What it does

ModVitals is a Devvit app that generates automated periodic health reports for subreddit moderation teams. It runs entirely on Reddit's platform — no external servers, no dashboards, no browser extensions required.

**Core capabilities:**

- **6 reporting presets** — Hourly, 4-hourly, 12-hourly, daily, weekly (Monday), or custom cron expression. Each preset resolves to its effective cron at runtime, with timezone offset applied from the settings panel (34 timezone options, UTC-12 through UTC+14).

- **Heartbeat scheduler** — Devvit's static cron (`* * * * *`) fires every minute, but ModVitals checks runtime settings on each tick. `shouldGenerateReport()` gates execution based on configured frequency, timezone-adjusted wall clock, and dedup guards (daily/weekly skip if already generated today; sub-hourly skip if last report was under 60s ago). This heartbeat pattern unlocks flexible scheduling despite platform constraints.

- **3 event triggers** — `onPostSubmit`, `onCommentCreate`, and `onModAction` fire on every subreddit activity, writing incremental metrics to Redis immediately. Per-mod action counts, per-rule violation tallies, and repeat-offender scores are all tracked in real time.

- **Redis-powered data layer** — Daily hash keys store numeric counters (`metrics:YYYYMMDD`, `mods:YYYYMMDD`, `modActions:YYYYMMDD`, `rules:YYYYMMDD`). A sorted set (`offenders`) tracks repeat offenders across all time, persisting beyond Reddit's 90-day mod log window. Snapshot hashes isolate on-demand reports from production schedules.

- **8+ section enriched report** — Each report post contains:
  - **Overview** — Top-level totals with trend arrows (▲/▼/➡) and percentage change vs. previous period, gated by per-metric visibility toggles
  - **Activity Summary** — Aggregated submission counts, removal rate, and approval rate
  - **Rule Violations** — Most-frequently broken rules ranked by count
  - **Repeat Offenders** — Users with multiple removals, optionally enriched with link karma, comment karma, account age, snoovatar avatar, and subreddit-specific karma with period-over-period deltas
  - **Mod Leaderboard** — Top 5 mods ranked by action count with workload percentage; inactive mod alerts with days-since-last-action
  - **Anomaly Alerts** — Metrics exceeding 2× the 7-day rolling average flagged at the top of the report (e.g., "⚠️ Unusual activity: 300% more removals than average")
  - **Debug Info** — When enabled, shows all 18 settings values and the resolved effective cron expression

- **18 configurable settings** — Organized by category: scheduling (frequency, hour, minute, timezone, custom cron), visibility toggles (posts, comments, removals, approvals, rule violations, repeat offenders, mod activity, leaderboard, inactive alerts), enrichment (karma stats), and behavior (inactive threshold days, anomaly alerts, debug mode).

- **Snapshot on-demand** — "Generate Report Now" in the subreddit overflow menu produces an immediate `[SNAPSHOT]` report without affecting the production schedule. Snapshots write to dedicated Redis keys (`snapshots:YYYYMMDD`), isolating them from the regular data stream.

- **Mod-only visibility** — Every report is posted as a distinguished, approved self-post. Regular subreddit members never see it. The report is a private team dashboard disguised as a Reddit post.

- **Zero-config startup** — Install and go. Smart defaults (daily at noon UTC, all sections enabled) mean the first report appears at the next cron tick with no configuration required.

### How we built it

**Architecture: triggers → Redis → heartbeat scheduler → enrichment → formatting → posting**

```
onPostSubmit / onCommentCreate / onModAction
        │
        ▼
   Redis (real-time incremental writes)
        │
        ▼
   Heartbeat cron (* * * * *) → shouldGenerateReport() gate
        │
        ├──→ Aggregate current period metrics
        ├──→ Compute trends (vs. previous period)
        ├──→ Enrich offenders (karma API calls)
        ├──→ Detect anomalies (7-day rolling avg)
        ├──→ Format Markdown (settings-aware sections)
        └──→ Post as distinguished + approved
```

**Tech stack:**

| Layer | Technology |
|-------|-----------|
| Platform | Devvit 0.12.24 (Reddit's developer platform) |
| Language | TypeScript 6.0 (strict mode) |
| Server framework | Hono 4.12, bridged via `@hono/node-server` to Devvit's `createServer` |
| Data store | Redis (Devvit-managed, per-installation) |
| Bundler | Vite 8.0 |
| Runtime | Node.js ≥ 22.2.0 |

**Codebase structure (19 TypeScript source files):**

```
src/
├── client/
│   └── index.html              # Devvit app shell
└── server/
    ├── index.ts                # Entry point: registers routes + triggers
    ├── server.ts               # createServer bridging (Hono → Devvit Web)
    ├── settings.ts             # Settings loading, validation, presets
    ├── scheduler-logic.ts      # shouldGenerateReport, aggregation, anomaly detection
    ├── metrics.ts              # Redis read/write layer for all metric keys
    ├── karma.ts                # Reddit API enrichment (karma, age, snoovatar)
    ├── date-utils.ts           # Date math, timezone offset, period boundaries
    ├── cron-matcher.ts         # Cron expression parser and matcher
    ├── report.ts               # Pure Markdown formatting (all section formatters)
    ├── posting.ts              # Reddit API: submit + distinguish + approve
    └── routes/
        ├── triggers.ts         # onPostSubmit, onCommentCreate, onModAction handlers
        ├── scheduler.ts        # Heartbeat cron handler
        └── snapshot.ts         # Overfow menu "Generate Report Now" handler
```

**Testing: 426 tests across 6 test files**

```
src/server/report.test.ts           # Formatting output verification
src/server/scheduler-logic.test.ts   # Aggregation, trends, anomaly detection
src/server/settings.test.ts          # Settings resolution + validation
src/server/date-utils.test.ts        # Date math + timezone offset
src/server/karma.test.ts             # Karma enrichment formatting
src/server/cron-matcher.test.ts      # Cron expression matching
```

**Design principles (Pragmatic Programmer):**

- **DRY** — 12 duplicate patterns eliminated during v0.1.0 refactoring. `formatBulletList`, `formatWithTrend`, and `trendArrow` are single-source helpers reused across all 8 report sections.
- **Orthogonality** — Each module has a single, well-defined responsibility. `metrics.ts` reads/writes Redis. `karma.ts` enriches users. `report.ts` formats output. `posting.ts` handles API submission. No module reaches into another's internals.
- **FCIS (Functional Core, Imperative Shell)** — Pure functions (`report.ts`, `cron-matcher.ts`, `date-utils.ts`, `settings.ts`) form the functional core with zero side effects and are fully unit-testable. The imperative shell (`routes/`, `posting.ts`, `metrics.ts`) handles I/O: Redis reads/writes, Reddit API calls, and HTTP endpoints.
- **Crash Early** — Every `catch` block logs to `console.error` with contextual detail. Redis read errors propagate immediately rather than silently returning `{}` (which was indistinguishable from genuinely empty data in early builds).

### Challenges we ran into

**1. Devvit server context bridging**

Devvit's `createServer` from `@devvit/web/server` expects Express-style `(req, res)` callbacks, but Hono uses the Web Fetch API (`Request` / `Response`). The two paradigms don't natively interoperate. We solved this with `@hono/node-server`'s `getRequestListener`, which creates a Node.js HTTP listener from a Hono app. This listener bridges Hono's fetch-based routing into Devvit's Express-compatible server context. The result is clean, modern Hono routing inside a platform that predates the Fetch API standard.

**2. Settings validation response format**

Devvit's settings validation endpoints require a specific response shape: `{ success: boolean }`. The documentation was unclear — early builds returned full validation error objects, and Devvit swallowed them silently, displaying a generic "Oops" toast with no diagnostic information. After systematic trial-and-error testing, we identified the required contract: validation endpoints must return exactly `{ success: true }` or `{ success: false }`. Any other shape is silently discarded.

**3. Interactive OAuth**

`devvit upload` and `devvit install` require browser-based OAuth login. In a headless CI environment, this blocks automation. We used `echo` piping to feed credentials through the interactive CLI prompts, but the final OAuth redirect still requires a manual browser verification step. Our solution: automate everything up to the redirect, then open the verification URL in the default browser for a single click. Not fully headless, but close.

**4. Silent error swallowing**

Redis read errors in Devvit's managed Redis returned `{}` (empty object) — identical to the return value for a key that genuinely has no data. This made debugging impossibly opaque: was a report empty because there were no events, or because Redis threw an error? Applying the Pragmatic Programmer principle of "Crash Early," we added `console.error` in every `catch` block with the full error context, and added explicit `null` vs. `{}` guard checks in the metrics layer. Now errors are immediately visible in `devvit logs`.

**5. Overview settings bug**

The `formatOverview()` function originally hardcoded all four metrics (posts, comments, removals, approvals) regardless of the moderator's visibility toggle settings. If a mod disabled "Show Post Count" in settings, the Overview still displayed it. The fix was straightforward but easy to miss: gate each metric line behind its corresponding `showPosts` / `showComments` / `showRemovals` / `showApprovals` boolean. This is now enforced by the test suite, which verifies that disabled toggles produce no output in the formatted report.

**6. Cron schedule rigidity**

Devvit's scheduler configuration in `devvit.json` is static — you define a cron expression at build time, and it never changes. But ModVitals needed runtime-selectable reporting frequencies (hourly through custom cron). Our solution: set the static cron to `* * * * *` (every minute) and implement a heartbeat pattern. On each tick, `shouldGenerateReport()` loads the current settings from Redis, computes the effective cron from the preset (e.g., `daily` + `reportHour=12` + `timezoneOffset=-300` → `0 12 * * *`), applies timezone-adjusted wall-clock time, and only proceeds if the current minute matches. Dedup guards prevent double-fires. The result: 6 independent reporting presets with full timezone support on a platform that only supports static cron.

### Accomplishments that we're proud of

- **426 passing tests with pure-function architecture.** Every formatting function, date calculation, trend computation, cron matcher, and settings resolver is tested in isolation. The test suite catches regressions immediately and serves as living documentation of expected behavior.

- **6 independent reporting presets with timezone support** in a platform whose scheduler only supports a single static cron expression. The heartbeat pattern with runtime settings gating is a novel workaround that unlocks truly flexible scheduling without any platform changes.

- **PP-compliant codebase.** After an initial "God module" prototype, we systematically split the codebase: `report.ts` was extracted from `scheduler-logic.ts`, `formatBulletList` was deduplicated from 12 call sites, and all I/O was isolated to the imperative shell. The result is a codebase where every module has a single clear responsibility.

- **Real-time karma enrichment with per-user API calls that don't crash the report.** Each repeat offender triggers a Reddit API call for karma data. If any single call fails (rate limit, deleted user, private profile), the report continues — the offender still appears but without enrichment. Individual failures are logged but never fatal.

- **Anomaly detection with rolling averages on a serverless platform.** Computing 7-day rolling averages requires historical data, but serverless platforms are stateless. We solved this by storing daily metric hashes in Redis with date-keyed names (`metrics:YYYYMMDD`), loading the last 7 days on each report generation, and computing the baseline on the fly. The anomaly alert fires when any metric exceeds 2× its rolling average.

- **Debug mode that shows resolved effective cron from preset settings.** Instead of forcing mods to understand our internal scheduling logic, the debug section displays exactly what the system resolved: "Your daily report at hour 12 → effective cron: `0 12 * * *`". This makes configuration verification trivial.

- **Snapshots that don't pollute production schedules.** On-demand reports via the overflow menu write to separate Redis keys (`snapshots:*`) and skip the `lastReport` timestamp update. Production cron continues unaffected. Mods can generate as many snapshots as they want without disrupting the regular reporting cadence.

### What we learned

- **Devvit Web's context model and server bridging pattern.** The `createServer` API is Express-flavored but lives inside Reddit's platform context. Understanding the request lifecycle — from Reddit event → Devvit platform → `createServer` → Hono → route handler — was essential for debugging. `@hono/node-server`'s `getRequestListener` turned out to be the perfect bridge between Web Fetch API and Node.js HTTP paradigms.

- **Pragmatic Programmer principles in practice.** The "DRY" refactoring pass took 6 features to feel the pain, then eliminated 12 duplicate patterns in a single afternoon. The "Orthogonality" principle caught several design issues early — when `report.ts` tried to call Redis directly, we knew the boundary was wrong before writing a single test. "Crash Early" directly solved our hardest debugging problem (silent error swallowing).

- **Testing pure functions is the highest-leverage activity.** Three real bugs were found through tests that would have been extremely difficult to reproduce manually: a timezone offset sign error (UTC-5 was adding 5 hours instead of subtracting), a cron matcher off-by-one for the hour field, and the Overview settings bug where disabled toggles were silently ignored. Each was caught immediately by a failing test before deployment.

- **Settings UIs need validation endpoint specs documented clearly.** The `{ success: boolean }` contract for Devvit validation endpoints was undocumented. A single example in the Devvit docs would have saved hours of trial-and-error debugging. If you're building a Devvit app with settings, add `console.error` logging inside every validation endpoint from day one.

- **Heartbeat pattern is a powerful workaround for static platform constraints.** When the platform gives you a static cron, don't fight it — lean in. A 1-minute heartbeat with runtime gating logic is more flexible than any static cron expression, and it costs essentially nothing in Redis read overhead (a single `hgetall` per tick).

### What's next for ModVitals

- **Modmail delivery option.** Posting reports as distinguished self-posts works, but some mod teams prefer inbox delivery. Adding a modmail-based delivery channel would make reports accessible even to mods who don't regularly visit the subreddit.

- **Discord webhook integration.** Many mod teams coordinate on Discord. Sending health report summaries to a Discord channel via webhook would bring the data where mods already are.

- **Public-facing community health reports (opt-in).** Some communities want to share moderation transparency with their members. An opt-in public report mode could foster trust between mod teams and their communities.

- **Predictive insights.** With enough historical data, ModVitals could forecast trends: "At current growth, you'll need 2 more mods by August" or "Spam volume typically spikes 40% on weekends — consider staffing up Saturday shifts."

- **Multi-subreddit aggregated reports.** Moderators who oversee multiple communities need a cross-subreddit view. An aggregated report combining metrics from all installed subreddits would give power mods a single pane of glass.

- **Historical trend visualization.** Charts and graphs inside reports — removal rate over time, mod activity heatmaps, rule violation trends — would make patterns immediately visible without reading numbers.

---

## Tool Overview

ModVitals transforms Reddit's native mod tooling into an automated, configurable health monitoring system. Here's how it works end to end.

### Installation flow

```
npx devvit login           # → browser OAuth
npx devvit upload          # → deploys to Reddit's platform
npx devvit install mysub   # → activates on target subreddit
```

Three commands, under two minutes. Once installed, ModVitals appears in the subreddit's **Installed Apps** menu under Mod Tools. All 18 settings are accessible from the settings panel — no code, no config files, no environment variables.

### Event triggers

Three event hooks fire on every piece of subreddit activity:

| Trigger | When it fires | What it tracks |
|---------|--------------|----------------|
| `onPostSubmit` | Any user submits a post | Increments post count for the day |
| `onCommentCreate` | Any user posts a comment | Increments comment count for the day |
| `onModAction` | A mod removes, approves, bans, warns, or performs any mod action | Increments per-mod action count, per-rule violation count (for removals), repeat offender score (sorted set), and removal/approval totals |

All metrics are written to Redis immediately — zero batching, zero delay. The data is available for the next report generation within seconds.

### Reporting presets and heartbeat scheduler

ModVitals offers 6 reporting presets, each resolving to an effective cron at runtime:

| Preset | Behavior | Effective cron (example) |
|--------|---------|--------------------------|
| `hourly` | Fires every hour at configured minute | `0 * * * *` (at minute 0) |
| `4-hourly` | Fires every 4 hours at configured minute | `0 */4 * * *` |
| `12-hourly` | Fires every 12 hours at configured minute | `0 */12 * * *` |
| `daily` | Fires once per day at configured hour | `0 12 * * *` (at noon) |
| `weekly` | Fires every Monday at configured hour | `0 12 * * 1` |
| `custom` | User-provided 5-field cron expression | whatever the mod enters |

The timezone offset (configured in settings) adjusts wall-clock time before checking the effective cron. A daily report at hour 12 with UTC-5 (Eastern) fires at 7:00 UTC — which is noon Eastern.

Dedup guards prevent double-generation:
- **Daily / Weekly**: Skip if `lastReport` timestamp is already on today's date
- **Sub-hourly**: Skip if `lastReport` was less than 60 seconds ago

### Snapshot on-demand reports

The subreddit overflow menu includes a **"Generate Report Now"** action. Clicking it produces an immediate `[SNAPSHOT]` report using current Redis data. Snapshots write to isolated keys (`snapshots:YYYYMMDD`), skip the `lastReport` update, and don't interfere with the regular cron schedule. Mods can generate unlimited snapshots without affecting production cadence.

### Report sections

**Overview** — Top-level totals with trend indicators:
```
📊 Overview (Sep 15, 2025)

- Total Removals: 47 ▲ (23% up)
- Total Approvals: 12 ▼ (8% down)
- Posts Submitted: 89 ➡ (no change)
- Comments Created: 342 ▲ (15% up)
```

Each metric respects its visibility toggle. Disable "Show Post Count" and the Posts line disappears.

**Activity Summary** — Aggregated rates and totals:
```
📈 Activity Summary

- Total Submissions: 431 (89 posts + 342 comments)
- Removal Rate: 10.9%
- Approval Rate: 2.8%
```

**Rule Violations** — Top violated rules:
```
⚠️ Top Rule Violations

1. Rule 1: Be Civil — 23 violations
2. Rule 4: No Spam — 15 violations
3. Rule 2: Stay On Topic — 8 violations
```

Controlled by `showRuleViolations` toggle.

**Repeat Offenders** — With optional karma enrichment:
```
🔁 Repeat Offenders

1. u/troll_account_42 — 5 removals
   🏆 1.2k karma | 📅 3mo account | 📉 -15 sub karma
   [snoovatar image]

2. u/spam_bot_789 — 3 removals
   🏆 50 karma | 📅 2w account | 📉 -42 sub karma
```

When karma stats are enabled (`showKarmaStats`), each offender shows link+comment karma, account age, subreddit-specific karma with delta, and snoovatar avatar. If a karma API call fails, the offender still appears but without enrichment — individual failures are non-fatal.

**Mod Leaderboard** — Workload visibility:
```
👥 Mod Activity

🏅 Leaderboard
1. u/mod_alice — 42 actions (35%) [Most Active]
2. u/mod_bob — 31 actions (26%)
3. u/mod_carol — 28 actions (23%)
4. u/mod_dave — 12 actions (10%)
5. u/mod_eve — 7 actions (6%)

⚠️ Inactive
u/mod_frank — 0 actions (0%) — Inactive 7 days
```

Controlled by `showModActivity`, `showLeaderboard`, and `showInactiveAlerts`. The inactive threshold is configurable (default: 5 days). Workload percentages help identify burnout risk — if one mod is handling 60%+ of actions, the leaderboard makes it visible.

**Anomaly Alerts** — Spike detection:
```
🚨 Alerts

⚠️ Unusual activity detected: 300% more removals than average (12 vs 4 avg).
   Possible brigading or spam wave.

⚠️ Unusual activity detected: 250% more posts than average (50 vs 20 avg).
```

Controlled by `showAnomalyAlerts`. The 7-day rolling average is computed from the last 7 daily metric hashes in Redis. If fewer than 7 days of data exist, a baseline-collection message is shown instead. Anomaly alerts appear at the very top of the report, above the Overview, so they're the first thing mods see.

**Debug Info** — Full configuration visibility:
```
🔧 Debug Info

Settings:
- reportFrequency: daily
- reportHour: 12
- reportMinute: 0
- timezoneOffset: -300
- showPosts: true
- showComments: true
- showRemovals: true
- showApprovals: true
- showRuleViolations: true
- showTopOffenders: true
- showModActivity: true
- showKarmaStats: false
- showLeaderboard: true
- showInactiveAlerts: true
- inactiveThresholdDays: 5
- showAnomalyAlerts: true
- showDebugInfo: true
- customCron: 0 12 * * *

Effective Cron: 0 12 * * *
```

Enabled by `showDebugInfo`. Shows all 18 settings and the resolved effective cron. This is the single most useful feature for troubleshooting "why didn't my report fire?" questions.

### 18 configurable settings

**Scheduling:**
1. `reportFrequency` — hourly, 4-hourly, 12-hourly, daily, weekly (Monday), custom
2. `reportHour` — Hour of day (0–23) for daily/weekly reports
3. `reportMinute` — Minute of hour (0–59) for sub-daily reports
4. `timezoneOffset` — UTC offset in minutes (34 options, -720 to +840)
5. `customCron` — 5-field cron expression for custom frequency

**Visibility toggles:**
6. `showPosts` — Post submission count
7. `showComments` — Comment count
8. `showRemovals` — Content removal count
9. `showApprovals` — Content approval count
10. `showRuleViolations` — Top violated rules section
11. `showTopOffenders` — Repeat offenders section
12. `showModActivity` — Moderator activity section
13. `showLeaderboard` — Ranked mod leaderboard
14. `showInactiveAlerts` — Inactive mod warnings

**Enrichment:**
15. `showKarmaStats` — Karma, account age, snoovatar for offenders

**Behavior:**
16. `inactiveThresholdDays` — Days without action before flagging a mod (default 5)
17. `showAnomalyAlerts` — Anomaly/spike detection
18. `showDebugInfo` — Debug mode showing settings + effective cron

### Mod-only visibility

Every report is posted as a **distinguished** (green mod shield) and **approved** (checkmark) self-post. Regular subreddit members never see it in their feed. The report is accessible only to moderators viewing the subreddit directly or through mod tools. This makes ModVitals a private team dashboard — no public exposure, no opt-out mechanics required.

### Zero-config startup

ModVitals works immediately after installation with no configuration. Default settings (daily at 12:00 UTC, all sections enabled) produce a useful report on the first cron tick. Mods can refine settings later, but nothing is required to get started.

---

## Project Impact

### 1. r/modhelp — Meta-moderation community

r/modhelp is where new and experienced moderators exchange advice on running healthy communities. ModVitals serves as both a tool and a teaching instrument here. By running ModVitals on r/modhelp itself, the community can:

- Surface real queue-health trends and demonstrate what "healthy" moderation patterns look like
- Give new moderators concrete metrics to understand — instead of abstract advice like "check mod log regularly," they can see a live example of what daily reports surface
- Create a shared vocabulary around moderation metrics: removal rate, workload balance, anomaly thresholds

ModVitals on r/modhelp becomes a reference implementation — a living demo that any moderator can inspect and replicate for their own community.

### 2. Growing communities (10K–100K subscribers)

Communities crossing the 10K-subscriber threshold face a critical scaling point: the mod team typically grows from 2–3 people to 8–12, and coordination becomes the bottleneck. ModVitals addresses this directly:

- **Workload visibility:** The leaderboard shows whether actions are evenly distributed or if one mod is carrying 60%+ of the load. This catches burnout before it happens.
- **Inactive alerts:** Configurable threshold (default 5 days) catches mods who've quietly stepped away. No awkward conversations — the data speaks.
- **Anomaly detection:** Growing communities are prime targets for brigading raids. The 7-day rolling average catches unusual spikes that a busy mod team might otherwise miss in the noise.
- **Historical archive:** Reddit's mod log caps at 90 days. ModVitals' Redis layer preserves data indefinitely. When a community doubles in size over 6 months, the mod team has the data to prove they need more help.

### 3. Content-heavy / high-moderation subreddits (100K+)

Large, active communities generate enormous moderation volume. The signal-to-noise ratio in the mod log is terrible — thousands of actions per day, no prioritization. ModVitals provides:

- **Repeat offender tracking with karma enrichment:** A user with 8 removals and -100 subreddit karma is a very different problem from a first-time rule breaker. Karma enrichment surfaces this context automatically.
- **Rule violation trends:** If Rule 4 ("No Spam") goes from 5 violations/week to 40, the trend is immediately visible. The mod team can adjust AutoMod rules or add new filters before it gets worse.
- **Long-term audit trail:** Beyond Reddit's 90-day limit, ModVitals provides a permanent record of moderation patterns — useful for transparency reports, community updates, and defending moderation decisions when challenged.
- **Team scaling:** When a mod team grows from 15 to 30 people, individual contributions blur. The leaderboard and workload percentages keep everyone accountable without micro-management.

---

## Logo Image Prompt

> A clean, flat-vector tech logo in 3:2 horizontal aspect ratio. A shield silhouette integrated with an ECG/pulse heartbeat line morphing into a bar chart — the shield represents protection/moderation, the pulse line represents health monitoring, and the bar chart represents data/analytics. The composition is centered with the shield as the primary icon and the data visualization flowing from within it. Color palette: deep navy blue (#1A1A2E) as the background, vibrant teal (#00D4AA) for the pulse line and chart elements, warm amber (#FF6B35) as an accent for the alert/pulse peak. Minimal stylized text reading "ModVitals" in a clean geometric sans-serif below the icon in white. Flat vector style, no gradients, crisp edges, suitable for both app icon (square crop from center) and horizontal banner use. Tech-forward, professional, evokes trust and monitoring.

---

*Built solo for the Reddit Mod Tools Hackathon (May 2026). 426 tests. 19 source files. Zero external dependencies beyond the Devvit platform.*
