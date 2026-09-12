/**
 * Gather release context: tag, commits, subjects, authors.
 * Works with Octokit in Actions, or with a plain fixture object locally.
 */

/**
 * @typedef {object} CommitInfo
 * @property {string} sha
 * @property {string} subject
 * @property {string} [body]
 * @property {string} [author]
 */

/**
 * @typedef {object} ReleaseContext
 * @property {string} tag
 * @property {string} [repo]
 * @property {string} [owner]
 * @property {CommitInfo[]} commits
 * @property {string} [previousTag]
 * @property {string} [compareUrl]
 */

/**
 * Normalize commit subjects (strip conventional-commit noise lightly).
 * @param {string} message
 * @returns {string}
 */
export function subjectFromMessage(message = '') {
  const first = String(message).split('\n')[0].trim();
  return first.replace(/\s+/g, ' ');
}

/**
 * Detect likely breaking changes from conventional commits.
 * @param {CommitInfo[]} commits
 * @returns {string[]}
 */
export function findBreaking(commits = []) {
  return commits
    .filter((c) => {
      const s = c.subject || '';
      return (
        s.includes('BREAKING CHANGE') ||
        s.includes('!:') ||
        /^[a-z]+(\(.+\))?!:/i.test(s)
      );
    })
    .map((c) => c.subject);
}

/**
 * Gather commits between tags via Octokit, or return fixture as-is.
 * @param {object} options
 * @param {import('@actions/github').GitHub|null} [options.octokit]
 * @param {string} [options.owner]
 * @param {string} [options.repo]
 * @param {string} options.tag
 * @param {ReleaseContext} [options.fixture]
 * @returns {Promise<ReleaseContext>}
 */
export async function gatherReleaseContext({
  octokit = null,
  owner,
  repo,
  tag,
  fixture = null,
} = {}) {
  if (fixture) {
    return {
      tag: fixture.tag || tag || 'v0.0.0',
      repo: fixture.repo || repo || 'app',
      owner: fixture.owner || owner || 'org',
      commits: (fixture.commits || []).map((c) => ({
        sha: c.sha || '0000000',
        subject: subjectFromMessage(c.subject || c.message || ''),
        body: c.body || '',
        author: c.author || 'unknown',
      })),
      previousTag: fixture.previousTag || null,
      compareUrl: fixture.compareUrl || null,
    };
  }

  if (!octokit || !owner || !repo || !tag) {
    throw new Error('gatherReleaseContext requires octokit+owner+repo+tag or a fixture');
  }

  // Resolve previous tag (best-effort)
  let previousTag = null;
  try {
    const releases = await octokit.rest.repos.listReleases({
      owner,
      repo,
      per_page: 10,
    });
    const others = releases.data.filter((r) => r.tag_name !== tag);
    previousTag = others[0]?.tag_name || null;
  } catch {
    previousTag = null;
  }

  let commits = [];
  try {
    if (previousTag) {
      const cmp = await octokit.rest.repos.compareCommits({
        owner,
        repo,
        base: previousTag,
        head: tag,
      });
      commits = (cmp.data.commits || []).map((c) => ({
        sha: c.sha.slice(0, 7),
        subject: subjectFromMessage(c.commit?.message || ''),
        body: (c.commit?.message || '').split('\n').slice(1).join('\n').trim(),
        author: c.commit?.author?.name || c.author?.login || 'unknown',
      }));
    } else {
      const list = await octokit.rest.repos.listCommits({
        owner,
        repo,
        sha: tag,
        per_page: 30,
      });
      commits = list.data.map((c) => ({
        sha: c.sha.slice(0, 7),
        subject: subjectFromMessage(c.commit?.message || ''),
        body: (c.commit?.message || '').split('\n').slice(1).join('\n').trim(),
        author: c.commit?.author?.name || c.author?.login || 'unknown',
      }));
    }
  } catch (err) {
    throw new Error(`Failed to gather commits: ${err.message}`);
  }

  return {
    tag,
    owner,
    repo,
    commits,
    previousTag,
    compareUrl: previousTag
      ? `https://github.com/${owner}/${repo}/compare/${previousTag}...${tag}`
      : `https://github.com/${owner}/${repo}/releases/tag/${tag}`,
  };
}
