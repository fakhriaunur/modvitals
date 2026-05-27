# Devpost Submission — ModVitals

---

## Project Name

ModVitals

---

## Tagline

Automated daily health reports for subreddit moderators

---

## Description

Moderating a growing subreddit is a firehose: posts, comments, reports, modmail, bans. Trends that matter — a spike in removals, a single mod doing all the work, the same user getting warned for the third time — get buried in the noise. ModVitals is a Devvit app that watches your subreddit in real time and turns that firehose into scheduled health reports so you and your team know what's happening without having to dig.

Four layers run under the hood. **Event triggers** (post submit, comment create, mod action) fire instantly through Devvit's webhook system and write counters to Redis. **A heartbeat scheduler** (every minute) loads runtime settings from Redis, checks frequency and timezone gates via `shouldGenerateReport()`, applies dedup guards (daily/weekly: skip if already generated today; sub-hourly: skip if last report was under 60s ago), then aggregates Redis counters into typed metrics objects: submission volumes, removal/approval rates, rule-violation tallies, per-mod action counts, and repeat-offender scores. **Enrichment layers** augment the data — karma stats with account age and snoovatars for repeat offenders, period-over-period karma deltas, a ranked mod leaderboard with workload percentages, inactive mod detection with configurable thresholds, and anomaly detection via 7-day rolling averages with 2× spike flags. **A report formatter** composes each metric block into clean Markdown and submits it as a distinguished, approved mod post — visible only to the moderator team.

Configuration is entirely in-subreddit via Devvit's settings panel with 18 settings: six reporting presets (hourly, 4-hourly, 12-hourly, daily, weekly, custom cron) with 33 timezone offsets, per-section visibility toggles, karma/leaderboard/inactive/anomaly/debug toggles, and all four validation endpoints. On-demand snapshot reports bypass the schedule via the "Generate Report Now" menu action. The report includes trend arrows (▲ up, ▼ down, ➡ flat) comparing the current period against the previous one, and debug mode shows the resolved effective cron expression so mods can verify configuration at a glance. Every data point is storable and comparable because each day's metrics live in date-keyed Redis hashes. The test suite covers 419 tests across 6 files.

---

## Category

Best New Mod Tool

---

## Built With

- **Devvit** — Reddit's app platform for triggers, scheduler, settings, Redis, and posting
- **TypeScript** — type-safe server and client code
- **Hono** — lightweight HTTP router for trigger, scheduler, menu, and validation endpoints
- **@hono/node-server + @devvit/web/server** — Devvit-compatible server wrapper with `createServer`
- **Redis** — in-app KV store for daily metric hashes, sorted sets for offenders, karma snapshots, last-action timestamps, and daily snapshot keys for rolling averages

---

## Project Impact

- **r/modhelp** — Meta-moderation communities can run ModVitals to surface queue-health trends and help new moderators understand what healthy moderation looks like with real data.
- **r/{growing-subreddit}** — Mod teams scaling from 2 to 10+ moderators need visibility into who is doing the work. ModVitals' leaderboard and inactive-alert features show whether workload is distributed evenly or burning out a single teammate.
- **r/{content-heavy-sub}** — High-volume subreddits with dozens of removals per day benefit from anomaly detection (spike alerts for potential brigading or spam waves) and the repeat-offender section with karma enrichment, making it easy to spot problematic users and the rules they most frequently break.
- **r/{multi-timezone-team}** — Distributed mod teams use the 33 timezone options to schedule reports at a local time that makes sense for their workflow.

---

## Ecosystem Impact Statement

ModVitals is net new to the Devvit ecosystem. While moderation queues and traffic stats are built into Reddit, there is no existing tool that (a) combines real-time trigger data with a heartbeat scheduler and granular frequency presets (hourly through custom cron), (b) persists daily metrics in Redis for period-over-period comparison and 7-day rolling averages, (c) enriches reports with Reddit API data (karma, account age, snoovatar), (d) surfaces workload balance via leaderboard rankings and inactive-mod detection, and (e) posts a formatted, on-subreddit mod-only report — all without leaving the Devvit runtime. The app demonstrates a pattern that other Devvit developers can follow: composing triggers + scheduler + Redis + formatted posts into a self-contained moderation dashboard. The broad appeal spans any subreddit with an active mod team, from hobby communities to large public forums.

---

## Installation Instructions

1. **Install the Devvit CLI** (if you haven't already):

   ```bash
   npm install -g devvit
   ```

2. **Log in to your Reddit developer account:**

   ```bash
   npx devvit login
   ```

3. **Install ModVitals in your subreddit:**

   ```bash
   npx devvit install <your-subreddit>
   ```

   Replace `<your-subreddit>` with the name of the subreddit where you are a moderator (e.g., `npx devvit install mymodsub`).

4. **Configure settings** — After installing, go to your subreddit's **Mod Tools → Installed Apps → ModVitals → Settings** to customize report frequency, generation hour, and which metric sections appear.

---

## Configuration Guide

All settings are managed in the subreddit's **Installed Apps** panel under ModVitals. No code changes required.

### Report Scheduling

| Setting | Type | Default | Description |
|---|---|---|---|
| **Report Frequency** | select | `daily` | `hourly`, `4-hourly`, `12-hourly`, `daily`, `weekly`, or `custom` |
| **Report Hour** | number | `12` | Hour of day (0–23) in the configured timezone for daily/weekly reports. Validated to be an integer in range. |
| **Report Minute** | number | `0` | Minute of hour (0–59) for all frequency presets. Validated to be an integer in range. |
| **Timezone** | select | `0` (UTC) | Timezone offset in minutes. 33 options from UTC-12 to UTC+14. |
| **Custom Cron** | string | `0 12 * * *` | 5-field cron expression when frequency is `custom`. Validated for correct format and field ranges. |

### Metric Toggles

Each toggle controls whether a section appears in the generated report. All default to **On**.

| Toggle | Section in Report | Description |
|---|---|---|
| **Show Post Count** | Overview + Activity Summary | Total post submissions in the period. |
| **Show Comment Count** | Overview + Activity Summary | Total comment submissions in the period. |
| **Show Removal Count** | Overview + Activity Summary | Number of posts/comments removed by moderators (includes spam). |
| **Show Approval Count** | Overview + Activity Summary | Number of posts/comments approved by moderators. |
| **Show Rule Violations** | Rule Violations | Top violated rules with violation counts, ordered by frequency. |
| **Show Repeat Offenders** | Repeat Offenders | Users whose content was removed multiple times, sorted by incident count. |
| **Show Mod Activity** | Mod Activity | Per-moderator action counts and a breakdown of action types (remove, approve, ban, warn, etc.). |

### Enrichment & Advanced Features

| Toggle | Default | Description |
|---|---|---|
| **Show Karma Stats** | ON | Enrich repeat offenders with link karma, comment karma, total karma, account age, snoovatar image, subreddit-specific karma, and period-over-period karma deltas. |
| **Show Leaderboard** | ON | Display ranked top 5 mods by action count with workload percentage and `[Most Active]` badge. |
| **Show Inactive Alerts** | ON | Flag moderators inactive beyond the configurable threshold, showing days-since-last-action. |
| **Inactive Threshold (days)** | 5 | Number of days without action before a moderator is flagged as inactive. Validated to be a positive integer. |
| **Show Anomaly Alerts** | ON | Flag unusual activity spikes (2× above 7-day rolling average) as alerts at the top of the report. Detects potential brigading or spam waves. |
| **Debug Mode** | OFF | Display all current settings values and the resolved effective cron expression at the top of the report for configuration verification. |

### Validation Endpoints

All four settings validators are implemented server-side:

| Validator | Endpoint | Validates |
|---|---|---|
| Report Hour | `/internal/settings/validate-hour` | Integer 0–23 |
| Report Minute | `/internal/settings/validate-minute` | Integer 0–59 |
| Custom Cron | `/internal/settings/validate-cron` | 5-field cron format and field ranges |
| Inactive Threshold | `/internal/settings/validate-threshold` | Positive integer (≥ 1) |

### Trend Indicators

Each numeric metric in the Overview section includes a trend arrow comparing the current period against the previous one:

- **▲ (X% up)** — Metric increased compared to the previous period.
- **▼ (X% down)** — Metric decreased compared to the previous period.
- **➡** — No change.
- **―** — No previous-period data available (first run or missing hash).

---

## Screenshots

The following screenshots should be captured for the submission gallery. High-resolution PNG preferred.

1. **Install Button** — The ModVitals listing in the Devvit app directory or the "Install" button on the app detail page, showing the app name, tagline, and install action.

2. **Settings Panel** — The ModVitals configuration screen within a subreddit's Mod Tools → Installed Apps page, showing the full settings form: Report Frequency dropdown with all 6 options, Report Hour / Report Minute fields, Timezone dropdown with 33 options, Custom Cron field, and all toggle switches (metric sections, karma stats, leaderboard, inactive alerts, anomaly alerts, debug mode). Demonstrates that the app is fully configurable without coding.

3. **Subreddit Overflow Menu** — The three-dot ("...") subreddit menu showing the "Generate Report Now" action available to moderators, demonstrating the on-demand snapshot report feature.

4. **Report Post (Full)** — A full-height screenshot of a generated health report post as it appears in the subreddit (mod-only distinguished view). Should show:
   - **Debug Info** (if enabled): current settings values and effective cron expression
   - **Alerts** section (if anomalies detected): spike warnings with percentages
   - **Overview** section with trend arrows respecting metric toggles
   - **Activity Summary** with removal/approval rates
   - **Rule Violations** with top broken rules
   - **Repeat Offenders** with karma enrichment (karma totals, account age, snoovatar, sub karma, period-over-period deltas)
   - **Mod Leaderboard** with ranked top 5, workload percentages, `[Most Active]` badge, and inactive mod warnings with days-since-last-action

5. **Devvit Logs** — A terminal or console output showing ModVitals trigger invocations, scheduler heartbeat runs (with frequency gate and dedup checks), karma enrichment, anomaly detection computation, and snapshot generation. Example log lines:
   ```
   [trigger:post-submit] post submitted { postId: "t3_abc123", author: "user1" }
   [trigger:mod-action] mod action { action: "removelink", moderator: "mod1", targetUser: "offender1" }
   [scheduler:generate-report] settings loaded { reportFrequency: "daily", ... }
   [scheduler:generate-report] aggregation complete { posts: 15, comments: 42, removals: 8, ... }
   [scheduler:generate-report] karma enrichment complete { usersFetched: 5, successful: 5 }
   [scheduler:generate-report] anomaly detection complete { alertsCount: 1, ... }
   [scheduler:generate-report] completed successfully { postId: "t3_def456", ... }
   ```

---

## Video

The demo video (2:30–3:00 recommended) should walk through the following flow:

1. **Install (5 sec)** — Show the Devvit CLI install command running in a terminal:
   ```bash
   npx devvit install mymodsub
   ```

2. **Configure (20 sec)** — Navigate to the subreddit's Mod Tools → Installed Apps → ModVitals → Settings. Show all 6 reporting presets in the dropdown (hourly through custom cron), browse the 33 timezone options, toggle a few metric switches (posts, comments, rules, offenders, mod activity), toggle enrichment features (karma stats, leaderboard, inactive alerts, anomaly alerts), show the inactive threshold field, and toggle debug mode on. Save settings.

3. **Trigger events (15 sec)** — Switch to a browser window with the subreddit. Submit a post, have a second account comment, and show a moderator removing a post and approving a comment. These actions fire the three ModVitals triggers in real time.

4. **Snapshot Report (10 sec)** — Click the three-dot subreddit menu, select "Generate Report Now." Show the [SNAPSHOT] report appearing immediately, bypassing the schedule.

5. **Scheduled report (10 sec)** — Show the scheduler heartbeat firing (via `devvit logs`), the frequency gate check, dedup guard, aggregation, karma enrichment, anomaly detection, and the report post appearing with the green [M] shield.

6. **Report walkthrough (15 sec)** — Scroll through the full report: Debug Info (config dump + effective cron), Anomaly Alerts (spike flags), Overview with trend arrows, Activity Summary, Rule Violations, Repeat Offenders with karma enrichment (karma totals, account age, snoovatar, sub karma, deltas), Mod Leaderboard (ranked top 5, workload %, [Most Active] badge), Inactive Mod Alerts (days-since-last-action).

7. **Day-over-day comparison (10 sec)** — Show a second report post that includes trend arrows and period-over-period karma deltas, demonstrating the comparison feature.

8. **Wrap (5 sec)** — End with the ModVitals logo/title and a call to action: "Install ModVitals for your subreddit today."

---

*Submission prepared for Devvit Hackathon — May 2026*
