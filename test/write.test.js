import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeDocuments } from '../src/write.js';

describe('writeDocuments', () => {
  const dir = join(tmpdir(), `splitship-write-${Date.now()}`);

  before(() => mkdirSync(dir, { recursive: true }));
  after(() => rmSync(dir, { recursive: true, force: true }));

  it('writes three markdown files', () => {
    const paths = writeDocuments({
      files: {
        dev: '# dev\n',
        customer: '# customer\n',
        linkedin: '# linkedin\n',
      },
      config: {
        outputDir: dir,
        writeX: false,
        outputs: { dev: 'DEV.md', customer: 'CUSTOMER.md', linkedin: 'LINKEDIN.md' },
      },
      cwd: '/',
    });
    assert.equal(readFileSync(paths.dev, 'utf8'), '# dev\n');
    assert.equal(readFileSync(paths.customer, 'utf8'), '# customer\n');
    assert.equal(readFileSync(paths.linkedin, 'utf8'), '# linkedin\n');
    assert.equal(paths.x, undefined);
  });

  it('writes X.md when writeX is true', () => {
    const sub = join(dir, 'with-x');
    mkdirSync(sub, { recursive: true });
    const paths = writeDocuments({
      files: {
        dev: '# d\n',
        customer: '# c\n',
        linkedin: '# l\n',
        x: 'ship it\n',
      },
      config: {
        outputDir: sub,
        writeX: true,
        outputs: { dev: 'DEV.md', customer: 'CUSTOMER.md', linkedin: 'LINKEDIN.md' },
      },
      cwd: '/',
    });
    assert.ok(paths.x);
    assert.equal(readFileSync(paths.x, 'utf8'), 'ship it\n');
  });

  it('writes X when outputs.x is set even if writeX false', () => {
    const sub = join(dir, 'named-x');
    mkdirSync(sub, { recursive: true });
    const paths = writeDocuments({
      files: {
        dev: '# d\n',
        customer: '# c\n',
        linkedin: '# l\n',
        x: 'tweet\n',
      },
      config: {
        outputDir: sub,
        writeX: false,
        outputs: {
          dev: 'DEV.md',
          customer: 'CUSTOMER.md',
          linkedin: 'LINKEDIN.md',
          x: 'TWITTER.md',
        },
      },
      cwd: '/',
    });
    assert.match(paths.x, /TWITTER\.md$/);
    assert.equal(readFileSync(paths.x, 'utf8'), 'tweet\n');
    assert.equal(existsSync(join(sub, 'X.md')), false);
  });
});
