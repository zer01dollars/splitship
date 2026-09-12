import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateOffline,
  generateDocuments,
  humanizeSubject,
  resolveProvider,
} from '../src/generate.js';

const fixtureCtx = {
  tag: 'v1.2.0',
  repo: 'widgets',
  owner: 'acme',
  compareUrl: 'https://github.com/acme/widgets/compare/v1.1.0...v1.2.0',
  commits: [
    { sha: 'a1b2c3d', subject: 'feat(api): add bulk export endpoint', author: 'ada' },
    { sha: 'e4f5g6h', subject: 'fix: prevent double-charge on retry', author: 'lin' },
    { sha: 'i7j8k9l', subject: 'feat!: rename webhook payload field', author: 'ada' },
  ],
};

describe('humanizeSubject', () => {
  it('strips conventional prefixes', () => {
    assert.equal(humanizeSubject('feat(api): add bulk export'), 'Add bulk export');
    assert.equal(humanizeSubject('fix: prevent double-charge'), 'Prevent double-charge');
  });
});

describe('resolveProvider', () => {
  it('falls back to offline without keys', () => {
    assert.equal(resolveProvider({ llm: { provider: 'anthropic' } }), 'offline');
    assert.equal(
      resolveProvider({ llm: { provider: 'openai' }, openaiApiKey: 'sk-test' }),
      'openai',
    );
  });
});

describe('generateOffline', () => {
  it('produces all three documents with expected sections', () => {
    const files = generateOffline(fixtureCtx);
    assert.match(files.dev, /Developer Notes — v1\.2\.0/);
    assert.match(files.dev, /Breaking changes/);
    assert.match(files.dev, /feat!: rename/);
    assert.match(files.customer, /What's New — v1\.2\.0/);
    assert.match(files.customer, /Add bulk export endpoint/);
    assert.match(files.linkedin, /v1\.2\.0/);
    assert.match(files.linkedin, /#buildinpublic/);
  });
});

describe('generateDocuments', () => {
  it('uses offline mode by default', async () => {
    const { mode, files } = await generateDocuments(fixtureCtx, {
      llm: { provider: 'offline' },
    });
    assert.equal(mode, 'offline');
    assert.ok(files.dev && files.customer && files.linkedin);
  });
});
