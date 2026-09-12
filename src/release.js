/**
 * Update a published GitHub Release body with CUSTOMER markdown,
 * wrapped in <!-- splitship:customer --> markers so re-runs replace the section.
 */

export const CUSTOMER_START = '<!-- splitship:customer -->';
export const CUSTOMER_END = '<!-- /splitship:customer -->';

/**
 * Merge CUSTOMER markdown into an existing release body.
 * @param {string} existingBody
 * @param {string} customerMd
 * @returns {string}
 */
export function mergeCustomerIntoReleaseBody(existingBody = '', customerMd = '') {
  const block = `${CUSTOMER_START}\n${String(customerMd).trim()}\n${CUSTOMER_END}`;
  const re = /<!--\s*splitship:customer\s*-->[\s\S]*?<!--\s*\/splitship:customer\s*-->/;
  const body = String(existingBody || '');
  if (re.test(body)) {
    return body.replace(re, block);
  }
  if (!body.trim()) return block + '\n';
  return body.trimEnd() + '\n\n' + block + '\n';
}

/**
 * Find release by tag and update its body with CUSTOMER content.
 * @param {object} options
 * @param {*} options.octokit
 * @param {string} options.owner
 * @param {string} options.repo
 * @param {string} options.tag
 * @param {string} options.customerMd
 * @returns {Promise<{ updated: boolean, releaseId?: number, reason?: string }>}
 */
export async function updateReleaseWithCustomer({
  octokit,
  owner,
  repo,
  tag,
  customerMd,
} = {}) {
  if (!octokit || !owner || !repo || !tag) {
    return { updated: false, reason: 'missing_octokit_or_tag' };
  }

  let release;
  try {
    const res = await octokit.rest.repos.getReleaseByTag({ owner, repo, tag });
    release = res.data;
  } catch (err) {
    return { updated: false, reason: `release_not_found:${err.message}` };
  }

  const newBody = mergeCustomerIntoReleaseBody(release.body || '', customerMd);
  await octokit.rest.repos.updateRelease({
    owner,
    repo,
    release_id: release.id,
    body: newBody,
  });
  return { updated: true, releaseId: release.id };
}
