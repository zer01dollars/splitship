import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';

const DEFAULTS = {
  outputs: {
    dev: 'DEV.md',
    customer: 'CUSTOMER.md',
    linkedin: 'LINKEDIN.md',
  },
  outputDir: '.',
  llm: {
    provider: 'offline',
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
};

/**
 * Load SplitShip config from YAML file + action inputs / env overrides.
 * @param {object} options
 * @param {string} [options.configPath]
 * @param {Record<string, string|undefined>} [options.inputs]
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
    llm: {
      ...DEFAULTS.llm,
      ...(fileConfig.llm || {}),
      provider,
      model: inputs.model || fileConfig.llm?.model || DEFAULTS.llm.model,
    },
    outputDir: inputs.outputDir || fileConfig.outputDir || DEFAULTS.outputDir,
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
