# ModVitals

**Automated daily health reports for your subreddit's moderation team.**

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
- **Daily Reports** — A cron-driven scheduler generates a formatted Markdown post once per day (configurable to weekly)
- **Trend Indicators** — Compares current period metrics against the previous period with ▲/▼ arrows and percentage change
- **Configurable Settings** — Mods toggle which sections appear in the report (Activity Summary, Rule Violations, Repeat Offenders, Mod Activity)
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
│  lastReport       (string)          │
└──────────────┬──────────────────────┘
               │
               │ Cron: generate-report
               ▼
┌─────────────────────────────────────┐
│         Scheduler (cron)            │
│  1. Load mod settings               │
│  2. Aggregate current period metrics│
│  3. Compare with previous period    │
│  4. Format Markdown report          │
│  5. Submit as distinguished post    │
└─────────────────────────────────────┘
```

1. **Triggers** — Three event hooks (`onPostSubmit`, `onCommentCreate`, `onModAction`) fire on subreddit activity and write metrics to Redis immediately
2. **Redis** — Daily hash keys store numeric counters; a sorted set tracks repeat offenders across all time
3. **Scheduler** — A cron task (`0 12 * * *` by default) invokes the report generator, which reads current and previous period data, computes trends, and applies mod-configured visibility toggles
4. **Report Post** — The formatted Markdown is submitted as a self-post, then distinguished and approved so only moderators see it

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Platform | [Devvit](https://developers.reddit.com/) v0.12.24 |
| Language | TypeScript 6.0 |
| Server Framework | Hono 4.12 (via `@hono/node-server`) |
| Data Store | Redis (Devvit-managed, via `@devvit/web`) |
| Bundler | Vite 8.0 |
| Node.js | >= 22.2.0 |

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

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Report Frequency | select | `daily` | `daily` or `weekly` |
| Report Time (UTC) | number | `12` | Hour of day (0–23) for report generation |
| Show Post Count | toggle | `true` | Include post submission count in Activity Summary |
| Show Comment Count | toggle | `true` | Include comment count in Activity Summary |
| Show Removal Count | toggle | `true` | Include content removal count |
| Show Approval Count | toggle | `true` | Include content approval count |
| Show Rule Violations | toggle | `true` | Include top violated rules section |
| Show Repeat Offenders | toggle | `true` | Include repeat offenders section |
| Show Mod Activity | toggle | `true` | Include moderator activity section |

## Report Sections

Each daily report is a Markdown post containing the following sections:

### Overview

Top-level totals for the period: removals, approvals, posts, and comments, each with a trend arrow (▲ / ▼ / ➡ / ―) comparing against the previous period.

### Activity Summary

Aggregated submission counts, removal rate (removals / total submissions), and approval rate. This section is affected by the `showPosts`, `showComments`, `showRemovals`, and `showApprovals` toggles.

### Rule Violations

The most-frequently broken rules during the period, ranked by violation count. Disabled via `showRuleViolations`.

### Repeat Offenders

Users whose content was removed multiple times, sorted by incident count. Scores persist across all time via a Redis sorted set. Disabled via `showTopOffenders`.

### Mod Activity

- **Top Moderators** — which mods performed the most actions
- **Action Breakdown** — most common action types (removelink, approvecomment, banuser, etc.)

Disabled via `showModActivity`.

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
