# SplitShip

**Your release just shipped. Your audience still has no idea what changed.**

Engineering writes commits. Customers need a story. LinkedIn needs a post. Doing that by hand every tag costs hours — or you skip it and the launch goes quiet.

ShipRelay, Changenotes, and ShipLogs charge **$19–69/mo** for release storytelling. SplitShip is the focused alternative: a Polar-licensed GitHub Action that, on every release or tag, writes three ready-to-use files:

| File | Audience |
|------|----------|
| `DEV.md` | Engineers — breaking changes, commits, authors |
| `CUSTOMER.md` | Users — plain-language what's new |
| `LINKEDIN.md` | Social — short launch post |

BYOK Anthropic or OpenAI when you want polished prose. No key? Offline mode builds deterministic notes from commit subjects so CI never blocks.

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
          # llm-provider: anthropic
          skip-license: false

      - name: Commit notes
        run: |
          git config user.name "splitship-bot"
          git config user.email "splitship@users.noreply.github.com"
          git add DEV.md CUSTOMER.md LINKEDIN.md
          git diff --staged --quiet || git commit -m "docs: SplitShip notes for ${GITHUB_REF_NAME}"
          git push
```

Copy [`templates/splitship.example.yml`](templates/splitship.example.yml) to `splitship.yml` in your repo root to customize output names, tone, and LLM provider.

### Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `github-token` | `${{ github.token }}` | Read commits / compare tags |
| `polar-license-key` | — | Polar license key |
| `skip-license` | `false` | Skip license check (CI/dev) |
| `llm-provider` | `offline` | `offline` \| `anthropic` \| `openai` |
| `anthropic-api-key` | — | BYOK Anthropic |
| `openai-api-key` | — | BYOK OpenAI |
| `config-path` | `splitship.yml` | Config file path |
| `output-dir` | `.` | Where to write the three files |
| `tag` | `github.ref_name` | Release tag to document |

### Outputs

`dev-path`, `customer-path`, `linkedin-path`, `mode` (`anthropic` \| `openai` \| `offline`)

---

## Local development

```bash
npm install
npm test
SKIP_LICENSE=1 npm run local   # writes ./out/{DEV,CUSTOMER,LINKEDIN}.md from fixtures
npm run build                  # bundles dist/index.js via @vercel/ncc
```

Set `SKIP_LICENSE=1` or pass `skip-license: true` for unpaid local/CI runs.

---

## Pricing

| Plan | Price |
|------|-------|
| Monthly | **$19/mo** |
| Lifetime | **$149** |

Licensed via [Polar](https://polar.sh). Create a license key after purchase and store it as `POLAR_LICENSE_KEY` in repo secrets.

Competitors in this lane (ShipRelay, Changenotes, ShipLogs) typically land at $19–69/mo — SplitShip keeps the workflow inside GitHub Actions with an offline fallback so you are never blocked on an LLM.

---

## How it works

1. **License** — Polar key check (stub today; `skip-license` for CI).
2. **Gather** — Commits since the previous release tag (or recent history).
3. **Generate** — BYOK LLM if configured; otherwise deterministic notes from commit subjects.
4. **Write** — `DEV.md`, `CUSTOMER.md`, `LINKEDIN.md`.

---

## License

Apache-2.0 — see [LICENSE](LICENSE).

---

Made By Zer01  
Artificially Intelligent, Digitally Enhanced.
