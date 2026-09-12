# Changelog

All notable changes to SplitShip will be documented in this file.

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
