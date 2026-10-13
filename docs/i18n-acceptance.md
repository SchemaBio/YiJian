# Four-language acceptance — 2026-10-13

The interface supports `zh-CN`, `zh-Hant`, `en`, and `es-419`. The four catalogs
contain 2,706 shared message keys each. Translation drafts and terminology
edits were performed locally; no online translation service received text.

## Automated verification

- Full suite: **89 files passed, 382 tests passed, 1 existing performance test
  skipped**. No failing tests. The baseline multi-selection test retains its
  assertions and has a 60-second timeout to accommodate the complete suite.
- `pnpm typecheck` passed.
- `pnpm build` passed, including the UI Kit locale patch and PageAgent bridge.
- `node scripts/check-i18n.cjs` passed. The AST scanner checks direct Chinese
  JSX text and display attributes; dynamic descriptors were also inventoried
  and reviewed against the static label registry.
- Catalog tests validate identical keys, ICU interpolation/plural contracts,
  every message's formatting, and Chinese fallback with missing-key logging.
- SSR/hydration tests cover all four languages. Provider and UI Kit tests
  verify that language changes preserve unsaved input and selector searches.
  An in-flight AI operation keeps its instance, original command, history and
  generated output when language is saved.
- CSV tests preserve business rows exactly in every language. Unknown backend
  messages and custom workflow labels remain original; known error/stage
  codes have explicit mappings.
- Privacy tests cover four documents, legacy links, document-only overrides
  and absence of switching controls. The policy version remains 2026-10-12.
- Docker entrypoint tests execute the shell script for all four defaults,
  absent defaults, invalid values and empty values. Compose variable forwarding
  was checked for Octopus's existing deployment Compose and both Squid
  production/local Compose files.
- **pnpm 9.15.9 frozen-lockfile installation passed**, applying the checked-in
  UI Kit patch. Docker copies this patch before dependency installation.

## Browser verification

Headless Microsoft Edge used the production build and local synthetic API
responses. No actual backend or patient data was used. All **128 checks passed**:

- 100 checks cover public pages, settings, dashboard, samples, data, tasks,
  history, workflows, licenses and administration in four languages and
  both Octopus/Squid modes. They include sample dialogs at 390 px, language
  drafts before Save, applying Save, retaining the profile draft and preserving
  preference after refresh. Initial HTML and hydration agreed; no hydration
  errors were recorded. Invalid/absent cookies use the deployment default.
- 8 complex-variant checks use a locally generated synthetic Parquet file,
  the actual browser query engine and assessment worker, BRCA1/HGVS annotation,
  the detail panel and ACMG controls at 390 px. Technical identifiers remain
  original in every language.
- 8 sample submissions produce identical payloads across languages and modes,
  including `sample_type: "全血"` and `gender: "unknown"`.
- 12 SSR requests launch the same production build under each deployment
  default and verify no preference, an invalid cookie and an overriding
  English preference, including HTML language and localized metadata.

Local diagnostics and screenshots are retained under ignored `.gotmp/`.

## Environment limit

Docker is unavailable on this workstation, so an actual image build/container
launch and `docker compose config` execution were not run. Entrypoint execution,
Compose forwarding, reproducible dependency installation and production runtime
default selection passed. Real deployment integration remains to be checked in
an environment with Docker. No actual deployment configuration was edited, and
no deployment, backend interface change or database migration was performed.
