import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
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
          'write-x': 'true',
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
    assert.ok(existsSync(join(dir, 'X.md')));
    assert.ok(outputs['x-path']);
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

  it('appends changelog and writes single-use marker', async () => {
    const dir = join(tmpdir(), `splitship-run-cl-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const prevCwd = process.cwd();
    process.chdir(dir);
    try {
      const result = await run({
        getInput: (name) => {
          const map = {
            'skip-license': 'false',
            'polar-license-key': 'SPLITSHIP-1X-TESTKEY99',
            'output-dir': '.',
            'llm-provider': 'offline',
            'config-path': 'missing.yml',
            'write-x': 'true',
            'append-changelog': 'true',
            tag: 'v2.0.0',
          };
          return map[name] || '';
        },
        setOutput: () => {},
        setFailed: (m) => {
          throw new Error(m);
        },
        info: () => {},
        context: { repo: { owner: 'acme', repo: 'widgets' }, ref: 'refs/tags/v2.0.0' },
        fixture: {
          tag: 'v2.0.0',
          repo: 'widgets',
          commits: [{ sha: 'abc', subject: 'feat: big feature', author: 'ada' }],
        },
      });
      assert.equal(result.ok, true);
      assert.equal(result.license.tier, 'single_use');
      assert.ok(existsSync(join(dir, 'CHANGELOG.md')));
      assert.match(readFileSync(join(dir, 'CHANGELOG.md'), 'utf8'), /\[v2\.0\.0\]/);
      assert.ok(existsSync(join(dir, '.splitship-usage.json')));
      const usage = JSON.parse(readFileSync(join(dir, '.splitship-usage.json'), 'utf8'));
      assert.equal(usage.tier, 'single_use');
    } finally {
      process.chdir(prevCwd);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('updates release body when update-release and octokit provided', async () => {
    const dir = join(tmpdir(), `splitship-run-rel-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    let updatedBody = null;
    const fakeOctokit = {
      rest: {
        repos: {
          getReleaseByTag: async () => ({
            data: { id: 42, body: 'Prior notes\n', tag_name: 'v3.0.0' },
          }),
          updateRelease: async ({ body }) => {
            updatedBody = body;
            return { data: { id: 42, body } };
          },
        },
      },
    };
    const result = await run({
      getInput: (name) => {
        const map = {
          'skip-license': 'true',
          'output-dir': dir,
          'llm-provider': 'offline',
          'config-path': 'missing.yml',
          'write-x': 'false',
          'update-release': 'true',
          'github-token': 'tok',
          tag: 'v3.0.0',
        };
        return map[name] || '';
      },
      setOutput: () => {},
      setFailed: (m) => {
        throw new Error(m);
      },
      info: () => {},
      getOctokit: () => fakeOctokit,
      context: { repo: { owner: 'acme', repo: 'widgets' }, ref: 'refs/tags/v3.0.0' },
      fixture: {
        tag: 'v3.0.0',
        repo: 'widgets',
        commits: [{ sha: 'a', subject: 'feat: release update', author: 'ada' }],
      },
    });
    // fixture path skips octokit for gather; update-release needs octokit from token
    assert.equal(result.ok, true);
    assert.ok(result.releaseUpdate?.updated);
    assert.match(updatedBody, /splitship:customer/);
    assert.match(updatedBody, /What's New/);
    rmSync(dir, { recursive: true, force: true });
  });
});
