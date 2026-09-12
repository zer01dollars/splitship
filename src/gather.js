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
 * @property {string[]} [parents]
 * @property {string[]} [files]
 * @property {string} [prTitle]
 * @property {number} [prNumber]
 * @property {string} [prUrl]
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
 * True when commit looks like a merge (subject or multiple parents).
 * @param {CommitInfo} commit
 * @returns {boolean}
 */
export function isMergeCommit(commit = {}) {
  const subject = commit.subject || '';
  if (subject.startsWith('Merge ')) return true;
  if (Array.isArray(commit.parents) && commit.parents.length > 1) return true;
  return false;
}

/**
 * Drop commits that only touch excluded path prefixes.
 * Best-effort: if a commit has no file list, keep it.
 * @param {CommitInfo[]} commits
 * @param {string[]} excludePaths
 * @returns {CommitInfo[]}
 */
export function filterExcludedPaths(commits = [], excludePaths = []) {
  const prefixes = (excludePaths || [])
    .map((p) => String(p || '').trim())
    .filter(Boolean);
  if (!prefixes.length) return commits;

  return commits.filter((c) => {
    const files = c.files;
    if (!Array.isArray(files) || files.length === 0) return true;
    const onlyExcluded = files.every((f) =>
      prefixes.some((prefix) => String(f).startsWith(prefix)),
    );
    return !onlyExcluded;
  });
}

/**
 * @param {object} c raw commit-ish
 * @returns {CommitInfo}
 */
function normalizeCommit(c = {}) {
  const message = c.subject || c.message || c.commit?.message || '';
  const parents =
    c.parents ||
    (Array.isArray(c.commit?.parents)
      ? c.commit.parents.map((p) => p.sha || p)
      : undefined);
  return {
    sha: (c.sha || '0000000').toString().slice(0, 7),
    subject: subjectFromMessage(message),
    body:
      c.body ||
      String(message).split('\n').slice(1).join('\n').trim() ||
      '',
    author:
      c.author ||
      c.commit?.author?.name ||
      c.author?.login ||
      'unknown',
    parents: parents
      ? parents.map((p) => (typeof p === 'string' ? p : p?.sha || String(p)))
      : undefined,
    files: Array.isArray(c.files)
      ? c.files.map((f) => (typeof f === 'string' ? f : f?.filename)).filter(Boolean)
      : undefined,
    prTitle: c.prTitle,
    prNumber: c.prNumber,
    prUrl: c.prUrl,
  };
}

/**
 * Best-effort: attach associated PR title/number/url to each commit.
 * @param {import('@actions/github').GitHub} octokit
 * @param {string} owner
 * @param {string} repo
 * @param {CommitInfo[]} commits
 * @returns {Promise<CommitInfo[]>}
 */
export async function enrichWithPullRequests(octokit, owner, repo, commits) {
  if (!octokit || !owner || !repo) return commits;
  const out = [];
  for (const c of commits) {
    try {
      const res = await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
        owner,
        repo,
        commit_sha: c.sha,
      });
      const pr = res.data?.[0];
      if (pr) {
        out.push({
          ...c,
          prTitle: pr.title || undefined,
          prNumber: pr.number,
          prUrl: pr.html_url || undefined,
        });
        continue;
      }
    } catch {
      // best-effort
    }
    out.push(c);
  }
  return out;
}

/**
 * When excludePaths is set, fetch per-commit file lists (best-effort).
 * @param {import('@actions/github').GitHub} octokit
 * @param {string} owner
 * @param {string} repo
 * @param {CommitInfo[]} commits
 * @returns {Promise<CommitInfo[]>}
 */
async function enrichWithFiles(octokit, owner, repo, commits) {
  if (!octokit || !owner || !repo) return commits;
  const out = [];
  for (const c of commits) {
    if (Array.isArray(c.files) && c.files.length) {
      out.push(c);
      continue;
    }
    try {
      const res = await octokit.rest.repos.getCommit({
        owner,
        repo,
        ref: c.sha,
      });
      const files = (res.data.files || [])
        .map((f) => f.filename)
        .filter(Boolean);
      const parents = (res.data.parents || []).map((p) => p.sha);
      out.push({
        ...c,
        files,
        parents: parents.length ? parents : c.parents,
      });
    } catch {
      out.push(c);
    }
  }
  return out;
}

/**
 * Gather commits between tags via Octokit, or return fixture as-is.
 * @param {object} options
 * @param {import('@actions/github').GitHub|null} [options.octokit]
 * @param {string} [options.owner]
 * @param {string} [options.repo]
 * @param {string} options.tag
 * @param {ReleaseContext} [options.fixture]
 * @param {string[]} [options.excludePaths]
 * @returns {Promise<ReleaseContext>}
 */
export async function gatherReleaseContext({
  octokit = null,
  owner,
  repo,
  tag,
  fixture = null,
  excludePaths = [],
} = {}) {
  if (fixture) {
    let commits = (fixture.commits || [])
      .map((c) => normalizeCommit(c))
      .filter((c) => !isMergeCommit(c));
    commits = filterExcludedPaths(commits, excludePaths);
    return {
      tag: fixture.tag || tag || 'v0.0.0',
      repo: fixture.repo || repo || 'app',
      owner: fixture.owner || owner || 'org',
      commits,
      previousTag: fixture.previousTag || null,
      compareUrl: fixture.compareUrl || null,
    };
  }

  if (!octokit || !owner || !repo || !tag) {
    throw new Error('gatherReleaseContext requires octokit+owner+repo+tag or a fixture');
  }

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
      commits = (cmp.data.commits || []).map((c) => {
        const parents = (c.parents || []).map((p) => p.sha);
        return normalizeCommit({
          sha: c.sha,
          message: c.commit?.message || '',
          author: c.commit?.author?.name || c.author?.login || 'unknown',
          parents,
        });
      });
    } else {
      const list = await octokit.rest.repos.listCommits({
        owner,
        repo,
        sha: tag,
        per_page: 30,
      });
      commits = list.data.map((c) => {
        const parents = (c.parents || []).map((p) => p.sha);
        return normalizeCommit({
          sha: c.sha,
          message: c.commit?.message || '',
          author: c.commit?.author?.name || c.author?.login || 'unknown',
          parents,
        });
      });
    }
  } catch (err) {
    throw new Error(`Failed to gather commits: ${err.message}`);
  }

  commits = commits.filter((c) => !isMergeCommit(c));

  if ((excludePaths || []).length) {
    commits = await enrichWithFiles(octokit, owner, repo, commits);
    commits = filterExcludedPaths(commits, excludePaths);
  }

  commits = await enrichWithPullRequests(octokit, owner, repo, commits);

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
