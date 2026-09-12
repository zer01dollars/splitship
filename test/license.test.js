import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  validateLicense,
  detectTier,
  writeUsageMarker,
  DEFAULT_POLAR_ORG_ID,
  SINGLE_USE_BENEFIT_ID,
} from '../src/license.js';

const REAL_ORG = 'b6303f05-be1c-4b45-b847-5979667a3d12';

describe('validateLicense', () => {
  const prev = process.env.SKIP_LICENSE;
  const prevTier = process.env.SPLITSHIP_LICENSE_TIER;
  const prevOrg = process.env.POLAR_ORGANIZATION_ID;

  afterEach(() => {
    if (prev === undefined) delete process.env.SKIP_LICENSE;
    else process.env.SKIP_LICENSE = prev;
    if (prevTier === undefined) delete process.env.SPLITSHIP_LICENSE_TIER;
    else process.env.SPLITSHIP_LICENSE_TIER = prevTier;
    if (prevOrg === undefined) delete process.env.POLAR_ORGANIZATION_ID;
    else process.env.POLAR_ORGANIZATION_ID = prevOrg;
  });

  it('skips when skip=true', async () => {
    delete process.env.SKIP_LICENSE;
    const r = await validateLicense({ licenseKey: '', skip: true });
    assert.equal(r.ok, true);
    assert.equal(r.reason, 'skipped');
  });

  it('skips via SKIP_LICENSE env', async () => {
    process.env.SKIP_LICENSE = '1';
    const r = await validateLicense({ licenseKey: '' });
    assert.equal(r.ok, true);
    assert.equal(r.reason, 'skipped');
  });

  it('rejects missing key', async () => {
    delete process.env.SKIP_LICENSE;
    const r = await validateLicense({ licenseKey: '' });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'missing_license_key');
  });

  it('rejects placeholder organization id', async () => {
    delete process.env.SKIP_LICENSE;
    delete process.env.POLAR_ORGANIZATION_ID;
    const r = await validateLicense({
      licenseKey: 'polar_test_key_12345',
      organizationId: 'REPLACE_WITH_DRIFTWATCH_KIT_ORG_UUID',
    });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'missing_organization_id');
  });

  it('accepts granted response via mocked fetch', async () => {
    delete process.env.SKIP_LICENSE;
    delete process.env.SPLITSHIP_LICENSE_TIER;
    const fetchImpl = async (url, opts) => {
      assert.match(url, /license-keys\/validate/);
      const body = JSON.parse(opts.body);
      assert.equal(body.organization_id, REAL_ORG);
      assert.equal(body.key, 'polar_test_key_12345');
      assert.equal(body.increment_usage, undefined);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'lk-1',
          status: 'granted',
          benefit_id: 'other-benefit',
        }),
      };
    };
    const r = await validateLicense({
      licenseKey: 'polar_test_key_12345',
      organizationId: REAL_ORG,
      fetchImpl,
    });
    assert.equal(r.ok, true);
    assert.equal(r.reason, 'granted');
    assert.equal(r.tier, undefined);
  });

  it('maps 404 to invalid_license_key', async () => {
    delete process.env.SKIP_LICENSE;
    const fetchImpl = async () => ({
      ok: false,
      status: 404,
      json: async () => ({ detail: 'not found' }),
    });
    const r = await validateLicense({
      licenseKey: 'bad_key_xxxxxxxx',
      organizationId: REAL_ORG,
      fetchImpl,
    });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'invalid_license_key');
  });

  it('maps network errors to license_api_error', async () => {
    delete process.env.SKIP_LICENSE;
    const fetchImpl = async () => {
      throw new Error('ECONNRESET');
    };
    const r = await validateLicense({
      licenseKey: 'polar_test_key_12345',
      organizationId: REAL_ORG,
      fetchImpl,
    });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'license_api_error');
  });

  it('single_use prefix increments usage and sets tier', async () => {
    delete process.env.SKIP_LICENSE;
    delete process.env.SPLITSHIP_LICENSE_TIER;
    let sent;
    const fetchImpl = async (_u, opts) => {
      sent = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'lk-2',
          status: 'granted',
          benefit_id: SINGLE_USE_BENEFIT_ID,
        }),
      };
    };
    const r = await validateLicense({
      licenseKey: 'SPLITSHIP-1X-ABCDEFGH',
      organizationId: REAL_ORG,
      fetchImpl,
    });
    assert.equal(sent.increment_usage, 1);
    assert.equal(r.ok, true);
    assert.equal(r.tier, 'single_use');
  });

  it('uses DEFAULT_POLAR_ORG_ID when org not passed', async () => {
    delete process.env.SKIP_LICENSE;
    delete process.env.POLAR_ORGANIZATION_ID;
    assert.equal(DEFAULT_POLAR_ORG_ID, REAL_ORG);
    let sent;
    const fetchImpl = async (_u, opts) => {
      sent = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'lk', status: 'granted' }),
      };
    };
    const r = await validateLicense({
      licenseKey: 'polar_test_key_12345',
      fetchImpl,
    });
    assert.equal(sent.organization_id, REAL_ORG);
    assert.equal(r.ok, true);
  });
});

describe('detectTier / writeUsageMarker', () => {
  it('detects prefix and benefit id', () => {
    assert.equal(detectTier('SPLITSHIP-1X-ZZ'), 'single_use');
    assert.equal(detectTier('other', SINGLE_USE_BENEFIT_ID), 'single_use');
    assert.equal(detectTier('other'), undefined);
  });

  it('writes usage marker JSON', () => {
    const dir = join(tmpdir(), `splitship-usage-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const path = writeUsageMarker({ outputDir: dir, tag: 'v1.0.0', cwd: '/' });
    const data = JSON.parse(readFileSync(path, 'utf8'));
    assert.equal(data.tier, 'single_use');
    assert.equal(data.tag, 'v1.0.0');
    assert.ok(data.usedAt);
    rmSync(dir, { recursive: true, force: true });
  });
});
