---
name: modvitals
description: Develop ModVitals — Devvit moderation health-report app patterns for Hono server bridging, Redis metrics, report formatting, scheduler gating, and testing
---

# ModVitals Skill

Use this skill when scaffolding or modifying the ModVitals Devvit app. It encodes project-specific patterns that prevent common failures.

## Quick Start

- Install: `npm install`
- Build: `npm run build` (Vite → `dist/client` + `dist/server/index.cjs`). Never use `npx devvit build`.
- Type-check: `npm run type-check` (`tsc --build`, strict)
- Test: `npm test` (6 suites via `npx tsx`, ~426 assertions) or single file `npx tsx src/server/report.test.ts`
- Dev: `npx devvit login` → `npx devvit upload` → `npx devvit install modvitals_test` → `npx devvit logs modvitals_test --since=2m`
- Docs: `npm run docs` (TypeDoc → `docs/api/`)
- Health: `GET /api/health` → `{status:"ok", app:"mod-vitals"}`

## Project Structure

- `src/server/index.ts` — thin re-export (228B)
- `src/server/server.ts` — Hono app assembly, health + 4 validation endpoints (`validate-hour|minute|cron|threshold`), registers triggers/scheduler/snapshot
- `src/server/routes/triggers.ts` — `handlePostSubmit`, `handleCommentCreate`, `handleModAction` (use `REMOVAL_ACTIONS`/`APPROVAL_ACTIONS` Sets)
- `src/server/routes/scheduler.ts` — heartbeat handler: `getSettings()` → `shouldGenerateReport()` → `wasReportGeneratedToday()` / sub-hourly dedup → `generateReport()` → `fetchUsersKarma()` → `storeDailySnapshot()` → `detectAnomalies()` → `formatReport()` → `postReportToSubreddit()`
- `src/server/routes/snapshot.ts` — menu `POST /internal/menu/generate-snapshot` (`skipTimestampUpdate=true`, `[SNAPSHOT]` prefix, toast URL)
- `src/server/metrics.ts` — `KEY` object (9 keys), `getTodayDateKey()`, `incrementCounter()`, `topFromHash()`, Redis CRUD with `console.error` in every catch, dedup helpers, karma/snapshot helpers
- `src/server/date-utils.ts` — pure: `dateKeyToDate`, `dateToDateKey`, `getTodayDateKey`, `getRelativeDateKey`
- `src/server/scheduler-logic.ts` — pure: `parseMetrics`, `computeTrend`, `computeLeaderboard`, `aggregateReport`, `detectAnomalies`, `generateReport`
- `src/server/report.ts` — `formatOverview(settings)` (gates by toggles), `formatActivitySummary`, `formatRuleViolations`, `formatRepeatOffenders` (karma-aware), `formatModActivity` (leaderboard + inactive), `formatAlertsSection`, `formatDebugInfo` (uses `resolveEffectiveCron`)
- `src/server/settings.ts` — `ReportFrequency` (6 values), `ModVitalsSettings` (18 fields), `asBoolean/asNumber/asFrequency/asTimezoneOffset`, `getSettings()`, `resolveEffectiveCron()`, `shouldGenerateReport()`
- `src/server/karma.ts` — `fetchUserKarma` (snoovatar + subKarma `Promise.allSettled`), `formatKarmaDisplay`, pure `formatAccountAge(createdAt, currentDate)`
- `src/server/cron-matcher.ts` — `parseCronField`, `matchCron`, `validateCron`
- `src/server/posting.ts` — `postReportToSubreddit(title, body)` → `submitPost` + `distinguish`+`approve` (warn non-fatal)
- `devvit.json` — triggers 3, scheduler `* * * * *` heartbeat, 18 settings, menu item `Generate Report Now`

## Critical Patterns

### 1. Server Bridging (Redis Context)

`@devvit/web/server` `createServer` must wrap the Hono listener or Redis throws `No context found`.

```ts
import { createServer, getServerPort } from '@devvit/web/server';
import { getRequestListener } from '@hono/node-server';
import app from './server.js';

const requestListener = getRequestListener(app.fetch);
const server = createServer(requestListener);
server.listen(getServerPort());
```

Do **not** use `serve({fetch: app.fetch})` alone.

### 2. Settings Validation Responses

Devvit requires `{success: boolean, error?: string}` with HTTP 200.

```ts
// BAD: c.json({error: "bad"}, 400)
// GOOD:
return c.json({ success: false, error: 'Report Hour must be 0-23' });
return c.json({ success: true });
```

### 3. Scheduler Gating + Dedup

Heartbeat `* * * * *` ticks every minute; gating is runtime:

```ts
const settings = await getSettings();
if (
  !shouldGenerateReport(
    settings.reportFrequency,
    settings.reportHour,
    settings.reportMinute,
    settings.timezoneOffset,
    settings.customCron,
  )
)
  return;
const isSubHourly =
  settings.reportFrequency === 'hourly' ||
  settings.reportFrequency === '4-hourly' ||
  settings.reportFrequency === '12-hourly';
if (isSubHourly) {
  /* throttle by lastReport timestamp <60s */
} else if (await wasReportGeneratedToday()) return;
```

### 4. Redis Keys & Helpers

Use `KEY` constants and `topFromHash()` generic helper. Date keys via `getTodayDateKey()` (delegates to `date-utils`). Never inline `metrics:${dateKey}` strings.

### 5. Report Formatting

`formatReport()` takes `ReportData` + `ModVitalsSettings` + `anomalies` + `debug` flag. Overview respects toggles; use `resolveEffectiveCron(settings)` for debug cron display. Keep formatters pure, test both toggle states.

### 6. Error Handling

Every Redis/Reddit catch logs `console.error` with context and either re-throws or returns typed fallback. `posting.ts` warns (non-fatal) on `distinguish`/`approve`. Never swallow silently.

## Testing

- Co-located `*.test.ts`, run via `npx tsx <file>`. No Vitest/Jest runner.
- Assert pure functions: `parseMetrics`, `computeTrend`, `resolveEffectiveCron`, `matchCron`, `formatAccountAge(pure)`.
- After changes run `npm test` and `npm run type-check` before upload.

## When Modifying

- New setting → add to `devvit.json` + `settings.ts` (`ModVitalsSettings`, `DEFAULT_SETTINGS`, `getSettings()`, validation endpoint if needed) + `resolveEffectiveCron` if it affects scheduling + `report.ts` toggle handling + tests.
- New metric → add `KEY` entry + helpers in `metrics.ts` + aggregate in `scheduler-logic.ts` + section in `report.ts` + tests.
- New route → add handler in `routes/` and register in `server.ts`.
