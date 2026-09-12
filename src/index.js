import * as core from '@actions/core';
import * as github from '@actions/github';
import { loadConfig } from './config.js';
import { validateLicense, writeUsageMarker } from './license.js';
import { gatherReleaseContext } from './gather.js';
import { filterCommits } from './filter.js';
import { generateDocuments } from './generate.js';
import { writeDocuments } from './write.js';
import { appendChangelog } from './changelog.js';
import { updateReleaseWithCustomer } from './release.js';

/**
 * GitHub Action entrypoint.
 */
export async function run(deps = {}) {
  const getInput = deps.getInput || ((n, o) => core.getInput(n, o));
  const setOutput = deps.setOutput || ((n, v) => core.setOutput(n, v));
  const setFailed = deps.setFailed || ((m) => core.setFailed(m));
  const info = deps.info || ((m) => core.info(m));
  const getOctokit = deps.getOctokit || ((t) => github.getOctokit(t));
  const context = deps.context || github.context;

  try {
    const skipLicense =
      getInput('skip-license') === 'true' ||
      process.env.SKIP_LICENSE === '1' ||
      process.env.SKIP_LICENSE === 'true';

    const licenseKey =
      getInput('polar-license-key') || process.env.POLAR_LICENSE_KEY || '';

    const license = await validateLicense({
      licenseKey,
      skip: skipLicense,
    });

    if (!license.ok) {
      setFailed(
        `SplitShip license check failed (${license.reason}). Set polar-license-key or skip-license: true for CI.`,
      );
      return { ok: false, reason: license.reason };
    }
    info(`License: ${license.reason}${license.tier ? ` (${license.tier})` : ''}`);

    const writeXRaw = getInput('write-x');
    const config = loadConfig({
      configPath: getInput('config-path') || 'splitship.yml',
      inputs: {
        llmProvider: getInput('llm-provider') || undefined,
        outputDir: getInput('output-dir') || undefined,
        tag: getInput('tag') || undefined,
        anthropicApiKey: getInput('anthropic-api-key') || undefined,
        openaiApiKey: getInput('openai-api-key') || undefined,
        writeX: writeXRaw === '' ? 'true' : writeXRaw,
        updateRelease: getInput('update-release') || undefined,
        appendChangelog: getInput('append-changelog') || undefined,
      },
    });

    const token = getInput('github-token') || process.env.GITHUB_TOKEN || '';
    const tag =
      config.tag ||
      getInput('tag') ||
      context.ref?.replace(/^refs\/tags\//, '') ||
      context.payload?.release?.tag_name ||
      'v0.0.0';

    const owner = context.repo?.owner;
    const repo = context.repo?.repo;

    let octokit = null;
    let ctx;
    if (deps.fixture) {
      ctx = await gatherReleaseContext({ fixture: deps.fixture, tag });
    } else if (token && owner && repo) {
      octokit = getOctokit(token);
      ctx = await gatherReleaseContext({ octokit, owner, repo, tag });
    } else {
      ctx = await gatherReleaseContext({
        fixture: {
          tag,
          repo: repo || 'app',
          owner: owner || 'org',
          commits: [],
        },
      });
    }

    info(`Generating notes for ${ctx.tag} (${ctx.commits.length} commits)`);
    const { mode, files } = await generateDocuments(ctx, config);
    info(`Mode: ${mode}`);

    const paths = writeDocuments({ files, config });
    setOutput('dev-path', paths.dev);
    setOutput('customer-path', paths.customer);
    setOutput('linkedin-path', paths.linkedin);
    setOutput('mode', mode);
    if (paths.x) {
      setOutput('x-path', paths.x);
      info(`Wrote ${paths.x}`);
    }

    info(`Wrote ${paths.dev}`);
    info(`Wrote ${paths.customer}`);
    info(`Wrote ${paths.linkedin}`);

    const filteredCtx = {
      ...ctx,
      commits: filterCommits(ctx.commits || [], config),
    };

    let changelogPath = null;
    if (config.appendChangelog) {
      changelogPath = appendChangelog({
        tag: ctx.tag,
        files,
        config,
        ctx: filteredCtx,
      });
      info(`Appended changelog: ${changelogPath}`);
    }

    let releaseUpdate = null;
    if (config.updateRelease) {
      if (!octokit && token && owner && repo) {
        octokit = getOctokit(token);
      }
      if (octokit && owner && repo) {
        releaseUpdate = await updateReleaseWithCustomer({
          octokit,
          owner,
          repo,
          tag: ctx.tag,
          customerMd: files.customer,
        });
        info(
          releaseUpdate.updated
            ? `Updated GitHub Release body for ${ctx.tag}`
            : `Release update skipped: ${releaseUpdate.reason}`,
        );
      } else {
        info('Release update skipped: no octokit context');
        releaseUpdate = { updated: false, reason: 'no_octokit' };
      }
    }

    if (license.tier === 'single_use') {
      const marker = writeUsageMarker({
        outputDir: config.outputDir || '.',
        tag: ctx.tag,
      });
      info(`Single-use license marker: ${marker}`);
    }

    return {
      ok: true,
      mode,
      paths,
      files,
      changelogPath,
      releaseUpdate,
      license,
    };
  } catch (err) {
    setFailed(err.message || String(err));
    return { ok: false, error: err };
  }
}

// Only auto-run when executed as the Action entry (not when imported by tests)
const isDirect =
  process.argv[1] &&
  (process.argv[1].endsWith('index.js') || process.argv[1].endsWith('index.mjs'));

if (isDirect && !process.env.SPLITSHIP_NO_AUTO_RUN) {
  run();
}
