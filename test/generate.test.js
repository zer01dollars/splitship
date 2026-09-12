import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateOffline,
  generateDocuments,
  humanizeSubject,
  resolveProvider,
  buildXPost,
  commitBulletLabel,
  buildPrompt,
  toneCopy,
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
    { sha: 'm0n1o2p', subject: 'chore: bump dependencies', author: 'bot' },
  ],
};

describe('humanizeSubject', () => {
  it('strips conventional prefixes', () => {
    assert.equal(humanizeSubject('feat(api): add bulk export'), 'Add bulk export');
    assert.equal(humanizeSubject('fix: prevent double-charge'), 'Prevent double-charge');
  });
});

describe('commitBulletLabel', () => {
  it('prefers prTitle when present', () => {
    assert.equal(
      commitBulletLabel({
        subject: 'feat: raw',
        prTitle: 'Add bulk export',
        prNumber: 7,
      }),
      'Add bulk export (#7)',
    );
    assert.equal(commitBulletLabel({ subject: 'feat: raw' }), 'feat: raw');
  });
});

describe('toneCopy', () => {
  it('returns technical and friendly variants', () => {
    assert.match(toneCopy('customer', { customer: 'technical' }).customerIntro, /Release notes/i);
    assert.match(toneCopy('customer', { customer: 'friendly' }).customerIntro, /Thanks/i);
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

  it('auto prefers anthropic when both keys present', () => {
    assert.equal(
      resolveProvider({
        llm: { provider: 'auto' },
        anthropicApiKey: 'ak',
        openaiApiKey: 'ok',
      }),
      'anthropic',
    );
    assert.equal(
      resolveProvider({
        llm: { provider: undefined },
        anthropicApiKey: 'ak',
        openaiApiKey: 'ok',
      }),
      'anthropic',
    );
  });

  it('auto picks the only available key', () => {
    assert.equal(
      resolveProvider({ llm: { provider: 'auto' }, openaiApiKey: 'ok' }),
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

  it('always includes an X draft ≤280 chars', () => {
    const files = generateOffline(fixtureCtx);
    assert.ok(files.x);
    assert.ok(files.x.trim().length <= 280);
    assert.match(files.x, /v1\.2\.0/);
  });

  it('respects excludeTypes / excludeSubjects', async () => {
    const { files } = await generateDocuments(fixtureCtx, {
      llm: { provider: 'offline' },
      excludeTypes: ['chore'],
      excludeSubjects: ['rename webhook'],
    });
    assert.doesNotMatch(files.dev, /chore: bump/);
    assert.doesNotMatch(files.dev, /rename webhook/);
    assert.match(files.dev, /bulk export/);
  });

  it('uses prTitle in bullets when present', () => {
    const files = generateOffline({
      ...fixtureCtx,
      commits: [
        {
          sha: 'abc',
          subject: 'feat: raw commit',
          author: 'ada',
          prTitle: 'Ship bulk export API',
          prNumber: 9,
        },
      ],
    });
    assert.match(files.dev, /Ship bulk export API/);
    assert.match(files.customer, /Ship bulk export API/);
  });

  it('applies tone wording for customer channel', () => {
    const friendly = generateOffline(fixtureCtx, {
      tone: { customer: 'friendly', linkedin: 'professional' },
    });
    assert.match(friendly.customer, /Thanks for shipping/);
    const technical = generateOffline(fixtureCtx, {
      tone: { customer: 'technical', linkedin: 'technical' },
    });
    assert.match(technical.customer, /Release notes for/);
  });
});

describe('buildPrompt', () => {
  it('includes tone guidance', () => {
    const p = buildPrompt(fixtureCtx, {
      tone: { dev: 'technical', customer: 'casual', linkedin: 'professional' },
    });
    assert.match(p, /casual/);
    assert.match(p, /technical/);
  });
});

describe('buildXPost', () => {
  it('stays within 280 characters', () => {
    const long = 'x'.repeat(400);
    const post = buildXPost({
      tag: 'v9.9.9',
      repo: 'r',
      subjects: [long],
    });
    assert.ok(post.length <= 280);
  });
});

describe('generateDocuments', () => {
  it('uses offline mode by default', async () => {
    const { mode, files } = await generateDocuments(fixtureCtx, {
      llm: { provider: 'offline' },
    });
    assert.equal(mode, 'offline');
    assert.ok(files.dev && files.customer && files.linkedin && files.x);
  });
});
