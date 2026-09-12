import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  subjectFromMessage,
  findBreaking,
  gatherReleaseContext,
  isMergeCommit,
  filterExcludedPaths,
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

describe('isMergeCommit / filterExcludedPaths', () => {
  it('detects merge by subject and parents', () => {
    assert.equal(isMergeCommit({ subject: 'Merge branch main' }), true);
    assert.equal(isMergeCommit({ subject: 'feat: x', parents: ['a', 'b'] }), true);
    assert.equal(isMergeCommit({ subject: 'feat: x', parents: ['a'] }), false);
  });

  it('drops commits that only touch excluded paths', () => {
    const commits = [
      { subject: 'chore: lock', files: ['package-lock.json'] },
      { subject: 'feat: api', files: ['src/api.js', 'docs/README.md'] },
      { subject: 'docs: keep', files: undefined },
    ];
    const filtered = filterExcludedPaths(commits, ['package-lock.json', 'node_modules/']);
    assert.equal(filtered.length, 2);
    assert.ok(filtered.some((c) => c.subject.includes('feat')));
    assert.ok(filtered.some((c) => c.subject.includes('docs')));
  });
});

describe('gatherReleaseContext', () => {
  it('normalizes fixture commits and skips merges', async () => {
    const ctx = await gatherReleaseContext({
      fixture: {
        tag: 'v1.0.0',
        repo: 'demo',
        commits: [
          { sha: 'abc1234', message: 'feat: x\n\ndetail', author: 'a' },
          { sha: 'def5678', message: 'Merge pull request #1', author: 'bot' },
          {
            sha: 'aaa1111',
            message: 'chore: deps',
            author: 'bot',
            parents: ['1', '2'],
          },
        ],
      },
    });
    assert.equal(ctx.tag, 'v1.0.0');
    assert.equal(ctx.commits.length, 1);
    assert.equal(ctx.commits[0].subject, 'feat: x');
  });

  it('applies excludePaths on fixture when files present', async () => {
    const ctx = await gatherReleaseContext({
      fixture: {
        tag: 'v1.0.0',
        commits: [
          { sha: 'a', subject: 'chore: lock', files: ['yarn.lock'] },
          { sha: 'b', subject: 'feat: real', files: ['src/a.js'] },
        ],
      },
      excludePaths: ['yarn.lock'],
    });
    assert.equal(ctx.commits.length, 1);
    assert.equal(ctx.commits[0].subject, 'feat: real');
  });

  it('enriches with associated PRs via octokit', async () => {
    const octokit = {
      rest: {
        repos: {
          listReleases: async () => ({ data: [{ tag_name: 'v0.9.0' }] }),
          compareCommits: async () => ({
            data: {
              commits: [
                {
                  sha: 'abcdef0123456789',
                  commit: { message: 'feat: from pr\n', author: { name: 'ada' } },
                  parents: [{ sha: '111' }],
                  author: { login: 'ada' },
                },
              ],
            },
          }),
          listPullRequestsAssociatedWithCommit: async () => ({
            data: [
              {
                title: 'Add bulk export',
                number: 42,
                html_url: 'https://github.com/acme/demo/pull/42',
              },
            ],
          }),
        },
      },
    };
    const ctx = await gatherReleaseContext({
      octokit,
      owner: 'acme',
      repo: 'demo',
      tag: 'v1.0.0',
    });
    assert.equal(ctx.commits.length, 1);
    assert.equal(ctx.commits[0].prTitle, 'Add bulk export');
    assert.equal(ctx.commits[0].prNumber, 42);
  });

  it('throws without octokit or fixture', async () => {
    await assert.rejects(() => gatherReleaseContext({ tag: 'v1' }), /requires/);
  });
});
