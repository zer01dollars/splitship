import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, rmSync, mkdirSync } from 'node:fs';
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
        outputs: { dev: 'DEV.md', customer: 'CUSTOMER.md', linkedin: 'LINKEDIN.md' },
      },
      cwd: '/',
    });
    assert.equal(readFileSync(paths.dev, 'utf8'), '# dev\n');
    assert.equal(readFileSync(paths.customer, 'utf8'), '# customer\n');
    assert.equal(readFileSync(paths.linkedin, 'utf8'), '# linkedin\n');
  });
});
