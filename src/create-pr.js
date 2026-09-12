/**
 * Best-effort: open a PR with generated SplitShip notes instead of
 * committing directly to the default branch.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

/**
 * Sanitize tag for branch name.
 * @param {string} tag
 * @returns {string}
 */
export function notesBranchName(tag = 'release') {
  const safe = String(tag).replace(/[^a-zA-Z0-9._-]/g, '-');
  return `splitship/notes-${safe}`;
}

/**
 * Create branch + PR containing generated note files.
 * Skips gracefully on permission / API errors.
 *
 * @param {object} options
 * @param {import('@actions/github').GitHub} options.octokit
 * @param {string} options.owner
 * @param {string} options.repo
 * @param {string} options.tag
 * @param {Record<string, string|null|undefined>} options.paths absolute or cwd-relative paths written
 * @param {string} [options.cwd]
 * @param {string} [options.baseBranch]
 * @returns {Promise<{ created: boolean, reason?: string, url?: string, branch?: string }>}
 */
export async function createNotesPullRequest({
  octokit,
  owner,
  repo,
  tag,
  paths = {},
  cwd = process.cwd(),
  baseBranch = null,
} = {}) {
  if (!octokit || !owner || !repo) {
    return { created: false, reason: 'no_octokit' };
  }

  try {
    let base = baseBranch;
    if (!base) {
      const repoInfo = await octokit.rest.repos.get({ owner, repo });
      base = repoInfo.data.default_branch || 'main';
    }

    const baseRef = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${base}`,
    });
    const baseSha = baseRef.data.object.sha;

    const branch = notesBranchName(tag);
    const refName = `heads/${branch}`;

    // Create or reset branch to base
    try {
      await octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/${refName}`,
        sha: baseSha,
      });
    } catch (err) {
      const msg = String(err.message || err);
      if (/already exists|Reference already exists/i.test(msg) || err.status === 422) {
        await octokit.rest.git.updateRef({
          owner,
          repo,
          ref: refName,
          sha: baseSha,
          force: true,
        });
      } else {
        throw err;
      }
    }

    const fileEntries = Object.values(paths).filter(Boolean);
    // Also include changelog if present next to paths
    const uniquePaths = [...new Set(fileEntries.map((p) => resolve(cwd, p)))];

    for (const abs of uniquePaths) {
      if (!existsSync(abs)) continue;
      const content = readFileSync(abs, 'utf8');
      const repoPath = relative(cwd, abs).replace(/\\/g, '/');
      if (repoPath.startsWith('..')) continue;

      let existingSha = null;
      try {
        const existing = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: repoPath,
          ref: branch,
        });
        if (!Array.isArray(existing.data) && existing.data.sha) {
          existingSha = existing.data.sha;
        }
      } catch {
        existingSha = null;
      }

      await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: repoPath,
        message: `docs: SplitShip notes for ${tag}`,
        content: Buffer.from(content, 'utf8').toString('base64'),
        branch,
        ...(existingSha ? { sha: existingSha } : {}),
      });
    }

    const pr = await octokit.rest.pulls.create({
      owner,
      repo,
      title: `docs: SplitShip release notes for ${tag}`,
      head: branch,
      base,
      body: [
        `Automated SplitShip notes for **${tag}**.`,
        '',
        'Generated files are on this branch for review.',
        '',
        '— Made By Zer01',
      ].join('\n'),
    });

    return {
      created: true,
      url: pr.data.html_url,
      branch,
      number: pr.data.number,
    };
  } catch (err) {
    const status = err.status || err.response?.status;
    if (status === 401 || status === 403 || status === 404) {
      return { created: false, reason: 'insufficient_permissions' };
    }
    return {
      created: false,
      reason: err.message || String(err),
    };
  }
}
