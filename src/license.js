/**
 * Polar license validation stub.
 * Real Polar product checkout remains manual; this checks key presence
 * and respects SKIP_LICENSE / skip-license for CI and local runs.
 */

/**
 * @param {object} options
 * @param {string} [options.licenseKey]
 * @param {boolean} [options.skip]
 * @returns {Promise<{ ok: boolean, reason: string }>}
 */
export async function validateLicense({ licenseKey, skip = false } = {}) {
  if (skip || process.env.SKIP_LICENSE === '1' || process.env.SKIP_LICENSE === 'true') {
    return { ok: true, reason: 'skipped' };
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

  return { ok: true, reason: 'stub_accepted' };
}
