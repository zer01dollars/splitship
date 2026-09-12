import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { conventionalType, filterCommits } from '../src/filter.js';

describe('filterCommits', () => {
  const commits = [
    { subject: 'feat: a' },
    { subject: 'chore: b' },
    { subject: 'ci: pipeline' },
    { subject: 'fix: c' },
    { subject: 'docs: ignore me please' },
  ];

  it('filters by excludeTypes', () => {
    const out = filterCommits(commits, { excludeTypes: ['chore', 'ci'] });
    assert.equal(out.length, 3);
    assert.ok(out.every((c) => !/^(chore|ci):/.test(c.subject)));
  });

  it('filters by excludeSubjects regex', () => {
    const out = filterCommits(commits, { excludeSubjects: ['ignore me'] });
    assert.equal(out.length, 4);
    assert.ok(!out.some((c) => /ignore me/.test(c.subject)));
  });

  it('conventionalType parses type', () => {
    assert.equal(conventionalType('feat(api)!: x'), 'feat');
    assert.equal(conventionalType('hello world'), null);
  });
});
