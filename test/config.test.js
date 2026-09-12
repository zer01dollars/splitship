import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('loads YAML and merges defaults', () => {
    const dir = join(tmpdir(), `splitship-cfg-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, 'splitship.yml');
    writeFileSync(
      path,
      `llm:\n  provider: openai\noutputs:\n  dev: NOTES.md\n`,
      'utf8',
    );
    const prev = process.cwd();
    process.chdir(dir);
    try {
      const cfg = loadConfig({ configPath: 'splitship.yml' });
      assert.equal(cfg.llm.provider, 'openai');
      assert.equal(cfg.outputs.dev, 'NOTES.md');
      assert.equal(cfg.outputs.customer, 'CUSTOMER.md');
    } finally {
      process.chdir(prev);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('input provider overrides file', () => {
    const cfg = loadConfig({
      configPath: 'does-not-exist.yml',
      inputs: { llmProvider: 'anthropic', outputDir: './out' },
    });
    assert.equal(cfg.llm.provider, 'anthropic');
    assert.equal(cfg.outputDir, './out');
  });
});
