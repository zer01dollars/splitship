import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';

const DEFAULTS = {
  outputs: {
    dev: 'DEV.md',
    customer: 'CUSTOMER.md',
    linkedin: 'LINKEDIN.md',
    // x omitted by default; write-x input / outputs.x enables X.md
  },
  outputDir: '.',
  changelogPath: 'CHANGELOG.md',
  writeX: true,
  llm: {
    provider: 'auto',
    model: null,
  },
  tone: {
    dev: 'technical',
    customer: 'friendly',
    linkedin: 'professional',
  },
  include: {
    breaking: true,
    commits: true,
    authors: true,
  },
  excludeTypes: [],
  excludeSubjects: [],
};

/**
 * Load SplitShip config from YAML file + action inputs / env overrides.
 * @param {object} options
 * @param {string} [options.configPath]
 * @param {Record<string, string|undefined|boolean>} [options.inputs]
 * @returns {object}
 */
export function loadConfig({ configPath = 'splitship.yml', inputs = {} } = {}) {
  const path = resolve(process.cwd(), configPath);
  let fileConfig = {};

  if (existsSync(path)) {
    const raw = readFileSync(path, 'utf8');
    fileConfig = yaml.load(raw) || {};
  }

  const provider =
    inputs.llmProvider ||
    fileConfig.llm?.provider ||
    process.env.SPLITSHIP_LLM_PROVIDER ||
    DEFAULTS.llm.provider;

  const writeX =
    inputs.writeX !== undefined && inputs.writeX !== ''
      ? inputs.writeX === true || inputs.writeX === 'true'
      : fileConfig.writeX !== undefined
        ? Boolean(fileConfig.writeX)
        : DEFAULTS.writeX;

  return {
    ...DEFAULTS,
    ...fileConfig,
    outputs: {
      ...DEFAULTS.outputs,
      ...(fileConfig.outputs || {}),
    },
    tone: {
      ...DEFAULTS.tone,
      ...(fileConfig.tone || {}),
    },
    include: {
      ...DEFAULTS.include,
      ...(fileConfig.include || {}),
    },
    excludeTypes: fileConfig.excludeTypes || DEFAULTS.excludeTypes,
    excludeSubjects: fileConfig.excludeSubjects || DEFAULTS.excludeSubjects,
    llm: {
      ...DEFAULTS.llm,
      ...(fileConfig.llm || {}),
      provider,
      model: inputs.model || fileConfig.llm?.model || DEFAULTS.llm.model,
    },
    outputDir: inputs.outputDir || fileConfig.outputDir || DEFAULTS.outputDir,
    changelogPath:
      inputs.changelogPath ||
      fileConfig.changelogPath ||
      DEFAULTS.changelogPath,
    writeX,
    tag: inputs.tag || fileConfig.tag || null,
    updateRelease:
      inputs.updateRelease === true ||
      inputs.updateRelease === 'true' ||
      Boolean(fileConfig.updateRelease),
    appendChangelog:
      inputs.appendChangelog === true ||
      inputs.appendChangelog === 'true' ||
      Boolean(fileConfig.appendChangelog),
    anthropicApiKey:
      inputs.anthropicApiKey ||
      process.env.ANTHROPIC_API_KEY ||
      null,
    openaiApiKey:
      inputs.openaiApiKey ||
      process.env.OPENAI_API_KEY ||
      null,
  };
}
