/**
 * Single server-side wrapper for Context.dev.
 * All Context.dev calls in this repo go through here — never scatter raw SDK usage.
 * Env: CONTEXT_DEV_API_KEY (never commit; see .env.example)
 */
import ContextDev from 'context.dev';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getApiKey() {
  const key = process.env.CONTEXT_DEV_API_KEY;
  if (!key || !String(key).trim()) {
    throw new Error(
      'CONTEXT_DEV_API_KEY is missing. Set it in .env (local) or secrets (CI). Rotate keys at https://www.context.dev/dashboard/api-keys',
    );
  }
  return String(key).trim();
}

/**
 * @param {object} [opts]
 * @returns {ContextDev}
 */
export function createClient(opts = {}) {
  return new ContextDev({
    apiKey: opts.apiKey || getApiKey(),
    ...opts.clientOptions,
  });
}

/**
 * Bounded retry for 408 / 5xx / 429. Never retries validation (400/401/403/404).
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{ maxAttempts?: number }} [opts]
 * @returns {Promise<T>}
 */
export async function withRetry(fn, opts = {}) {
  const maxAttempts = opts.maxAttempts ?? 3;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = err?.status ?? err?.statusCode ?? err?.response?.status;
      if (status === 429) {
        const retryAfter = Number(
          err?.headers?.['retry-after'] ??
            err?.response?.headers?.['retry-after'] ??
            2,
        );
        await sleep(Math.min(Math.max(retryAfter, 1), 60) * 1000);
        continue;
      }
      if (status === 408 || (status >= 500 && status < 600)) {
        await sleep(Math.min(1000 * 2 ** (attempt - 1), 8000));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

/**
 * Web Search — POST /web/search
 * Docs: https://docs.context.dev/api-reference/web-scraping/search
 * @param {object} params
 * @param {string} params.query
 * @param {number} [params.numResults]
 * @param {string[]} [params.includeDomains]
 * @param {import('context.dev').default} [params.client]
 */
export async function webSearch({
  query,
  numResults = 10,
  includeDomains,
  client,
} = {}) {
  const c = client || createClient();
  return withRetry(() =>
    c.web.search({
      query,
      numResults,
      ...(includeDomains ? { includeDomains } : {}),
    }),
  );
}

/**
 * Scrape Markdown — GET /web/scrape/markdown
 * Docs: https://docs.context.dev/api-reference/web-scraping/markdown
 */
export async function scrapeMarkdown({
  url,
  useMainContentOnly = true,
  maxAgeMs,
  client,
} = {}) {
  const c = client || createClient();
  return withRetry(() =>
    c.web.webScrapeMd({
      url,
      useMainContentOnly,
      ...(maxAgeMs !== undefined ? { maxAgeMs } : {}),
    }),
  );
}

/**
 * Crawl Sitemap — GET /web/scrape/sitemap
 * Docs: https://docs.context.dev/api-reference/web-scraping/sitemap
 * Use when discovering many app/product URLs at scale (then Batch API for hundreds+).
 */
export async function scrapeSitemap({
  domain,
  maxLinks = 50,
  urlRegex,
  client,
} = {}) {
  const c = client || createClient();
  return withRetry(() =>
    c.web.webScrapeSitemap({
      domain,
      maxLinks,
      ...(urlRegex ? { urlRegex } : {}),
    }),
  );
}
