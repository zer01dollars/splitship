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
  outputDir: 'splitship-out',
  changelogPath: 'CHANGELOG.md',
  writeX: true,
  updateRelease: true,
  appendChangelog: true,
  createPr: false,
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
  excludePaths: [],
  polar: {
    organizationId: null,
  },
};

/**
 * Parse a boolean-ish action input with a default when absent/empty.
 * @param {unknown} value
 * @param {boolean} defaultValue
 * @returns {boolean}
 */
function boolInput(value, defaultValue) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return Boolean(value);
}

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

  const updateRelease =
    inputs.updateRelease !== undefined && inputs.updateRelease !== ''
      ? boolInput(inputs.updateRelease, DEFAULTS.updateRelease)
      : fileConfig.updateRelease !== undefined
        ? Boolean(fileConfig.updateRelease)
        : DEFAULTS.updateRelease;

  const appendChangelog =
    inputs.appendChangelog !== undefined && inputs.appendChangelog !== ''
      ? boolInput(inputs.appendChangelog, DEFAULTS.appendChangelog)
      : fileConfig.appendChangelog !== undefined
        ? Boolean(fileConfig.appendChangelog)
        : DEFAULTS.appendChangelog;

  const createPr =
    inputs.createPr !== undefined && inputs.createPr !== ''
      ? boolInput(inputs.createPr, DEFAULTS.createPr)
      : fileConfig.createPr !== undefined
        ? Boolean(fileConfig.createPr)
        : DEFAULTS.createPr;

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
    excludePaths: fileConfig.excludePaths || DEFAULTS.excludePaths,
    polar: {
      ...DEFAULTS.polar,
      ...(fileConfig.polar || {}),
      organizationId:
        inputs.polarOrganizationId ||
        process.env.POLAR_ORGANIZATION_ID ||
        fileConfig.polar?.organizationId ||
        DEFAULTS.polar.organizationId,
    },
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
    updateRelease,
    appendChangelog,
    createPr,
    tag: inputs.tag || fileConfig.tag || null,
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
