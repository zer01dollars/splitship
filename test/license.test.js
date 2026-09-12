import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateLicense, detectTier, writeUsageMarker } from '../src/license.js';

describe('validateLicense', () => {
  const prev = process.env.SKIP_LICENSE;
  const prevTier = process.env.SPLITSHIP_LICENSE_TIER;

  afterEach(() => {
    if (prev === undefined) delete process.env.SKIP_LICENSE;
    else process.env.SKIP_LICENSE = prev;
    if (prevTier === undefined) delete process.env.SPLITSHIP_LICENSE_TIER;
    else process.env.SPLITSHIP_LICENSE_TIER = prevTier;
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

  it('rejects short key', async () => {
    delete process.env.SKIP_LICENSE;
    const r = await validateLicense({ licenseKey: 'short' });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'invalid_license_key');
  });

  it('accepts stub key', async () => {
    delete process.env.SKIP_LICENSE;
    const r = await validateLicense({ licenseKey: 'polar_test_key_12345' });
    assert.equal(r.ok, true);
    assert.equal(r.reason, 'stub_accepted');
  });

  it('sets single_use tier for SPLITSHIP-1X keys', async () => {
    delete process.env.SKIP_LICENSE;
    delete process.env.SPLITSHIP_LICENSE_TIER;
    const r = await validateLicense({ licenseKey: 'SPLITSHIP-1X-ABCDEFGH' });
    assert.equal(r.ok, true);
    assert.equal(r.tier, 'single_use');
  });

  it('sets single_use via SPLITSHIP_LICENSE_TIER=single', async () => {
    delete process.env.SKIP_LICENSE;
    process.env.SPLITSHIP_LICENSE_TIER = 'single';
    const r = await validateLicense({ licenseKey: 'polar_test_key_12345' });
    assert.equal(r.tier, 'single_use');
  });
});

describe('detectTier / writeUsageMarker', () => {
  it('detects prefix', () => {
    assert.equal(detectTier('SPLITSHIP-1X-ZZ'), 'single_use');
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
