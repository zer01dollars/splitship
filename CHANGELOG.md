# Changelog

All notable changes to SplitShip will be documented in this file.

## [0.2.0] — 2026-09-11

### Added
- `update-release` input — append/replace CUSTOMER markdown on a published GitHub Release body using `<!-- splitship:customer -->` markers
- `append-changelog` input — prepend Keep-a-Changelog-style section into `CHANGELOG.md` (or `changelogPath`)
- Optional `X.md` X/Twitter draft (≤280 chars); `write-x` input (default `true`) and `x-path` output
- Config `excludeTypes` / `excludeSubjects` to filter commits before generate
- `llm.provider: auto` prefers Anthropic when both API keys are present
- Single-use license stub (`SPLITSHIP-1X` / `SPLITSHIP_LICENSE_TIER=single`) → `tier: single_use` + `.splitship-usage.json` audit marker
- Documented single-use **$9** plan (`PENDING_SINGLE_USE` checkout URL)

### Changed
- Default `llm-provider` is `auto` (was `offline`)
- `writeDocuments` supports a fourth file while remaining backward compatible

## [0.1.0] — 2026-09-11

### Added
- GitHub Action (`action.yml`, Node 20) bundling `dist/index.js` via `@vercel/ncc`
- Generates `DEV.md`, `CUSTOMER.md`, and `LINKEDIN.md` on release/tag
- BYOK Anthropic / OpenAI generation with offline deterministic fallback
- Polar license stub (`polar-license-key`, `skip-license`, `SKIP_LICENSE`)
- Config via `splitship.yml` (`templates/splitship.example.yml`)
- `scripts/local-run.js` fixture runner
- Test suite (`node:test`) covering gather, generate, license, write, config, run
- CI workflow on push/PR

### Notes
- Polar product checkout / live license API still manual — stub accepts any key ≥ 8 chars
