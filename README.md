# ModVitals

**Automated health reports for your subreddit's moderation team — with enrichment, leaderboards, and anomaly detection.**

v0.1.0 — Built on Devvit (Reddit's developer platform)

---

## Problem

Subreddit moderators manage communities with little visibility into team effectiveness. Key questions go unanswered:

- How much content did mods process today?
- What rules are most frequently violated?
- Which users are repeat offenders?
- Is the mod team evenly sharing the workload?

ModVitals fills this gap. It watches moderation events in real time, aggregates the data, and posts a formatted daily health report — no dashboards to maintain, no external services.

## Features

- **Event Tracking** — Listens to post submissions, comment creation, and moderator actions (removes, approves, bans, warns, etc.)
- **Metrics Aggregation** — Stores daily counts in Redis: posts, comments, removals, approvals, per-mod action totals, per-rule violations, and repeat offender scores
- **Daily Reports** — A cron-driven scheduler generates a formatted Markdown post once per day
- **Trend Indicators** — Compares current period metrics against the previous period with ▲/▼ arrows and percentage change
- **Reporting Presets** — Flexible scheduling frequencies: hourly, 4-hourly, 12-hourly, daily, weekly, or custom cron expression with timezone support
- **Snapshot Reports** — On-demand 'Generate Report Now' menu action bypasses the cron schedule and produces an immediate [SNAPSHOT] report
- **Karma Enrichment** — Repeat offender section shows link karma, comment karma, account age, snoovatar, and subreddit-specific karma with period-over-period deltas
- **Mod Leaderboard & Inactive Alerts** — Ranked leaderboard of mods by action count, workload balance percentages, and configurable inactive-mod detection with warnings
- **Anomaly Detection** — Compares daily metrics against a 7-day rolling average, flags spikes above 2× baseline with an alerts section at the top of the report
- **Configurable Settings** — Mods toggle which sections and enrichment features appear in the report
- **Debug Mode** — When enabled, the report header displays all current settings values and the resolved cron expression so you can verify your configuration at a glance
- **Mod-Only Visibility** — Reports are posted as distinguished, approved submissions so regular users never see them

## How It Works

```
         ┌─────────────────┐
         │  Subreddit       │
         │  Events          │
         └──┬────┬────┬─────┘
            │    │    │
     ┌──────┘    │    └──────────┐
     ▼           ▼               ▼
┌─────────┐ ┌─────────┐ ┌─────────────┐
│onPost   │ │onComment│ │onModAction  │
│Submit   │ │Create   │ │             │
└────┬────┘ └────┬────┘ └──────┬──────┘
     │           │             │
     ▼           ▼             ▼
┌─────────────────────────────────────┐
│          Redis Data Store           │
│  metrics:YYYYMMDD (hash)            │
│  mods:YYYYMMDD    (hash)            │
│  modActions:YYYYMMDD (hash)         │
│  rules:YYYYMMDD   (hash)            │
│  offenders        (sorted set)      │
│  karma:YYYYMMDD   (hash)            │
│  snapshots:YYYYMMDD (hash)          │
│  lastReport       (string)          │
└──────────────┬──────────────────────┘
               │
               │ Cron: generate-report
               ▼
┌─────────────────────────────────────┐
│         Scheduler (cron)            │
│  1. Load mod settings               │
│  2. Check frequency/hour gate       │
│  3. Dedup (skip if already run)     │
│  4. Aggregate current period metrics│
│  5. Compare with previous period    │
│  6. Format Markdown report          │
│  7. Submit as distinguished post    │
└─────────────────────────────────────┘
```

1. **Triggers** — Three event hooks (`onPostSubmit`, `onCommentCreate`, `onModAction`) fire on subreddit activity and write metrics to Redis immediately
2. **Redis** — Daily hash keys store numeric counters; a sorted set tracks repeat offenders across all time
3. **Scheduler** — A heartbeat cron (`* * * * *`, every minute) invokes the report generator. On each tick, the handler loads runtime settings from Redis, checks `shouldGenerateReport()` against the configured frequency and timezone offset, applies dedup guards (daily/weekly: skip if already generated today; sub-hourly: skip if last report was under 60s ago), then aggregates metrics, computes trends, applies mod-configured visibility toggles, and posts the report
4. **Report Post** — The formatted Markdown is submitted as a self-post, then distinguished and approved so only moderators see it

## Tech Stack

| Component        | Technology                                        |
| ---------------- | ------------------------------------------------- |
| Platform         | [Devvit](https://developers.reddit.com/) v0.12.24 |
| Language         | TypeScript 6.0                                    |
| Server Framework | Hono 4.12 (via `@hono/node-server`)               |
| Data Store       | Redis (Devvit-managed, via `@devvit/web`)         |
| Bundler          | Vite 8.0                                          |
| Node.js          | >= 22.2.0                                         |

## Prerequisites

- **Node.js** >= 22.2.0
- **Devvit CLI** — install via `npm install -g devvit`
- **Reddit Developer Account** — register at [developers.reddit.com](https://developers.reddit.com)
- **A Subreddit** where you have mod permissions

## Quick Start

```bash
# 1. Log in to Devvit
npx devvit login

# 2. Upload the app to your subreddit
npx devvit upload

# 3. Install the app on your subreddit
npx devvit install <your-subreddit>
```

Once installed, the app starts collecting metrics immediately. The first report is generated at the next scheduled cron run (default: 12:00 UTC). You can adjust settings from the subreddit's Installed Apps menu.

## Configuration

ModVitals exposes the following settings (configurable per-subreddit via Devvit's settings UI):

| Setting                   | Type   | Default | Description                                                       |
| ------------------------- | ------ | ------- | ----------------------------------------------------------------- |
| Report Frequency          | select | `daily` | `hourly`, `4-hourly`, `12-hourly`, `daily`, `weekly`, or `custom` |
| Report Hour               | number | `12`    | Hour of day (0–23) for report generation                          |
| Report Minute             | number | `0`     | Minute of hour (0–59) for report generation                       |
| Timezone                  | select | `0`     | UTC offset (e.g. `-300` for UTC-5, `480` for UTC+8)               |
| Custom Cron               | string | —       | 5-field cron expression when frequency is `custom`                |
| Show Post Count           | toggle | `true`  | Include post submission count in Activity Summary                 |
| Show Comment Count        | toggle | `true`  | Include comment count in Activity Summary                         |
| Show Removal Count        | toggle | `true`  | Include content removal count                                     |
| Show Approval Count       | toggle | `true`  | Include content approval count                                    |
| Show Rule Violations      | toggle | `true`  | Include top violated rules section                                |
| Show Repeat Offenders     | toggle | `true`  | Include repeat offenders section                                  |
| Show Mod Activity         | toggle | `true`  | Include moderator activity section                                |
| Show Karma Stats          | toggle | `false` | Enrich offenders with karma, account age, snoovatar               |
| Show Leaderboard          | toggle | `true`  | Show ranked mod leaderboard with workload percentages             |
| Show Inactive Alerts      | toggle | `true`  | Flag mods inactive beyond the threshold                           |
| Inactive Threshold (days) | number | `5`     | Days without action before marking mod as inactive                |
| Show Anomaly Alerts       | toggle | `true`  | Show anomaly/spike alerts based on 7-day rolling average          |

## Report Sections

Each daily report is a Markdown post containing the following sections:

### Overview

Top-level totals for the period: removals, approvals, posts, and comments, each with a trend arrow (▲ / ▼ / ➡ / ―) comparing against the previous period. Each metric respects its corresponding visibility toggle (`showPosts`, `showComments`, `showRemovals`, `showApprovals`).

### Activity Summary

Aggregated submission counts, removal rate (removals / total submissions), and approval rate. This section is affected by the `showPosts`, `showComments`, `showRemovals`, and `showApprovals` toggles.

### Rule Violations

The most-frequently broken rules during the period, ranked by violation count. Disabled via `showRuleViolations`.

### Repeat Offenders

Users whose content was removed multiple times, sorted by incident count. Scores persist across all time via a Redis sorted set. Disabled via `showTopOffenders`.

When karma enrichment is enabled (`showKarmaStats`), each offender entry shows:

- Link and comment karma totals (e.g. `1.2k karma`)
- Account age (e.g. `3mo account`)
- Subreddit-specific karma (e.g. `-15 sub karma`)
- Snoovatar avatar image
- Period-over-period karma delta

### Mod Activity & Leaderboard

Disabled via `showModActivity`.

- **Leaderboard** — Ranked top 5 mods by action count with workload percentage (e.g. `1. u/mod1 — 42 actions (35%) [Most Active]`)
- **Inactive Alerts** — Mods flagged when no actions recorded within the configurable threshold (default 5 days), with days-since-last-action shown (e.g. `⚠️ u/mod4 — 0 actions (0%) — Inactive 7 days`)

### Debug Info

When debug mode is enabled (`showDebugInfo`), a **Debug Info** section appears at the top of the report showing:

- All current settings values (frequency, hour, minute, timezone, all toggle states)
- The resolved effective cron expression derived from the preset settings (e.g. `0 12 * * *` for daily at noon)

This section helps mods verify their configuration is correct without checking the settings panel.

### Anomaly Alerts

When anomaly detection is enabled (`showAnomalyAlerts`), an **Alerts** section appears at the top of the report when any metric exceeds 2× its 7-day rolling average:

- e.g. `⚠️ Unusual activity detected: 300% more removals than average (12 vs 4 avg). Possible brigading or spam wave.`

When fewer than 7 days of data exist, a baseline-collection message is shown instead.

## Development

```bash
# Install dependencies
npm install

# Build the project (server + client)
npm run build

# Type-check only
npm run type-check

# Run local development server with hot reload
npm run dev

# Upload for playtesting on a test subreddit
npx devvit playtest
```

### Viewing Logs

Stream live logs from an installed instance:

```bash
npx devvit logs <subreddit>
```

Replace `<subreddit>` with the name where the app is installed (no `r/` prefix needed).

## License

MIT — see [LICENSE](LICENSE) for details.
