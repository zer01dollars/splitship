import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { withRetry } from '../src/context/client.js';

describe('context withRetry', () => {
  it('returns on success', async () => {
    const v = await withRetry(async () => 42);
    assert.equal(v, 42);
  });

  it('does not retry 400', async () => {
    let n = 0;
    await assert.rejects(
      () =>
        withRetry(async () => {
          n += 1;
          const e = new Error('bad');
          e.status = 400;
          throw e;
        }),
      /bad/,
    );
    assert.equal(n, 1);
  });
});
