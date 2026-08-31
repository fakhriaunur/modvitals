# AGENTS.md — ModVitals

Guidance for autonomous agents (and humans) working on this Devvit mod-tool. See https://docs.factory.ai/factory-docs/agents-md for the AGENTS.md standard.

## Project Overview

ModVitals is a Reddit Devvit app (Hono + TypeScript + Vite + Devvit-managed Redis) that watches subreddit events, aggregates moderation metrics, and posts a daily health report. Key components: trigger handlers (`onPostSubmit`, `onCommentCreate`, `onModAction`), Redis hash/sorted-set store, heartbeat cron scheduler (`* * * * *`), report formatter, and mod-configurable settings UI.

## Prerequisites

- **Node.js** `22.22.2` pinned via `mise.toml` `[tools] node = "22.22.2"` (also declared as `engines.node >=22.2.0` in `package.json`, vite 8 requires `>=22.12`)
- **Task runner:** `mise` (https://mise.jdx.dev) — unified toolchain + tasks via `mise.toml` (`mise trust && mise install`). Optional but canonical; `npm` shims (`npm run build` → `mise run build`) remain for compatibility.
- **Package manager:** `npm` `10.9.7` (`packageManager` in `package.json`, lockfile `package-lock.json`)
- **Devvit CLI:** `npm install -g devvit` then `npx devvit login` (OAuth, interactive — pipe `echo "\`r"` for non-interactive shells)
- **Reddit account** with moderator permissions on a test subreddit (default `modvitals_dev` in `devvit.json`)

Verify toolchain:

```bash
mise --version       # mise task runner
mise ls              # should show node 22.22.2
node -v              # 22.22.2 (via mise) or >=22.2.0
npm -v               # 10.9.7
npx devvit --version
npx tsc --version
mise tasks ls        # lists 18+ tasks from mise.toml + mise-tasks/*
```

## Setup

```bash
# Clone and install (mise path — canonical)
git clone https://github.com/fakhriaunur/modvitals.git
cd modvitals
mise trust           # trust mise.toml (once per clone; required for mise install)
mise install         # installs node 22.22.2 per mise.toml [tools]
npm install          # install deps (npm ci in CI)

# Alternative without mise (still works via shims)
npm install

# Configure environment (optional, for local overrides)
cp .env.example .env
# .env is gitignored; do not commit secrets. .env.example is the template.
```

No `docker-compose` is needed — Redis is Devvit-managed in production; locally the Devvit CLI proxies it.

## Build

```bash
mise run build       # or npm run build (shim → mise run build): Vite → dist/
mise run type-check  # or npm run type-check: tsc --build (strict)
mise run build:timed # timed build → dist/build-metrics.json
mise run build:analyze # ANALYZE=1 → dist/stats.html
```

Build output: `dist/client/` (inline HTML entry) and `dist/server/index.cjs` (Hono handler). `npx devvit build` is **not** a command — use `mise run build`.

## Test

Tests are plain TypeScript executed via `tsx` (no Jest/Vitest runner needed).

```bash
mise run test        # or npm test (shim): runs all 7 suites sequentially
mise run test:timed  # per-suite timing
npx tsx src/server/report.test.ts  # single suite
```

- Suite count: 7 files, ~452 assertions
- Naming: `*.test.ts` colocated with source in `src/server/`
- No watch mode in CI; add `--watch` manually for local iteration
- Via mise: `mise tasks ls` shows `test`, `test:timed`, `quality`, `ci`

## Development Workflow

```bash
mise run dev         # or npm run dev: devvit playtest (hot reload + tunnel)
npx devvit upload    # bundle and upload to Reddit (auto-bumps internal version)
npx devvit install <subreddit>   # install uploaded build (no r/ prefix)
npx devvit logs <subreddit> --since=2m   # stream structured logs

# Or via mise:
mise run deploy      # type-check && devvit upload
mise run launch      # deploy && devvit publish

# Manual verification after settings/scheduler changes:
echo "`r" | npx devvit upload
echo "`r" | npx devvit install modvitals_test
npx devvit logs modvitals_test --since=1m
```

- Scheduler is heartbeat cron `* * * * *`; runtime gating is in `src/server/settings.ts:shouldGenerateReport()` + dedup `wasReportGeneratedToday()` in `metrics.ts`. Changing `devvit.json` cron requires re-upload; changing settings (frequency/hour/timezone) is runtime-configurable via mod panel.
- Menu action `Generate Report Now` (`/internal/menu/generate-snapshot` in `src/server/routes/snapshot.ts`) bypasses gating for manual QA.
- Health check: `GET /api/health` → `{status:"ok", app:"mod-vitals"}` (see `src/server/server.ts`).

## Project Structure

```
mise.toml                # unified toolchain [tools] + tasks [tasks.*] + hybrid file-tasks
mise-tasks/              # file-tasks for heavy scripts (build-timed, test-timed, generate-changelog)
  build-timed            # → node scripts/build-timed.mjs (sources/outputs)
  test-timed
  generate-changelog
src/
  client/                # (inline) minimal client, bundled by Vite
  server/
    index.ts             # thin re-export of app (228B)
    server.ts            # Hono app, health + validation endpoints, createServer+getRequestListener bridge
    routes/
      triggers.ts        # handlePostSubmit/CommentCreate/ModAction (Sets REMOVAL/APPROVAL)
      scheduler.ts       # generate-report: settings→gating→aggregate→karma→anomaly→format→post
      snapshot.ts        # on-demand snapshot (skipTimestampUpdate, [SNAPSHOT] prefix, toast URL)
    metrics.ts           # KEY constants, getTodayDateKey, incrementCounter, topFromHash, Redis CRUD
    date-utils.ts        # pure dateKey helpers (dateKeyToDate, getTodayDateKey, etc.)
    scheduler-logic.ts   # pure: parseMetrics, computeTrend, computeLeaderboard, detectAnomalies, generateReport
    report.ts            # formatOverview/ActivitySummary/RuleViolations/RepeatOffenders/ModActivity/Alerts/DebugInfo
    karma.ts             # fetchUserKarma (snoovatar+subKarma allSettled), formatting helpers
    cron-matcher.ts      # parseCronField, matchCron, validateCron
    settings.ts          # ReportFrequency, ModVitalsSettings, asBoolean/Number/Frequency, resolveEffectiveCron, shouldGenerateReport
    posting.ts           # postReportToSubreddit (submitPost → distinguish+approve)
docs/
  SUBMISSION.md, VIDEO_SCRIPT.md, DEVPOST_SUBMISSION.md, api/ (generated by TypeDoc)
.devcontainer/devcontainer.json  # mise feature + postCreate: mise trust && mise install
.factory/skills/modvitals/SKILL.md
```

## Conventions

- **Language & strictness:** TypeScript `strict:true` (`tsconfig.server.json` targets ESNext, bundler resolution, noEmit type-check only). Do not add `// @ts-nocheck`.
- **Server pattern (critical):** Always bridge Hono through Devvit context:

  ```ts
  import { createServer, getServerPort } from '@devvit/web/server';
  import { getRequestListener } from '@hono/node-server';
  const requestListener = getRequestListener(app.fetch);
  const server = createServer(requestListener);
  server.listen(getServerPort());
  ```

  Using `serve({fetch:app.fetch})` alone loses Redis context (`No context found`).

- **Redis keys:** Use `KEY` constants in `metrics.ts` (`metrics:YYYYMMDD`, `mods:`, `modActions:`, `rules:`, `offenders`, `karma:`, `snapshots:`, `lastReport`, `modLastAction`). New keys must be added there — do not inline strings.

- **Error handling (Crash Early / No Broken Windows):** Every Redis/Reddit call wraps `catch` with `console.error` (or `console.warn` for non-fatal distinguish/approve) and re-throws or returns typed error. Do not swallow errors silently.

- **Pure vs. effectful:** Keep `scheduler-logic.ts`, `report.ts`, `date-utils.ts`, `cron-matcher.ts`, `karma.ts` formatting helpers pure and unit-tested; keep I/O (Redis/Reddit) in `metrics.ts`, `posting.ts`, `routes/`.

- **DRY:** Use `topFromHash`, `date-utils` helpers, `REMOVAL_ACTIONS`/`APPROVAL_ACTIONS` Sets, and `REPORT_TOP_N` constant. Add new shared helpers rather than copy-paste.

- **Naming:** `camelCase` for functions/vars, `PascalCase` for types/interfaces, `SCREAMING_SNAKE` for constants (`KEY`, `REPORT_TOP_N`), `kebab-case` for files. Settings fields are `reportFrequency`, `reportHour`, `showPosts`, etc. — match `devvit.json` keys.

- **Validation:** Settings validation endpoints (`/internal/settings/validate-hour|minute|cron|threshold`) must return `{success: boolean, error?: string}` with HTTP 200 per Devvit spec — do not return 400 `{error}`.

- **Commits:** Conventional prefixes (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`) + `Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>` for agent work.

## Code Quality & Style

All 9 code-quality signals are enforced via local tooling and CI (`.github/workflows/quality.yml`).

```bash
mise run lint         # or npm run lint: eslint . (flat config, typescript-eslint)
mise run lint:fix     # or npm run lint:fix: eslint --fix
mise run format       # or npm run format: prettier --write
mise run format:check # or npm run format:check: prettier --check (CI)
mise run knip         # dead-code detection (knip)
mise run jscpd        # duplicate-code detection (threshold 5%)
mise run quality      # or npm run quality: lint + format:check + knip + jscpd
mise tasks ls         # list all tasks (via mise.toml)
```

- **Linter:** `eslint.config.js` (flat config, `typescript-eslint` + `@eslint/js`). Rules include `@typescript-eslint/naming-convention` (camelCase/PascalCase/UPPER_CASE), `complexity` (max 30), `max-lines` (600), `max-lines-per-function` (150), `no-unused-vars` (allow `^_`), `no-warning-comments` (warn on bare `TODO`/`FIXME`). Run `npm run lint:fix` before committing.
- **Formatter:** `prettier` with `.prettierrc` (semi, singleQuote, printWidth 100, trailingComma all) and `.prettierignore`. CI fails if `npm run format:check` fails. Editor: format on save via `esbenp.prettier-vscode`.
- **Pre-commit hooks:** `husky` + `lint-staged` (`.husky/pre-commit`). On `git commit`: `eslint --fix` + `prettier --write` on staged files, plus large-file guard (>512KB blocked, >500 lines warned, `*.png` etc. exempt via `.gitattributes` LFS). Install hooks via `npm install` (runs `husky` prepare).
- **Naming:** Enforced by `@typescript-eslint/naming-convention` in `eslint.config.js` and documented here (camelCase functions/vars, PascalCase types, SCREAMING_SNAKE constants, kebab-case files).
- **Complexity:** Tracked via ESLint `complexity`, `max-depth`, `max-nested-callbacks` (warn). Keep functions under 30 branches; split `formatActivitySummary`/`formatReport` if growing.
- **Large files:** Prevented via ESLint `max-lines`, Husky size guard, CI `large-file` job, and `.gitattributes` LFS for `*.png/*.jpg/*.mp4/*.zip`. Never commit `dist/` or `node_modules/`.
- **Dead code:** `knip.json` (entry `src/server/index.ts`, project `src/**/*.ts`) — run `npm run knip:check` locally; CI job `dead-code` warns on unused exports. Ignore false positives from Hono registration via `ignoreDependencies`.
- **Duplicate code:** `.jscpd.json` (threshold 5, `minLines 5/minTokens 50`, ignore tests/dist) — run `npm run jscpd`; CI job `duplicate-code` fails if clones exceed threshold. Current baseline 1.5% duplication (3 clones between scheduler/snapshot).
- **Tech debt:** `no-warning-comments` warns on bare `TODO`/`FIXME` (use `TODO(JIRA-123)`), plus CI `tech-debt` job scans `src/**` for bare markers and flags them. Track debt in `knip`/`jscpd` reports, not bare TODOs.

Config files: `eslint.config.js`, `.prettierrc`, `.prettierignore`, `knip.json`, `.jscpd.json`, `.gitattributes`, `.husky/pre-commit`.

## Toolchain & Task Runner (mise)

Unified via `mise.toml` (`[tools]` + `[tasks.*]` + `mise-tasks/*` file-tasks).

```bash
mise trust             # trust mise.toml (once per clone)
mise install           # installs node 22.22.2 (pinned, 1A — vite 8 ≥22.12)
mise tasks ls          # list 18 tasks
mise run build         # or npm run build (shim → mise run build) — 4A thin shims
mise run ci            # type-check + build:timed + test:timed
mise run quality       # lint + format:check + knip:check + jscpd
mise run test          # 7 suites, 452 assertions
mise tasks deps ci     # dependency graph
```

- **Toolchain (1A + 2A):** `mise.toml [tools] node="22.22.2"` + `packageManager: npm@10.9.7` (no pnpm migration, vite 8 ≥22.12). `idiomatic_version_file_enable_tools = ["node"]` respects `package.json:engines`. Devcontainer adds `ghcr.io/jdx/mise:1` feature + `postCreateCommand: mise trust && mise install`.
- **Tasks (3B Hybrid):** Lean tasks in `mise.toml` (`build`, `lint`, `type-check`, `test`, `quality`, `ci`, etc.) with `sources`/`outputs` for incremental skip; heavy `scripts/*.mjs` wrapped as file-tasks in `mise-tasks/` (`build-timed`, `test-timed`, `generate-changelog`) via `task_config.includes = ["mise-tasks/*"]`.
- **Shims (4A):** `package.json:scripts` are thin `mise run <task>` shims — both `npm run build` and `mise run build` work; `mise` is canonical.
- **CI:** All 5 workflows use `jdx/mise-action@v2` → `mise trust && mise install` → `mise run <task>` (replaces `actions/setup-node@v4`). Cache: mise toolchain + npm + Vite `.vite`/`dist`.

## Build & Release Automation

All 9 build/release signals are enforced via CI and local scripts (`.github/workflows/ci.yml`, `deploy.yml`, `release.yml`, `pr-review.yml`).

```bash
mise run build:timed   # or npm run build:timed: Vite build with duration → dist/build-metrics.json
mise run build:analyze # or npm run build:analyze: ANALYZE=1 → rollup-plugin-visualizer → dist/stats.html
mise run test:timed    # or npm run test:timed: per-suite timing (test_performance_tracking)
mise run size          # or npm run size: size-limit (heavy_dependency_detection)
mise run knip:check && npx depcheck --config .depcheckrc  # unused deps
mise run release:changelog # or npm run release:changelog: conventional commits → CHANGELOG.md
```

- **Fast CI (<10 min):** `ci.yml` `build-and-test` (`jdx/mise-action@v2` + `mise trust` + `mise install` + `actions/cache` Vite, `concurrency: cancel-in-progress`, `timeout-minutes: 10`). Separate `knip`/`size` jobs parallelize. `quality.yml` adds lint/format/knip/jscpd matrix. Target <6 min on cache hit.
- **Build performance:** `scripts/build-timed.mjs` also exposed as `mise run build:timed` / file-task `mise-tasks/build-timed` writes `dist/build-metrics.json` (`durationMs`, `artifacts`, `nodeVersion`); `vite.config.ts` `reportCompressedSize` + `chunkSizeWarningLimit: 500` + `ci.yml` posts metrics to Step Summary. Cache keys: `vite-${os}-${hash(package-lock.json,vite.config.ts,src/**)}` + mise toolchain cache.
- **Deploy frequency:** `deploy.yml` `on: push: branches: [main]` + `workflow_dispatch`, `environment: production`, `jdx/mise-action` + `mise run build:timed` → `mise run size:check` → auto `devvit upload` when `DEVVIT_TOKEN` secret present else artifact upload. Found via `ls .github/workflows/ | grep -i deploy` and `gh run list --workflow=deploy.yml`.
- **Feature flags:** `src/server/feature-flags.ts` — custom system (covers LaunchDarkly/Statsig/Unleash/GrowthBook strings) with 6 flags, Redis `flags:<key>` overrides, `hash(subredditId) % 100` rollout, `isFeatureEnabled(key, subredditId)`, `setFlagOverride`/`clearFlagOverride`/`listFlags`. Gated in `routes/scheduler.ts` & `routes/snapshot.ts` ( karma + anomaly). Add new flag to `FLAG_DEFINITIONS` and wrap code in `if (await isFeatureEnabled('myFlag'))`.
- **Release notes:** `release.yml` runs `googleapis/release-please-action@v4` (`release-please-config.json` + `.release-please-manifest.json` → conventional commits → `CHANGELOG.md` → release PR) and `scripts/generate-changelog.mjs` (`mise run release:changelog` + file-task `mise-tasks/generate-changelog` → groups feat/fix/refactor/chore/docs → `CHANGELOG.md`; also `gh release create --generate-notes` on dispatch).
- **Heavy deps:** `rollup-plugin-visualizer` in `vite.config.ts` (`ANALYZE=1` → `dist/stats.html` treemap gzip/brotli, also `mise run build:analyze`) + `size-limit` in `package.json` (`dist/server/index.cjs` 3 MB) + `ci.yml` `size` job (`mise run size:check || warn` + `mise run build:analyze`). Dependency `rollup-plugin-visualizer@6` + `@size-limit/preset-small-lib`.
- **Unused deps:** `knip.json` + `.depcheckrc` (ignores `@devvit/*`, `hono`, `vite`, `rollup-plugin-visualizer` etc.) + `ci.yml` `knip` job (`mise run knip:check` + `npx depcheck --config .depcheckrc`). Run `npx depcheck` locally; fix via `npm uninstall`.
- **Release automation:** `deploy.yml` (CD on merge to main) + `release.yml` (release-please → GitHub Release). Both count via `gh release list --limit 30` and `gh run list --workflow=deploy.yml`. Changelog committed; tags `v*` via release-please.
- **PR review:** `pr-review.yml` on `pull_request` (opened/synchronize/reopened) collects `type-check`/`lint`/`test`/`knip`/`build` exits via `mise run`, posts/updates a single comment via `actions/github-script` with status table + collapsible logs, marker `<!-- automated-pr-review:modvitals -->`. Satisfies `gh pr list --json reviews,comments` bot detection (danger.js / droid exec / custom comments).

To enable live deploys, set `DEVVIT_TOKEN` in repo secrets (Settings → Secrets → Actions). Release PRs appear automatically when conventional commits land on `main`.

## Modifying Settings / Scheduler

- Add new settings in `devvit.json` (`settings.subreddit.*`) and mirror them in `settings.ts` (`ModVitalsSettings`, `DEFAULT_SETTINGS`, `getSettings()`). Wire validation endpoints in `server.ts` if needed.
- Update `resolveEffectiveCron()` to map presets to cron strings; show resolved cron in `formatDebugInfo()` (`report.ts`).
- Gate new metrics behind toggles in `report.ts:formatReport()` and test both enabled/disabled paths.

## Documentation Generation

```bash
mise run docs           # or npm run docs: TypeDoc → docs/api/
mise run docs:generate  # alias, also used by CI (docs.yml via jdx/mise-action)
```

Config: `typedoc.json`. CI workflow `.github/workflows/docs.yml` (`jdx/mise-action` + `mise run docs:generate`) regenerates `docs/api/` on pushes to `main` and uploads as artifact.

## Skills

Agent skill at `.factory/skills/modvitals/SKILL.md` (and copied to `.claude/skills/` for Claude Code) documents full Devvit patterns; load it when scaffolding new routes or report sections.

## Common Pitfalls

- `npx devvit build` does not exist — use `mise run build` (or `npm run build` shim).
- `version` field in `devvit.json` is not allowed; Devvit auto-bumps on `upload`.
- `@devvit/redis` is not standalone — use `redis` from `@devvit/web/server` inside `createServer` context.
- Heartbeat cron `* * * * *` is intentional; do not revert to `0 12 * * *` without updating gating logic and dedup guards.
- OAuth is interactive; in automation pipe newline: `echo "\`r" | npx devvit login`.
- `mise.toml` trust: first clone needs `mise trust` before `mise install` (otherwise `mise WARN … is not trusted`). CI and devcontainer do this automatically (`mise trust && mise install`).
- `trusted_config_paths` in `mise.toml` is ignored for project configs — use `mise trust` instead.
