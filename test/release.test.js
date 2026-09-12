import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeCustomerIntoReleaseBody,
  updateReleaseWithCustomer,
  CUSTOMER_START,
} from '../src/release.js';

describe('mergeCustomerIntoReleaseBody', () => {
  it('appends markers when absent', () => {
    const out = mergeCustomerIntoReleaseBody('Hello', '# What\n');
    assert.match(out, /Hello/);
    assert.match(out, /splitship:customer/);
    assert.match(out, /# What/);
  });

  it('replaces existing marked section on re-run', () => {
    const first = mergeCustomerIntoReleaseBody('', 'ONE');
    const second = mergeCustomerIntoReleaseBody(first, 'TWO');
    assert.match(second, /TWO/);
    assert.doesNotMatch(second, /ONE/);
    assert.equal(second.split(CUSTOMER_START).length - 1, 1);
  });
});

describe('updateReleaseWithCustomer', () => {
  it('updates via octokit', async () => {
    let body;
    const octokit = {
      rest: {
        repos: {
          getReleaseByTag: async () => ({ data: { id: 1, body: 'old' } }),
          updateRelease: async (p) => {
            body = p.body;
            return { data: p };
          },
        },
      },
    };
    const r = await updateReleaseWithCustomer({
      octokit,
      owner: 'o',
      repo: 'r',
      tag: 'v1',
      customerMd: 'CUST',
    });
    assert.equal(r.updated, true);
    assert.match(body, /CUST/);
  });
});
