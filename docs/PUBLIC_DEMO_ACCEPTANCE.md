# Public Demo acceptance — original YiJian workspace

Verified on 2026-11-17. Snapshot: `hg002-myh3-20261117-v1`.

## Shared interface and branding

The Demo uses the original YiJian application shell, actual `/logo.svg`, task
header, sample summary, interpretation navigation, variant navigation, and the
original SNV/InDel, CNV region, CNV exon, STR and mitochondrial table views.
The connected formal-page exports remain intact and supply their business
services to those same views. Demo supplies immutable local services instead.
The independent Demo layout and its custom stylesheet were removed.

SNV annotation/evidence and CNV annotation sections are shared with the original
inspectors. MT keeps the original annotation inspector while its connected ACMG
editor and online resource links are excluded in public mode. No business
clients are in the public page's transitive runtime import graph.

Return-to-website is exactly `https://www.schema-bio.com/`. Both a rendered-markup
regression test and the deployed container's HTML check validate that URL and
the actual logo asset. Business navigation is non-interactive; local result
navigation remains usable. Editing, marks, adoption, HPO editing, saved views,
copy/export/download and AI requests are unavailable. Local table filters,
column display, sorting, pagination and annotation/evidence inspection remain.

## Regression and data checks

- **40 test files / 194 tests passed**, covering original task result components,
  result APIs, interpretation completion, shared UI, static services, CSP,
  credential-free loading, invalid resources and the transitive dependency graph.
- TypeScript checks and the Linux Docker production build passed.
- Offline verification passed for all five shipped Parquets: source and output
  hashes, byte sizes, schemas, row counts, chromosome sampling, and exact MYH3
  preservation. Data export remains byte-for-byte reproducible.
- Mandatory variant: **hg38 chr17:10641317 C>T, MYH3 p.Arg672His, 0/1**.
- The original QC formatter receives explicit fraction units; mapping rate is
  99.80% and coverage >=30x is 65.75%, without ambiguous unit warnings.
- CNV copy number is mapped from the absolute CN field, independently from exon
  count or log2 ratio. Unknown/unprovided result types remain unknown.
- Public MT annotations and HGVS remain present; online database links are absent.

## Container browser and network evidence

The actual local Docker image was checked through a request-recording proxy.
The browser loaded all five Parquets plus self-hosted worker/WASM/extensions.
SNP search and MYH3 details, original annotation tabs, CNV rows and details,
STR counts and the final direct-container mitochondrial annotations were checked.
The direct application URL is `http://localhost:3000/demo?lang=zh-CN`.

Proxy requests: **32**, all GET. Business API/runtime-config requests:
**0**. Credentials on manifest/Parquet requests:
**0**.

Raw local proxy log: `.gotmp/public-demo-network-original-ui.ndjson`.
SHA-256: `e756fb31d3b06ac20bc1a9415025adc6365979fb75d984109cd4cf162a55389e`.
Summary: `output/public-demo/original-ui-network-summary.json`.
Screenshot: `output/public-demo/original-workspace.jpg`.
The earlier anonymous/session/error-path tests remain covered by the static
loader and middleware tests. A simulated cookie test is not a production-account
sign-in test. No production business API credentials were used in browser QA.

## Local deployment

Only `schemabio-yijian-fresh-yijian-1` was recreated, using
`schemabio/yijian:local-demo-original-ui-20261117`. The existing explicit environment
variables, localhost:3000 port and volumes were verified unchanged. The original
image is retained under `schemabio/yijian:before-public-demo-20261117`.
The local Compose image override is `.gotmp/public-demo-local.override.yml`.
Login and Demo pages return HTTP 200; served Parquet hashes match the manifest.

No production container, production configuration or business record was changed.
No image was pushed to a registry. Parquet data remains 1,798,737 bytes / 1.72 MiB,
separate from the browser query engine and scripts. The source is a single-sample
HG002 constructed example; missing live ACMG/manual review overlays are not
fabricated or fetched. ClinVar/CNV values are the template's fixed annotations.

## Production compatibility audit before commit (2026-11-17)

- Read-only inspection found production YiJian healthy on v0.4.1, revision
  `c6da6c2a064b9efa47deb4100d8a277f5b3275fa`. Its gateway already forwards
  non-API paths to YiJian and `/api/` to Squid. No gateway, backend, database,
  production environment or Compose change is required by this feature.
- Business routes retain AppProviders, runtime-config.js and the original CSP.
  Demo markers are overwritten in middleware and cannot authorize task access.
  Public mode defaults to false in shared components. Formal API implementations
  and authentication checks remain in their original wrappers.
- The final audit restricted Demo worker eval permission to the exact two
  versioned worker files. Ordinary routes no longer resolve the Demo origin.
  Updated isolation/middleware tests: **4 files / 22 tests passed**.
- Full repository run: **178 files / 1031 tests passed**, one file skipped;
  seven failures investigated. The five container-locale tests passed when run
  outside the Windows Bash sandbox restriction. The two billing-page tests fail
  identically on an isolated HEAD baseline because their existing billing mock
  lacks BILLING_UPDATED_EVENT. They are not new Demo regressions; this does not
  constitute an entirely green full suite.
- Final Linux image passed TypeScript and production build. All five static
  tables passed offline validation, including independent source CNV comparison.
  Website TypeScript and production build also passed with its existing font
  downloads enabled. The four-language Demo banner explains that SaaS offers
  more functionality and operational detail than the reduced read-only Demo.
- Deployment must publish YiJian before enabling the website links. Replacing
  the single existing frontend container entails a restart and possible brief
  frontend unavailability; zero-downtime rollout has not been validated. Keep
  the prior immutable image for rollback. Build/push outside production and
  deploy through the existing Compose/env release procedure only.
- Production was not deployed or changed. Production-account interactive
  regression and post-deployment monitoring remain release-time checks;
  automated auth tests and local production-image checks do not replace them.
