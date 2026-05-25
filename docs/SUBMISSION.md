# Devpost Submission — ModVitals

---

## Project Name

ModVitals

---

## Tagline

Automated daily health reports for subreddit moderators

---

## Description

Moderating a growing subreddit is a firehose: posts, comments, reports, modmail, bans. Trends that matter — a spike in removals, a single mod doing all the work, the same user getting warned for the third time — get buried in the noise. ModVitals is a Devvit app that watches your subreddit in real time and turns that firehose into a single daily snapshot so you and your team know what's happening without having to dig.

Three layers run under the hood. **Event triggers** (post submit, comment create, mod action) fire instantly through Devvit's webhook system and write counters to Redis. **A cron scheduler** (configurable daily or weekly) aggregates those counters into typed metrics objects: submission volumes, removal/approval rates, rule-violation tallies, per-mod action counts, and repeat-offender scores. **A report formatter** then composes each metric block into a clean Markdown post that the app submits as a distinguished, approved mod post in your subreddit — visible only to the moderator team, always in the same place.

Configuration is entirely in-subreddit via Devvit's settings panel: toggle which metric sections appear, pick daily or weekly frequency, set the generation hour (UTC). The report itself includes trend arrows (▲ up, ▼ down, ➡ flat) comparing the current period against the previous one, so you can see at a glance whether removals are climbing or approvals have dropped off. Every data point is storable and comparable because each day's metrics live in a date-keyed Redis hash, making the system both ephemeral (no external database) and durable (data persists across restarts).

---

## Category

Best New Mod Tool

---

## Built With

- **Devvit** — Reddit's app platform for triggers, scheduler, settings, Redis, and posting
- **TypeScript** — type-safe server and client code
- **Hono** — lightweight HTTP router for trigger and scheduler endpoints
- **Redis** — in-app KV store for daily metric hashes, sorted sets for offenders, and last-report timestamps

---

## Project Impact

- **r/modhelp** — Meta-moderation communities can run ModVitals to surface queue-health trends and help new moderators understand what healthy moderation looks like with real data.
- **r/{growing-subreddit}** — Mod teams scaling from 2 to 10+ moderators need visibility into who is doing the work. ModVitals' per-mod activity breakdown shows whether workload is distributed evenly or burning out a single teammate.
- **r/{content-heavy-sub}** — High-volume subreddits with dozens of removals per day benefit from the repeat-offender and top-violated-rules sections, making it easy to spot problematic users and the rules they most frequently break.

---

## Ecosystem Impact Statement

ModVitals is net new to the Devvit ecosystem. While moderation queues and traffic stats are built into Reddit, there is no existing tool that (a) combines real-time trigger data with a scheduled cron aggregation, (b) persists daily metrics in Redis for period-over-period comparison, and (c) posts a formatted, on-subreddit mod-only report — all without leaving the Devvit runtime. The app demonstrates a pattern that other Devvit developers can follow: composing triggers + scheduler + Redis + formatted posts into a self-contained moderation dashboard. The broad appeal spans any subreddit with an active mod team, from hobby communities to large public forums.

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

### Report Frequency

| Setting | Values | Default | Description |
|---|---|---|---|
| **Report Frequency** | `Daily`, `Weekly` | `Daily` | How often the health report is generated. Weekly reports are posted every Monday. |
| **Report Time (UTC)** | `0`–`23` | `12` (noon UTC) | Hour of the day when the scheduled report job runs. Validated to be an integer in range. |

### Metric Toggles

Each toggle controls whether a section appears in the generated report. All default to **On**.

| Toggle | Section in Report | Description |
|---|---|---|
| **Show Post Count** | Activity Summary | Total post submissions in the period. |
| **Show Comment Count** | Activity Summary | Total comment submissions in the period. |
| **Show Removal Count** | Overview + Activity Summary | Number of posts/comments removed by moderators (includes spam). |
| **Show Approval Count** | Overview + Activity Summary | Number of posts/comments approved by moderators. |
| **Show Rule Violations** | Rule Violations | Top violated rules with violation counts, ordered by frequency. |
| **Show Repeat Offenders** | Repeat Offenders | Users whose content was removed multiple times, sorted by incident count. |
| **Show Mod Activity** | Mod Activity | Per-moderator action counts and a breakdown of action types (remove, approve, ban, warn, etc.). |

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

2. **Settings Panel** — The ModVitals configuration screen within a subreddit's Mod Tools → Installed Apps page, showing all toggles (Show Post Count, Show Comment Count, etc.) and the Report Frequency / Report Time dropdowns. Demonstrates that the app is configurable without coding.

3. **Report Post** — A full-height screenshot of a generated health report post as it appears in the subreddit (mod-only distinguished view). Should show the Overview section with trend arrows, the Activity Summary with removal/approval rates, the top violated rules, repeat offenders, and the mod activity breakdown.

4. **Devvit Logs** — A terminal or console output showing ModVitals trigger invocations and scheduler runs, demonstrating that the app is actively processing events and generating reports. Example log lines:
   ```
   [trigger:post-submit] post submitted { postId: "t3_abc123", author: "user1" }
   [trigger:mod-action] mod action { action: "removelink", moderator: "mod1", targetUser: "offender1" }
   [scheduler:generate-report] aggregation complete { posts: 15, comments: 42, removals: 8, ... }
   [scheduler:generate-report] post submitted { postId: "t3_def456", postTitle: "ModVitals Health Report — May 24, 2026" }
   ```

---

## Video

The demo video (60–90 seconds recommended) should walk through the following flow:

1. **Install (5 sec)** — Show the Devvit CLI install command running in a terminal:
   ```bash
   npx devvit install mymodsub
   ```

2. **Configure (10 sec)** — Navigate to the subreddit's Mod Tools → Installed Apps → ModVitals → Settings. Toggle a few metric switches off and back on, change the report frequency dropdown to "Weekly" then back to "Daily."

3. **Trigger events (15 sec)** — Switch to a browser window with the subreddit. Submit a post, have a second account comment, and show a moderator removing a post and approving a comment. These actions fire the three ModVitals triggers in real time.

4. **Scheduled report fires (10 sec)** — Optionally show the Devvit scheduler firing (via `devvit logs` or a forced trigger), or cut to the cron job executing and the aggregation completing in the logs.

5. **Report post appears (10 sec)** — Show the generated health report post in the subreddit, distinguished with the green [M] shield. Scroll through the sections: Overview with trend arrows, Activity Summary, Rule Violations, Repeat Offenders, Mod Activity.

6. **Day-over-day comparison (10 sec)** — Show a second report post (generated on a different day) that includes trend arrows pointing up or down, demonstrating the period-over-period comparison feature.

7. **Wrap (5 sec)** — End with the ModVitals logo/title and a call to action: "Install ModVitals for your subreddit today."

---

*Submission prepared for Devvit Hackathon — May 2026*
