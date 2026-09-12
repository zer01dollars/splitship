# Changelog

All notable changes to SplitShip will be documented in this file.

## [0.3.0] — 2026-09-12

### Added
- Real Polar license validation via `POST /v1/customer-portal/license-keys/validate`
- Action input `polar-organization-id` (env `POLAR_ORGANIZATION_ID` / config `polar.organizationId`)
- Default Polar org id `b6303f05-be1c-4b45-b847-5979667a3d12` (driftwatch-kit)
- Single-use keys pass `increment_usage: 1`; benefit id `3011bec7-d400-47a8-8dc2-761e4f113041` maps to `single_use`
- Gather: skip merge commits; enrich with associated PRs (`prTitle` / `prNumber` / `prUrl`); config `excludePaths`
- Offline + LLM generation prefer PR titles in bullets; `config.tone` drives wording / prompt
- Optional `create-pr` input — opens `splitship/notes-<tag>` PR with generated files (best-effort)
- Example `actions/upload-artifact@v4` workflow step in README
- `docs/PENDING.md` for post-ship follow-ups

### Changed
- Default `update-release` and `append-changelog` to **true**
- Default `output-dir` to `splitship-out` (breaking vs 0.2.x `.`)
- License failures no longer stub-accept; network errors → `license_api_error`

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
