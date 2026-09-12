#!/usr/bin/env node
/**
 * Local SplitShip run — reads fixtures/release.json and writes
 * DEV.md, CUSTOMER.md, LINKEDIN.md under ./out (or SPLITSHIP_OUT).
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gatherReleaseContext } from '../src/gather.js';
import { generateDocuments } from '../src/generate.js';
import { writeDocuments } from '../src/write.js';
import { loadConfig } from '../src/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const fixturePath = join(root, 'fixtures', 'release.json');
const outDir = process.env.SPLITSHIP_OUT || join(root, 'out');

async function main() {
  process.env.SKIP_LICENSE = process.env.SKIP_LICENSE || '1';
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
  const ctx = await gatherReleaseContext({ fixture });
  const config = loadConfig({
    configPath: join(root, 'templates', 'splitship.example.yml'),
    inputs: {
      outputDir: outDir,
      llmProvider: process.env.SPLITSHIP_LLM_PROVIDER || 'offline',
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      openaiApiKey: process.env.OPENAI_API_KEY,
    },
  });
  // force output dir (loadConfig resolves relative to cwd)
  config.outputDir = outDir;

  const { mode, files } = await generateDocuments(ctx, config);
  mkdirSync(outDir, { recursive: true });
  const paths = writeDocuments({ files, config, cwd: root });

  console.log(`SplitShip local-run mode=${mode}`);
  console.log(`  ${paths.dev}`);
  console.log(`  ${paths.customer}`);
  console.log(`  ${paths.linkedin}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
