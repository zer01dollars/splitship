/**
 * Filter commits by conventional type and/or subject regex before generate.
 */

/**
 * Extract conventional-commit type from subject (e.g. feat, fix, chore).
 * @param {string} subject
 * @returns {string|null}
 */
export function conventionalType(subject = '') {
  const m = String(subject).match(/^([a-zA-Z]+)(\(.+\))?[!]?:/);
  return m ? m[1].toLowerCase() : null;
}

/**
 * @param {import('./gather.js').CommitInfo[]} commits
 * @param {object} [config]
 * @param {string[]} [config.excludeTypes] e.g. ['chore','ci']
 * @param {string[]} [config.excludeSubjects] regex strings matched against subject
 * @returns {import('./gather.js').CommitInfo[]}
 */
export function filterCommits(commits = [], config = {}) {
  const excludeTypes = (config.excludeTypes || []).map((t) =>
    String(t).toLowerCase(),
  );
  const excludeSubjects = (config.excludeSubjects || [])
    .map((p) => {
      try {
        return new RegExp(p, 'i');
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  if (!excludeTypes.length && !excludeSubjects.length) {
    return commits;
  }

  return commits.filter((c) => {
    const subject = c.subject || '';
    const type = conventionalType(subject);
    if (type && excludeTypes.includes(type)) return false;
    if (excludeSubjects.some((re) => re.test(subject))) return false;
    return true;
  });
}
