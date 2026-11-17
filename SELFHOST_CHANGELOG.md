# Changelog

## selfhost-kit-v0.2.0 — 2026-11-18

Migrated the standalone kit to a genuine fork of `firecrawl/firecrawl`, based on upstream main `8ae5bed1d7ef3de532a29a981298da795361d115`. Preserved official history, README, workflows and licenses. Reapplied our core additions and optional Mac/MCP/operations profile in separate commits; removed redundant PDF and sitemap patches. Adapted local mapping and inference to current upstream APIs and privacy controls.

Validation: 426 selected framework tests pass and the browser service builds. Full native API/Docker/live validation is incomplete; this source migration does not update the maintainer’s running installation. See `docs/testing/fork-validation.json`.

## 0.1.0 — 2026-11-18 (historical standalone kit)

First public source release of the Firecrawl Self-host Kit, based on Firecrawl v2.11.162 with official MCP 3.36.1. Includes the native Apple Silicon deployment profile, local MCP tools, extraction correctness fixes, bounded concurrency and optional authenticated remote gateway.

Public setup generates secrets and paths locally. No private deployment history, account binding, runtime state or hosted access is included. The maintainer's existing running installation is separate from this public source repository.
