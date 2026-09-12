/**
 * Goal layer: "Many apps. Automation at scale"
 * Discover developer/app tooling via Context.dev web search (wrapper only).
 */
import { webSearch } from './client.js';

/**
 * @param {object} [opts]
 * @param {string} [opts.query]
 * @param {number} [opts.numResults]
 * @returns {Promise<{ query: string, apps: Array<{ title: string, url: string, description: string, relevance: string }>, requestId?: string, credits?: object }>}
 */
export async function discoverApps(opts = {}) {
  const query =
    opts.query ||
    'GitHub Action release notes automation developer tools 2026';
  const numResults = opts.numResults ?? 10;
  const res = await webSearch({ query, numResults });
  const apps = (res.results || []).map((r) => ({
    title: r.title,
    url: r.url,
    description: r.description,
    relevance: r.relevance,
  }));
  return {
    query: res.query || query,
    apps,
    requestId: res.request_id,
    credits: res.key_metadata,
  };
}
