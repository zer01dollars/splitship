import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { run } from '../src/index.js';

describe('run (action orchestration)', () => {
  it('generates files with skip-license and fixture', async () => {
    const dir = join(tmpdir(), `splitship-run-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const outputs = {};
    const result = await run({
      getInput: (name) => {
        const map = {
          'skip-license': 'true',
          'output-dir': dir,
          'llm-provider': 'offline',
          'config-path': 'missing.yml',
          tag: 'v1.2.0',
        };
        return map[name] || '';
      },
      setOutput: (n, v) => {
        outputs[n] = v;
      },
      setFailed: (m) => {
        throw new Error(m);
      },
      info: () => {},
      context: { repo: { owner: 'acme', repo: 'widgets' }, ref: 'refs/tags/v1.2.0' },
      fixture: {
        tag: 'v1.2.0',
        repo: 'widgets',
        commits: [
          { sha: 'abc', subject: 'feat: ship it', author: 'ada' },
          { sha: 'def', subject: 'fix: edge case', author: 'lin' },
        ],
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.mode, 'offline');
    assert.equal(outputs.mode, 'offline');
    assert.match(readFileSync(join(dir, 'DEV.md'), 'utf8'), /v1\.2\.0/);
    assert.match(readFileSync(join(dir, 'CUSTOMER.md'), 'utf8'), /What's New/);
    assert.match(readFileSync(join(dir, 'LINKEDIN.md'), 'utf8'), /shipped/);
    rmSync(dir, { recursive: true, force: true });
  });

  it('fails without license when not skipped', async () => {
    let failed = null;
    delete process.env.SKIP_LICENSE;
    const result = await run({
      getInput: (name) => (name === 'skip-license' ? 'false' : ''),
      setOutput: () => {},
      setFailed: (m) => {
        failed = m;
      },
      info: () => {},
      context: { repo: { owner: 'a', repo: 'b' }, ref: 'refs/tags/v1' },
      fixture: { tag: 'v1', commits: [] },
    });
    assert.equal(result.ok, false);
    assert.match(failed || '', /license/i);
  });
});
