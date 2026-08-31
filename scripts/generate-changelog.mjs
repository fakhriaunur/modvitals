#!/usr/bin/env node
/**
 * Release notes automation — generates CHANGELOG.md from conventional commits.
 * Lightweight alternative to semantic-release / standard-version / release-please
 * that runs in CI and locally via `npm run release:changelog`.
 *
 * Groups commits since the last semver tag into Features / Fixes / Chores / Docs,
 * following Conventional Commits. Falls back to "Unreleased" when no prior tag.
 */
import { execSync } from 'node:child_process';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';

function sh(cmd, fallback = '') {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch {
    return fallback;
  }
}

const lastTag = sh('git describe --tags --abbrev=0 2>nul', '');
const range = lastTag ? `${lastTag}..HEAD` : 'HEAD';
const log = sh(`git log ${range} --pretty=format:"%s%x1e" --no-merges`, '');

const sections = { feat: [], fix: [], chore: [], docs: [], refactor: [], other: [] };

for (const raw of log.split('\x1e')) {
  const firstLine = raw.trim();
  if (!firstLine) continue;
  if (/^feat(\(|:)/i.test(firstLine)) sections.feat.push(firstLine);
  else if (/^fix(\(|:)/i.test(firstLine)) sections.fix.push(firstLine);
  else if (/^chore(\(|:)/i.test(firstLine)) sections.chore.push(firstLine);
  else if (/^docs(\(|:)/i.test(firstLine)) sections.docs.push(firstLine);
  else if (/^refactor(\(|:)/i.test(firstLine)) sections.refactor.push(firstLine);
  else sections.other.push(firstLine);
}

const date = new Date().toISOString().slice(0, 10);
const version = sh('node -p "require(\'./package.json\').version"', '0.1.0');

let md = `# Changelog\n\n`;
md += `All notable changes to ModVitals. Generated from conventional commits.\n\n`;
if (lastTag) md += `## [${version}] — ${date} (since ${lastTag})\n\n`;
else md += `## [${version}] — ${date}\n\n`;

function section(title, items) {
  if (items.length === 0) return '';
  return `### ${title}\n\n${items.map((s) => `- ${s}`).join('\n')}\n\n`;
}

md += section('Features', sections.feat);
md += section('Fixes', sections.fix);
md += section('Refactors', sections.refactor);
md += section('Chores', sections.chore);
md += section('Docs', sections.docs);
if (sections.other.length) md += section('Other', sections.other);

if (Object.values(sections).every((a) => a.length === 0)) {
  md += `No conventional commits found in range \`${range}\`.\n\n`;
}

const changelogPath = 'CHANGELOG.md';
let existing = '';
if (existsSync(changelogPath)) {
  existing = readFileSync(changelogPath, 'utf8');
  // Preserve header, prepend new release notes after first heading
  const headerEnd = existing.indexOf('\n## ');
  if (headerEnd !== -1) {
    md += existing.slice(headerEnd);
  }
}

writeFileSync(changelogPath, md);
console.log(`✓ Changelog written to ${changelogPath} (range: ${range})`);
console.log(md.slice(0, 800));
