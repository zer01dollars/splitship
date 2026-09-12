/**
 * One real Context.dev call (costs credits). Loads .env if present.
 * Usage: node scripts/prove-context.js
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { discoverApps } from '../src/context/discoverApps.js';

function loadDotEnv() {
  const p = resolve(process.cwd(), '.env');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const k = m[1];
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

loadDotEnv();

const result = await discoverApps({
  query: 'release notes GitHub Action automation tools',
  numResults: 10,
});

console.log(JSON.stringify(result, null, 2));
