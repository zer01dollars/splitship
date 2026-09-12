import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Build a Keep-a-Changelog-style section from offline/DEV content.
 * @param {object} options
 * @param {string} options.tag
 * @param {{ dev?: string, customer?: string }} options.files
 * @param {import('./gather.js').ReleaseContext} [options.ctx]
 * @param {string} [options.date] ISO date YYYY-MM-DD
 * @returns {string}
 */
export function buildChangelogSection({ tag, files = {}, ctx = null, date } = {}) {
  const day =
    date ||
    new Date().toISOString().slice(0, 10);
  const subjects = (ctx?.commits || []).map((c) => c.subject).filter(Boolean);
  const features = subjects.filter((s) =>
    /^(feat|feature)(\(.+\))?[!]?:/i.test(s),
  );
  const fixes = subjects.filter((s) => /^(fix)(\(.+\))?[!]?:/i.test(s));

  // Prefer structured lists from commits; fall back to a short DEV summary line
  const added =
    features.length > 0
      ? features.map((s) => `- ${s}`)
      : extractBullets(files.dev, 'Features');
  const fixed =
    fixes.length > 0
      ? fixes.map((s) => `- ${s}`)
      : extractBullets(files.dev, 'Fixes');

  const lines = [`## [${tag}] — ${day}`, ''];
  if (added.length) {
    lines.push('### Added', ...added, '');
  }
  if (fixed.length) {
    lines.push('### Fixed', ...fixed, '');
  }
  if (!added.length && !fixed.length) {
    const summary =
      firstSummaryLine(files.dev) ||
      `- Release ${tag}`;
    lines.push('### Changed', `- ${summary.replace(/^[-*]\s*/, '')}`, '');
  }
  return lines.join('\n').trimEnd() + '\n';
}

function extractBullets(md = '', heading = '') {
  if (!md) return [];
  const re = new RegExp(
    `## ${heading}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`,
    'i',
  );
  const m = md.match(re);
  if (!m) return [];
  return m[1]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- ') && !/^-\s*_None/i.test(l));
}

function firstSummaryLine(md = '') {
  const m = md.match(/## Summary\s*\n+([^\n]+)/i);
  return m ? m[1].trim() : '';
}

/**
 * Prepend a changelog section into CHANGELOG.md (or config.changelogPath).
 * Creates the file with a Keep-a-Changelog header if missing.
 * @param {object} options
 * @param {string} options.tag
 * @param {{ dev?: string, customer?: string }} options.files
 * @param {object} options.config
 * @param {import('./gather.js').ReleaseContext} [options.ctx]
 * @param {string} [options.cwd]
 * @returns {string} absolute path written
 */
export function appendChangelog({
  tag,
  files,
  config = {},
  ctx = null,
  cwd = process.cwd(),
} = {}) {
  const rel = config.changelogPath || 'CHANGELOG.md';
  // Spec: CHANGELOG.md at cwd (or config.changelogPath), not under outputDir.
  const target = resolve(cwd, rel);

  const section = buildChangelogSection({ tag, files, ctx });
  let body = '';
  if (existsSync(target)) {
    body = readFileSync(target, 'utf8');
  } else {
    body =
      '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n';
  }

  // Insert after header block: find first ## [ or end of intro
  const inserted = insertSection(body, section, tag);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, inserted, 'utf8');
  return target;
}

/**
 * Replace existing section for the same tag, or prepend after title.
 */
function insertSection(body, section, tag) {
  const tagEsc = String(tag).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sectionRe = new RegExp(
    `## \\[${tagEsc}\\][^\\n]*\\n[\\s\\S]*?(?=\\n## \\[|$)`,
  );
  if (sectionRe.test(body)) {
    return body.replace(sectionRe, section.trimEnd() + '\n\n').replace(/\n{3,}/g, '\n\n');
  }

  // After first H1 + optional intro paragraphs, before first ## [
  const firstRelease = body.search(/\n## \[/);
  if (firstRelease !== -1) {
    return (
      body.slice(0, firstRelease + 1) +
      section.trimEnd() +
      '\n\n' +
      body.slice(firstRelease + 1)
    );
  }
  return body.trimEnd() + '\n\n' + section;
}
