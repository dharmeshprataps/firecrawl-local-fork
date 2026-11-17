# Modification notice

Upstream-fork migration, prepared on **18 November 2026**.

Relative to upstream Firecrawl main at `8ae5bed1d7ef3de532a29a981298da795361d115`, this distribution includes:

- Native ARM64 build adjustments, PostgreSQL queue defaults, persistent services, bounded resource/concurrency settings and loopback-only deployment configuration.
- Scraper/browser private-destination guards and isolated deterministic fixture support, disabled in production.
- A PDF fallback regression (the production fix is already upstream), code preservation and financial table grounding with explicit exact unit transformations or typed unsupported results.
- Additional local mapping/search, expected-content checks and per-page batch error handling.
- A local MCP wrapper around the pinned official server, companion tools, manual monitors and a separate truthful read-only page reader.
- An optional OAuth/PKCE remote MCP gateway with bounded queues and sanitized timing records, without a shared public deployment.
- Operations, configuration, backup, scheduler-template and regression-test tools.

For public distribution, personal paths and domain bindings were replaced with generated local configuration and an explicitly configured remote base URL. Private runtime state, account packages, reports, copied handoff archives and private Git history were excluded. Only our additions and focused modifications are committed above the upstream base.

The upstream README, workflows, development guidance, licenses and history are retained; `SELFHOST_KIT.md` is the entry point for our optional profile. Local bounded inference is explicitly opt-in, preserving upstream model/provider behavior when disabled. Redundant older PDF production changes and the first-sitemap patch were dropped because current upstream already contains those fixes.

See the commits above the recorded upstream base for the custom diff and subsequent changes. The upstream project and its authors retain their existing notices and licenses. No hosted-service parity or general financial accuracy guarantee is implied.
