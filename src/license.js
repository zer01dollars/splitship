/**
 * Polar license validation against the customer-portal validate API.
 * Skip via SKIP_LICENSE / skip-license for CI and local runs.
 *
 * Single-use tier: key prefix SPLITSHIP-1X, known benefit id, or
 * env SPLITSHIP_LICENSE_TIER=single → tier: 'single_use'
 * (caller may write .splitship-usage.json audit marker).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Default Polar organization id for driftwatch-kit (SplitShip). */
export const DEFAULT_POLAR_ORG_ID = 'b6303f05-be1c-4b45-b847-5979667a3d12';

/** Known Polar benefit id for SplitShip Single Use ($9). */
export const SINGLE_USE_BENEFIT_ID = '3011bec7-d400-47a8-8dc2-761e4f113041';

const VALIDATE_URL =
  'https://api.polar.sh/v1/customer-portal/license-keys/validate';

/**
 * Resolve Polar organization_id from input → env → config → default.
 * @param {object} [options]
 * @param {string} [options.organizationId]
 * @param {string} [options.configOrganizationId]
 * @returns {string}
 */
export function resolveOrganizationId({
  organizationId,
  configOrganizationId,
} = {}) {
  return (
    (organizationId && String(organizationId).trim()) ||
    (process.env.POLAR_ORGANIZATION_ID &&
      String(process.env.POLAR_ORGANIZATION_ID).trim()) ||
    (configOrganizationId && String(configOrganizationId).trim()) ||
    DEFAULT_POLAR_ORG_ID
  );
}

/**
 * @param {string} [licenseKey]
 * @param {string} [benefitId]
 * @returns {string|undefined}
 */
export function detectTier(licenseKey = '', benefitId = '') {
  const key = String(licenseKey || '').trim();
  if (
    key.startsWith('SPLITSHIP-1X') ||
    process.env.SPLITSHIP_LICENSE_TIER === 'single' ||
    String(benefitId || '') === SINGLE_USE_BENEFIT_ID
  ) {
    return 'single_use';
  }
  return undefined;
}

/**
 * @param {object} options
 * @param {string} [options.licenseKey]
 * @param {boolean} [options.skip]
 * @param {string} [options.organizationId]
 * @param {string} [options.configOrganizationId]
 * @param {typeof fetch} [options.fetchImpl]
 * @returns {Promise<{ ok: boolean, reason: string, tier?: string, benefitId?: string }>}
 */
export async function validateLicense({
  licenseKey,
  skip = false,
  organizationId,
  configOrganizationId,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (skip || process.env.SKIP_LICENSE === '1' || process.env.SKIP_LICENSE === 'true') {
    return { ok: true, reason: 'skipped', tier: detectTier(licenseKey) };
  }

  if (!licenseKey || !String(licenseKey).trim()) {
    return {
      ok: false,
      reason: 'missing_license_key',
    };
  }

  const key = String(licenseKey).trim();
  const orgId = resolveOrganizationId({
    organizationId,
    configOrganizationId,
  });

  const PLACEHOLDER = 'REPLACE_WITH_DRIFTWATCH_KIT_ORG_UUID';
  if (!orgId || orgId === PLACEHOLDER) {
    return {
      ok: false,
      reason: 'missing_organization_id',
    };
  }

  const tierHint = detectTier(key);
  /** @type {Record<string, unknown>} */
  const body = {
    key,
    organization_id: orgId,
  };
  if (tierHint === 'single_use') {
    body.increment_usage = 1;
  }

  let res;
  try {
    res = await fetchImpl(VALIDATE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, reason: 'license_api_error' };
  }

  if (res.status === 404) {
    return { ok: false, reason: 'invalid_license_key' };
  }

  if (!res.ok) {
    if (res.status === 400 || res.status === 403 || res.status === 422) {
      return { ok: false, reason: 'invalid_license_key' };
    }
    return { ok: false, reason: 'license_api_error' };
  }

  let data;
  try {
    data = await res.json();
  } catch {
    return { ok: false, reason: 'license_api_error' };
  }

  const status = String(data?.status || '').toLowerCase();
  const valid =
    status === 'granted' ||
    data?.valid === true ||
    (status && status !== 'revoked' && status !== 'disabled' && data?.id);

  if (!valid || status === 'revoked' || status === 'disabled') {
    return { ok: false, reason: 'invalid_license_key' };
  }

  const benefitId = data?.benefit_id || data?.benefitId || '';
  const tier = detectTier(key, benefitId) || tierHint;

  return {
    ok: true,
    reason: 'granted',
    tier,
    benefitId: benefitId || undefined,
  };
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
