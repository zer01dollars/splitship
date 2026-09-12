import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildChangelogSection, appendChangelog } from '../src/changelog.js';

describe('appendChangelog', () => {
  it('builds Added/Fixed sections from commits', () => {
    const section = buildChangelogSection({
      tag: 'v1.0.0',
      date: '2026-09-11',
      ctx: {
        commits: [
          { subject: 'feat: new thing' },
          { subject: 'fix: bug' },
        ],
      },
      files: { dev: '' },
    });
    assert.match(section, /## \[v1\.0\.0\] — 2026-09-11/);
    assert.match(section, /### Added/);
    assert.match(section, /feat: new thing/);
    assert.match(section, /### Fixed/);
  });

  it('creates CHANGELOG.md when missing and replaces same tag', () => {
    const dir = join(tmpdir(), `splitship-cl-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const path = appendChangelog({
      tag: 'v0.2.0',
      files: { dev: '## Summary\nShip it\n## Features\n- feat: a\n' },
      ctx: { commits: [{ subject: 'feat: a' }] },
      config: { changelogPath: 'CHANGELOG.md' },
      cwd: dir,
    });
    assert.ok(existsSync(path));
    let text = readFileSync(path, 'utf8');
    assert.match(text, /\[v0\.2\.0\]/);

    appendChangelog({
      tag: 'v0.2.0',
      files: { dev: '' },
      ctx: { commits: [{ subject: 'feat: replaced' }] },
      config: { changelogPath: 'CHANGELOG.md' },
      cwd: dir,
    });
    text = readFileSync(path, 'utf8');
    assert.match(text, /feat: replaced/);
    assert.equal((text.match(/## \[v0\.2\.0\]/g) || []).length, 1);
    rmSync(dir, { recursive: true, force: true });
  });
});
