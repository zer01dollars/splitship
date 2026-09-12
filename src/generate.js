import { findBreaking } from './gather.js';
import { filterCommits } from './filter.js';

/**
 * Generate DEV.md, CUSTOMER.md, LINKEDIN.md, and X.md from release context.
 * Uses BYOK Anthropic/OpenAI when keys + provider set; otherwise
 * offline deterministic fallback from commit subjects.
 */

/**
 * @param {import('./gather.js').ReleaseContext} ctx
 * @param {object} config
 * @returns {Promise<{ mode: string, files: { dev: string, customer: string, linkedin: string, x: string } }>}
 */
export async function generateDocuments(ctx, config = {}) {
  const filteredCtx = {
    ...ctx,
    commits: filterCommits(ctx.commits || [], config),
  };
  const provider = resolveProvider(config);

  if (provider === 'anthropic' && config.anthropicApiKey) {
    try {
      const files = await generateWithAnthropic(filteredCtx, config);
      return { mode: 'anthropic', files };
    } catch {
      // fall through to offline
    }
  }

  if (provider === 'openai' && config.openaiApiKey) {
    try {
      const files = await generateWithOpenAI(filteredCtx, config);
      return { mode: 'openai', files };
    } catch {
      // fall through to offline
    }
  }

  return { mode: 'offline', files: generateOffline(filteredCtx, config) };
}

/**
 * Prefer anthropic when provider is unset/auto and both API keys are present.
 * @param {object} config
 * @returns {'anthropic'|'openai'|'offline'}
 */
export function resolveProvider(config = {}) {
  const raw = config.llm?.provider;
  const p = (raw == null || raw === '' ? 'auto' : String(raw)).toLowerCase();
  const hasAnthropic = Boolean(config.anthropicApiKey);
  const hasOpenAI = Boolean(config.openaiApiKey);

  if (p === 'offline') return 'offline';

  if (p === 'anthropic') {
    return hasAnthropic ? 'anthropic' : 'offline';
  }
  if (p === 'openai') {
    return hasOpenAI ? 'openai' : 'offline';
  }

  // auto / unset: prefer anthropic when both keys present
  if (p === 'auto' || p === 'unset') {
    if (hasAnthropic && hasOpenAI) return 'anthropic';
    if (hasAnthropic) return 'anthropic';
    if (hasOpenAI) return 'openai';
    return 'offline';
  }

  // unknown provider string with keys → try auto preference
  if (hasAnthropic && hasOpenAI) return 'anthropic';
  if (hasAnthropic) return 'anthropic';
  if (hasOpenAI) return 'openai';
  return 'offline';
}

/**
 * Display label for a commit — prefer associated PR title when present.
 * @param {import('./gather.js').CommitInfo} c
 * @returns {string}
 */
export function commitBulletLabel(c = {}) {
  if (c.prTitle && String(c.prTitle).trim()) {
    const num = c.prNumber ? ` (#${c.prNumber})` : '';
    return `${String(c.prTitle).trim()}${num}`;
  }
  return c.subject || '';
}

/**
 * Tone copy tweaks for offline templates.
 * @param {string} channel
 * @param {object} toneConfig
 */
export function toneCopy(channel, toneConfig = {}) {
  const t = String(toneConfig?.[channel] || toneConfig || 'friendly').toLowerCase();
  const map = {
    technical: {
      customerIntro: 'Release notes for',
      customerOutro: 'See DEV.md for implementation details.',
      linkedinOpen: 'Shipped',
      linkedinClose: 'Details in the release notes.',
      xEmoji: '📦',
    },
    friendly: {
      customerIntro: "Thanks for shipping with us. Here's what changed in",
      customerOutro: 'We appreciate your feedback — reply anytime.',
      linkedinOpen: 'We just shipped',
      linkedinClose: 'Built in public. Feedback welcome.',
      xEmoji: '🚢',
    },
    professional: {
      customerIntro: 'Summary of changes in',
      customerOutro: 'Please review before upgrading in production.',
      linkedinOpen: 'Announcing',
      linkedinClose: 'Full notes are available with the release.',
      xEmoji: '🚀',
    },
    casual: {
      customerIntro: "Hey — here's what's new in",
      customerOutro: 'Hit us up if anything feels off.',
      linkedinOpen: 'Just dropped',
      linkedinClose: 'Would love your thoughts.',
      xEmoji: '✨',
    },
  };
  return map[t] || map.friendly;
}

/**
 * Deterministic offline generation from commit subjects / PR titles.
 * Always includes an X/Twitter draft (≤280 chars).
 * @param {import('./gather.js').ReleaseContext} ctx
 * @param {object} [config]
 */
export function generateOffline(ctx, config = {}) {
  const tag = ctx.tag || 'v0.0.0';
  const repo = ctx.repo || 'project';
  const commits = ctx.commits || [];
  const breaking = findBreaking(commits);
  const labels = commits.map((c) => commitBulletLabel(c)).filter(Boolean);
  const subjects = commits.map((c) => c.subject).filter(Boolean);
  const authors = [
    ...new Set(commits.map((c) => c.author).filter((a) => a && a !== 'unknown')),
  ];

  const features = labels.filter((s, i) =>
    /^(feat|feature)(\(.+\))?[!]?:/i.test(subjects[i] || s),
  );
  const fixes = labels.filter((s, i) =>
    /^(fix)(\(.+\))?[!]?:/i.test(subjects[i] || s),
  );
  const other = labels.filter((s, i) => {
    const subj = subjects[i] || s;
    return (
      !/^(feat|feature|fix)(\(.+\))?[!]?:/i.test(subj) &&
      !breaking.includes(subj)
    );
  });

  const bullet = (items, empty = '_None_') =>
    items.length ? items.map((i) => `- ${i}`).join('\n') : empty;

  const tone = config.tone || {};
  const customerTone = toneCopy('customer', tone);
  const linkedinTone = toneCopy('linkedin', tone);
  const xTone = toneCopy('linkedin', tone); // X leans social; reuse linkedin channel or casual

  const customerBullets = labels.map((s) => `- ${humanizeSubject(s)}`);

  const dev = `# Developer Notes — ${tag}

## Summary
Release **${tag}** of \`${repo}\` includes **${commits.length}** commit(s).

${ctx.compareUrl ? `Compare: ${ctx.compareUrl}\n` : ''}
## Breaking changes
${bullet(breaking, '_None detected_')}

## Features
${bullet(features)}

## Fixes
${bullet(fixes)}

## Other
${bullet(other)}

## Commits
${
  commits.length
    ? commits
        .map((c) => {
          const label = commitBulletLabel(c);
          return `- \`${c.sha}\` ${label}${c.author ? ` (${c.author})` : ''}`;
        })
        .join('\n')
    : '_No commits_'
}

## Authors
${authors.length ? authors.map((a) => `- ${a}`).join('\n') : '_Unknown_'}

---
Generated by SplitShip (offline) · Made By Zer01
`;

  const customer = `# What's New — ${tag}

${customerTone.customerIntro} **${tag}**:

${customerBullets.length ? customerBullets.join('\n') : '- Maintenance and internal improvements.'}

${
  breaking.length
    ? `\n## Important\n${breaking.map((b) => `- ${humanizeSubject(b)}`).join('\n')}\n`
    : ''
}
${customerTone.customerOutro}

—
The ${repo} team
`;

  const highlight =
    features[0] || fixes[0] || labels[0] || 'new improvements across the board';
  const linkedin = `🚀 ${linkedinTone.linkedinOpen} **${tag}** of ${repo}.

Highlights:
${(features.length ? features : labels).slice(0, 3).map((s) => `• ${humanizeSubject(s)}`).join('\n') || `• ${humanizeSubject(highlight)}`}

${breaking.length ? `⚠️ Note: this release includes breaking changes — check the notes before upgrading.\n\n` : ''}${linkedinTone.linkedinClose}

#buildinpublic #shipping #${slug(repo)}
`;

  const x = buildXPost({
    tag,
    repo,
    features,
    fixes,
    subjects: labels,
    breaking,
    emoji: xTone.xEmoji,
  });

  return {
    dev: dev.trim() + '\n',
    customer: customer.trim() + '\n',
    linkedin: linkedin.trim() + '\n',
    x: x.trim() + '\n',
  };
}

/**
 * Short ≤280 char X/Twitter draft.
 */
export function buildXPost({
  tag,
  repo,
  features = [],
  fixes = [],
  subjects = [],
  breaking = [],
  emoji = '🚢',
} = {}) {
  const highlight = humanizeSubject(
    features[0] || fixes[0] || subjects[0] || 'improvements',
  );
  let post = `${emoji} ${tag} of ${repo} is out — ${highlight}`;
  if (breaking.length) post += ' (breaking changes)';
  post += '. #shipping';
  if (post.length > 280) {
    post = post.slice(0, 277) + '...';
  }
  return post;
}

/**
 * Turn conventional-commit subject into customer-friendly phrase.
 * @param {string} subject
 */
export function humanizeSubject(subject = '') {
  let s = String(subject).trim();
  s = s.replace(/^(feat|feature|fix|chore|docs|refactor|perf|test|build|ci|style)(\(.+?\))?[!]?:\s*/i, '');
  if (!s) return subject;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function slug(name = '') {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

async function generateWithAnthropic(ctx, config) {
  const model = config.llm?.model || 'claude-3-5-haiku-latest';
  const prompt = buildPrompt(ctx, config);
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
  const data = await res.json();
  const text = (data.content || []).map((c) => c.text || '').join('');
  return parseLlmDocuments(text, ctx, config);
}

async function generateWithOpenAI(ctx, config) {
  const model = config.llm?.model || 'gpt-4o-mini';
  const prompt = buildPrompt(ctx, config);
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.openaiApiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  return parseLlmDocuments(text, ctx, config);
}

/**
 * @param {import('./gather.js').ReleaseContext} ctx
 * @param {object} [config]
 */
export function buildPrompt(ctx, config = {}) {
  const tone = config.tone || {};
  const commits = (ctx.commits || [])
    .map((c) => {
      const label = commitBulletLabel(c);
      return `- ${c.sha} ${label}${c.author ? ` (${c.author})` : ''}`;
    })
    .join('\n');
  return `You are SplitShip. Produce four documents for release ${ctx.tag} of ${ctx.repo}.

Tone guidance:
- DEV.md: ${tone.dev || 'technical'}
- CUSTOMER.md: ${tone.customer || 'friendly'}
- LINKEDIN.md: ${tone.linkedin || 'professional'}
- X.md: concise social (${tone.linkedin || 'professional'} / casual)

Prefer PR titles over raw commit subjects when both appear in the commit list.

Return EXACTLY this structure (no extra commentary):

<<<DEV>>>
...developer-facing release notes...
<<<CUSTOMER>>>
...customer-facing what's new...
<<<LINKEDIN>>>
...short LinkedIn post...
<<<X>>>
...X/Twitter post ≤280 characters...

Commits:
${commits || '(none)'}
`;
}

function parseLlmDocuments(text, ctx, config) {
  const extract = (label) => {
    const re = new RegExp(`<<<${label}>>>\\s*([\\s\\S]*?)(?=<<<|$)`, 'i');
    const m = text.match(re);
    return m ? m[1].trim() : '';
  };
  const offline = generateOffline(ctx, config);
  const dev = extract('DEV') || offline.dev.trim();
  const customer = extract('CUSTOMER') || offline.customer.trim();
  const linkedin = extract('LINKEDIN') || offline.linkedin.trim();
  let x = extract('X') || offline.x.trim();
  if (x.length > 280) x = x.slice(0, 277) + '...';
  if (!extract('DEV') || !extract('CUSTOMER') || !extract('LINKEDIN')) {
    return offline;
  }
  return {
    dev: dev.endsWith('\n') ? dev : dev + '\n',
    customer: customer.endsWith('\n') ? customer : customer + '\n',
    linkedin: linkedin.endsWith('\n') ? linkedin : linkedin + '\n',
    x: x.endsWith('\n') ? x : x + '\n',
  };
}
