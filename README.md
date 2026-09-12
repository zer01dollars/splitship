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

By default SplitShip also prepends a Keep-a-Changelog section and updates the published GitHub Release body with CUSTOMER notes (idempotent via HTML markers). Turn either off with `append-changelog: false` / `update-release: false`.

BYOK Anthropic or OpenAI when you want polished prose. No key? Offline mode builds deterministic notes from commit subjects (preferring associated PR titles when available) so CI never blocks. When `llm.provider` is `auto` (default) and both API keys are present, Anthropic is preferred.

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
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Generate release docs
        id: splitship
        uses: zer01dollars/splitship@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          polar-license-key: ${{ secrets.POLAR_LICENSE_KEY }}
          # polar-organization-id: optional override (defaults to driftwatch-kit)
          # Optional BYOK — omit for offline deterministic mode
          # anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          # llm-provider: auto
          # update-release / append-changelog default true
          # create-pr: true   # open PR instead of committing on main
          skip-license: false

      - name: Upload SplitShip artifacts
        uses: actions/upload-artifact@v4
        with:
          name: splitship-notes-${{ github.ref_name }}
          path: splitship-out/

      # Or set create-pr: true on the action and skip this commit step.
      - name: Commit notes
        run: |
          git config user.name "splitship-bot"
          git config user.email "splitship@users.noreply.github.com"
          git add splitship-out CHANGELOG.md || true
          git diff --staged --quiet || git commit -m "docs: SplitShip notes for ${GITHUB_REF_NAME}"
          git push
```

Prefer reviewable PRs? Set `create-pr: true` on the action — SplitShip opens `splitship/notes-<tag>` with the generated files (best-effort; skips gracefully without write permissions).

Copy [`templates/splitship.example.yml`](templates/splitship.example.yml) to `splitship.yml` in your repo root to customize output names, tone, LLM provider, `excludeTypes` / `excludeSubjects` / `excludePaths`.

### Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `github-token` | `${{ github.token }}` | Read commits / compare tags / update release / open PR |
| `polar-license-key` | — | Polar license key |
| `polar-organization-id` | driftwatch-kit UUID | Polar org id for license validation |
| `skip-license` | `false` | Skip license check (CI/dev) |
| `llm-provider` | `auto` | `auto` \| `offline` \| `anthropic` \| `openai` |
| `anthropic-api-key` | — | BYOK Anthropic |
| `openai-api-key` | — | BYOK OpenAI |
| `config-path` | `splitship.yml` | Config file path |
| `output-dir` | `splitship-out` | Where to write generated files |
| `tag` | `github.ref_name` | Release tag to document |
| `update-release` | `true` | Append/replace CUSTOMER section on the GitHub Release body |
| `append-changelog` | `true` | Prepend Keep-a-Changelog section into `CHANGELOG.md` |
| `write-x` | `true` | Write `X.md` (also written when `outputs.x` is set in config) |
| `create-pr` | `false` | Open PR on `splitship/notes-<tag>` with generated files |

### Outputs

`dev-path`, `customer-path`, `linkedin-path`, `x-path`, `mode` (`anthropic` \| `openai` \| `offline`), `pr-url` (when `create-pr` succeeds)

### Polar organization

License checks call Polar’s customer-portal validate API with:

- `organization_id` from (in order) `polar-organization-id` input → `POLAR_ORGANIZATION_ID` env → config `polar.organizationId` → built-in default **`b6303f05-be1c-4b45-b847-5979667a3d12`** (driftwatch-kit)

### Config extras

```yaml
excludeTypes: [chore, ci]
excludeSubjects:
  - 'bump dependencies'
excludePaths:
  - package-lock.json
  - yarn.lock
changelogPath: CHANGELOG.md
outputs:
  x: X.md
tone:
  dev: technical
  customer: friendly
  linkedin: professional
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

Licensed via [Polar](https://polar.sh) (org `driftwatch-kit`, id `b6303f05-be1c-4b45-b847-5979667a3d12`). After purchase, store your license key as `POLAR_LICENSE_KEY` in repo secrets.

**Single-use tier:** keys prefixed `SPLITSHIP-1X` (or benefit id `3011bec7-d400-47a8-8dc2-761e4f113041` / env `SPLITSHIP_LICENSE_TIER=single`) set `tier: single_use`, pass `increment_usage: 1` on validate, and write a `.splitship-usage.json` marker under `output-dir` after a successful run for audit.

Competitors in this lane (ShipRelay, Changenotes, ShipLogs) typically land at $19–69/mo — SplitShip keeps the workflow inside GitHub Actions with an offline fallback so you are never blocked on an LLM.

---

## How it works

1. **License** — Polar validate API (`skip-license` for CI). Single-use keys leave an audit marker.
2. **Gather** — Commits since the previous release tag (skips merges; enriches with associated PRs; optional `excludePaths`).
3. **Filter** — Optional `excludeTypes` / `excludeSubjects`.
4. **Generate** — BYOK LLM if configured; otherwise deterministic notes (tone-aware; prefers PR titles; always builds an X draft).
5. **Write** — files under `splitship-out/` by default (`DEV.md`, `CUSTOMER.md`, `LINKEDIN.md`, optionally `X.md`).
6. **Defaults on** — Append changelog; update GitHub Release body with CUSTOMER (markers `<!-- splitship:customer -->`).
7. **Optional** — `create-pr` opens a review PR; upload `splitship-out/` as a workflow artifact.

---

## License

Apache-2.0 — see [LICENSE](LICENSE).

---

Made By Zer01  
Artificially Intelligent, Digitally Enhanced.
