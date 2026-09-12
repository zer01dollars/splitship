import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  subjectFromMessage,
  findBreaking,
  gatherReleaseContext,
} from '../src/gather.js';

describe('subjectFromMessage', () => {
  it('takes first line and collapses whitespace', () => {
    assert.equal(subjectFromMessage('feat: hello\n\nbody'), 'feat: hello');
    assert.equal(subjectFromMessage('  a   b  '), 'a b');
  });
});

describe('findBreaking', () => {
  it('detects conventional breaking markers', () => {
    const commits = [
      { subject: 'feat!: rename field' },
      { subject: 'fix: typo' },
      { subject: 'chore: BREAKING CHANGE migrate' },
    ];
    const b = findBreaking(commits);
    assert.equal(b.length, 2);
    assert.ok(b.some((s) => s.includes('feat!')));
  });
});

describe('gatherReleaseContext', () => {
  it('normalizes fixture commits', async () => {
    const ctx = await gatherReleaseContext({
      fixture: {
        tag: 'v1.0.0',
        repo: 'demo',
        commits: [{ sha: 'abc1234', message: 'feat: x\n\ndetail', author: 'a' }],
      },
    });
    assert.equal(ctx.tag, 'v1.0.0');
    assert.equal(ctx.commits.length, 1);
    assert.equal(ctx.commits[0].subject, 'feat: x');
  });

  it('throws without octokit or fixture', async () => {
    await assert.rejects(() => gatherReleaseContext({ tag: 'v1' }), /requires/);
  });
});
