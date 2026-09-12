import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Write generated documents to disk.
 * @param {object} options
 * @param {{ dev: string, customer: string, linkedin: string }} options.files
 * @param {object} options.config
 * @param {string} [options.cwd]
 * @returns {{ dev: string, customer: string, linkedin: string }} absolute paths
 */
export function writeDocuments({ files, config, cwd = process.cwd() } = {}) {
  if (!files) throw new Error('writeDocuments: files required');

  const outDir = resolve(cwd, config.outputDir || '.');
  mkdirSync(outDir, { recursive: true });

  const names = {
    dev: config.outputs?.dev || 'DEV.md',
    customer: config.outputs?.customer || 'CUSTOMER.md',
    linkedin: config.outputs?.linkedin || 'LINKEDIN.md',
  };

  const paths = {};
  for (const key of ['dev', 'customer', 'linkedin']) {
    const target = join(outDir, names[key]);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, files[key], 'utf8');
    paths[key] = target;
  }
  return paths;
}
