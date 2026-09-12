/**
 * Polar license validation stub.
 * Real Polar product checkout remains manual; this checks key presence
 * and respects SKIP_LICENSE / skip-license for CI and local runs.
 *
 * Single-use tier: key prefix SPLITSHIP-1X or env SPLITSHIP_LICENSE_TIER=single
 * → tier: 'single_use' (caller may write .splitship-usage.json audit marker).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * @param {object} options
 * @param {string} [options.licenseKey]
 * @param {boolean} [options.skip]
 * @returns {Promise<{ ok: boolean, reason: string, tier?: string }>}
 */
export async function validateLicense({ licenseKey, skip = false } = {}) {
  if (skip || process.env.SKIP_LICENSE === '1' || process.env.SKIP_LICENSE === 'true') {
    return { ok: true, reason: 'skipped', tier: detectTier(licenseKey) };
  }

  if (!licenseKey || !String(licenseKey).trim()) {
    return {
      ok: false,
      reason: 'missing_license_key',
    };
  }

  // Stub: accept any non-empty key until Polar product is wired.
  // Future: call Polar license validation API.
  const key = String(licenseKey).trim();
  if (key.length < 8) {
    return { ok: false, reason: 'invalid_license_key' };
  }

  const tier = detectTier(key);
  return { ok: true, reason: 'stub_accepted', tier };
}

/**
 * @param {string} [licenseKey]
 * @returns {string|undefined}
 */
export function detectTier(licenseKey = '') {
  const key = String(licenseKey || '').trim();
  if (
    key.startsWith('SPLITSHIP-1X') ||
    process.env.SPLITSHIP_LICENSE_TIER === 'single'
  ) {
    return 'single_use';
  }
  return undefined;
}

/**
 * Write single-use audit marker under outputDir.
 * @param {object} options
 * @param {string} options.outputDir
 * @param {string} [options.tag]
 * @param {string} [options.cwd]
 * @returns {string} path written
 */
export function writeUsageMarker({
  outputDir = '.',
  tag = '',
  cwd = process.cwd(),
} = {}) {
  const dir = resolve(cwd, outputDir);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, '.splitship-usage.json');
  const payload = {
    tier: 'single_use',
    tag: tag || null,
    usedAt: new Date().toISOString(),
  };
  writeFileSync(path, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return path;
}
