# SplitShip

**Your release just shipped. Your audience still has no idea what changed.**

Engineering writes commits. Customers need a story. LinkedIn needs a post. X needs a draft. Doing that by hand every tag costs hours — or you skip it and the launch goes quiet.

ShipRelay, Changenotes, and ShipLogs charge **$19–69/mo** for release storytelling. SplitShip is the focused alternative: a Polar-licensed GitHub Action that, on every release or tag, writes ready-to-use files:

| File | Audience |
|------|----------|
| `DEV.md` | Engineers — breaking changes, commits, authors |
| `CUSTOMER.md` | Users — plain-language what's new |
| `LINKEDIN.md` | Social — short launch post |
| `X.md` | X/Twitter — ≤280 character draft |

Optional: append a Keep-a-Changelog section, and/or update the published GitHub Release body with CUSTOMER notes (idempotent via HTML markers).

BYOK Anthropic or OpenAI when you want polished prose. No key? Offline mode builds deterministic notes from commit subjects so CI never blocks. When `llm.provider` is `auto` (default) and both API keys are present, Anthropic is preferred.

---

## Quick Start

```yaml
# .github/workflows/splitship.yml
name: SplitShip
on:
  release:
    types: [published]
  push:
    tags: ['v*']

jobs:
  notes:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Generate release docs
        uses: zer01dollars/splitship@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          polar-license-key: ${{ secrets.POLAR_LICENSE_KEY }}
          # Optional BYOK — omit for offline deterministic mode
          # anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          # llm-provider: auto
          # update-release: true
          # append-changelog: true
          # write-x: true
          skip-license: false

      - name: Commit notes
        run: |
          git config user.name "splitship-bot"
          git config user.email "splitship@users.noreply.github.com"
          git add DEV.md CUSTOMER.md LINKEDIN.md X.md CHANGELOG.md || true
          git diff --staged --quiet || git commit -m "docs: SplitShip notes for ${GITHUB_REF_NAME}"
          git push
```

Copy [`templates/splitship.example.yml`](templates/splitship.example.yml) to `splitship.yml` in your repo root to customize output names, tone, LLM provider, and `excludeTypes` / `excludeSubjects`.

### Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `github-token` | `${{ github.token }}` | Read commits / compare tags / update release |
| `polar-license-key` | — | Polar license key |
| `skip-license` | `false` | Skip license check (CI/dev) |
| `llm-provider` | `auto` | `auto` \| `offline` \| `anthropic` \| `openai` |
| `anthropic-api-key` | — | BYOK Anthropic |
| `openai-api-key` | — | BYOK OpenAI |
| `config-path` | `splitship.yml` | Config file path |
| `output-dir` | `.` | Where to write generated files |
| `tag` | `github.ref_name` | Release tag to document |
| `update-release` | `false` | Append/replace CUSTOMER section on the GitHub Release body |
| `append-changelog` | `false` | Prepend Keep-a-Changelog section into `CHANGELOG.md` |
| `write-x` | `true` | Write `X.md` (also written when `outputs.x` is set in config) |

### Outputs

`dev-path`, `customer-path`, `linkedin-path`, `x-path`, `mode` (`anthropic` \| `openai` \| `offline`)

### Config extras

```yaml
excludeTypes: [chore, ci]
excludeSubjects:
  - 'bump dependencies'
changelogPath: CHANGELOG.md
outputs:
  x: X.md
```

---

## Local development

```bash
npm install
npm test
SKIP_LICENSE=1 npm run local   # writes ./out/{DEV,CUSTOMER,LINKEDIN,X}.md from fixtures
npm run build                  # bundles dist/index.js via @vercel/ncc
```

Set `SKIP_LICENSE=1` or pass `skip-license: true` for unpaid local/CI runs.

---

## Pricing

| Plan | Price | Buy |
|------|-------|-----|
| Monthly | **$19/mo** | [Checkout](https://buy.polar.sh/polar_cl_8PwpV5JXH43Zo0Iyvv6BT2lxYCJio8LriNVWE4XASID) |
| Lifetime | **$149** | [Checkout](https://buy.polar.sh/polar_cl_1y0y6oLUao5mfVDyomZFbJUCcDHCfUOJfy3QY3EHwmv) |
| Single-use | **$9** | [Checkout](https://buy.polar.sh/polar_cl_JDQfXQQqSGJTQwr6OKPiXTiVVKo7dcF9sIo5b1bSK4O) |

Licensed via [Polar](https://polar.sh) (org `driftwatch-kit`). After purchase, store your license key as `POLAR_LICENSE_KEY` in repo secrets.

**Single-use tier:** keys prefixed `SPLITSHIP-1X` (or env `SPLITSHIP_LICENSE_TIER=single`) set `tier: single_use` and write a `.splitship-usage.json` marker under `output-dir` after a successful run for audit.

Competitors in this lane (ShipRelay, Changenotes, ShipLogs) typically land at $19–69/mo — SplitShip keeps the workflow inside GitHub Actions with an offline fallback so you are never blocked on an LLM.

---

## How it works

1. **License** — Polar key check (stub today; `skip-license` for CI). Single-use keys leave an audit marker.
2. **Gather** — Commits since the previous release tag (or recent history).
3. **Filter** — Optional `excludeTypes` / `excludeSubjects`.
4. **Generate** — BYOK LLM if configured; otherwise deterministic notes (always builds an X draft).
5. **Write** — `DEV.md`, `CUSTOMER.md`, `LINKEDIN.md`, and optionally `X.md`.
6. **Optional** — Append changelog; update GitHub Release body with CUSTOMER (markers `<!-- splitship:customer -->`).

---

## License

Apache-2.0 — see [LICENSE](LICENSE).

---

Made By Zer01  
Artificially Intelligent, Digitally Enhanced.
