# Public read-only Demo

## Shared original YiJian workspace

The public page uses the same `AppShellView`, `SidebarNavView`, task header,
sample summary, `ResultTabs`, `VariantTypeNav` and five result table views as
the authenticated application. Connected entrypoints keep their existing
exports and supply business services; Demo supplies static services instead.
The actual brand asset is `/logo.svg`. The former custom Demo layout and its
stylesheet were removed. Return-to-website links use
`https://www.schema-bio.com/`.

SNV annotation/evidence sections and CNV annotation sections are shared with
the original inspectors. The MT inspector receives its connected editor as a
slot; public mode retains annotations and omits that editor and online links.
Pure row mappers are shared by business and static sources. No business client
is reachable through the Demo's runtime import graph.

Public navigation retains the original layout with business destinations
disabled. Public result marks and assessment cards cannot write or adopt a new
conclusion. HPO editing and saved filter views are unavailable; browser-local
filters, table columns, sorting and pagination remain usable. QC fractions carry
explicit units for the original QC formatter. Unprovided result types remain
unknown rather than being counted as zero.

`/demo` runs in the existing YiJian service. `?lang=zh-CN|zh-Hant|en|es-419`
selects the display language. The website links directly to the verified Jakarta
gateway at `https://yijian.schema-bio.com/demo`.

## Isolation

Middleware derives and overwrites the public-layout marker from the pathname.
The root layout mounts only PublicProviders on Demo requests and omits
`runtime-config.js`. No auth, upload, AI, organization or task providers mount.
Existing business layouts and API permissions are unchanged.

DemoSource exposes only open/query/close against immutable local tables. Its
loader accepts manifest-listed versioned files only, omits credentials, rejects
redirects and checks SHA-256, byte size, schema and row count. It never imports
the business result client or Parquet authorization/assessment implementation.
The dependency test checks transitive runtime imports.

The Demo page and its dedicated `/demo-engine/1.32.0/` workers receive a
path-scoped CSP. Connections are restricted to the pinned Demo directory and
local DuckDB WASM/extensions, including same-origin path restrictions. The
production API and upload origins are not added. Worker JavaScript's required
eval permission does not extend to the Demo page. `form-action` is `none`.
The normal production worker paths retain their existing behavior.

The only result interactions are local filters, sorting, pagination, tab changes
and details. Download is a native disabled button with no handler or href.
There are no upload, task submission, editing, review, report, IGV or AI controls.
Public Parquet is intentionally downloaded when entering Demo and can be obtained
by visitors independently of the disabled product download control.

## Snapshot provenance

The active curated template was verified read-only on 2026-11-17:
`hg002-myh3-hg38-20261110-v1`. It is a **single-sample** HG002 example with a
constructed MYH3 variant, not a trio. Production YiJian was v0.4.1, revision
`c6da6c2a064b9efa47deb4100d8a277f5b3275fa`; local HEAD differed only in gitignore
before implementation. No production files, configuration or business records
were changed and no deployment was performed.

Only the five curated result Parquets were downloaded. The metadata export
selects age, sex, HPO and numeric QC groups in SQL and excludes clinical free
text, sample identifiers, fingerprints, object paths and credentials. Public
files include no BAM/FASTQ, storage URLs or internal paths. Provenance URL columns
are excluded; CNV positional field aliases preserve source schema meaning.

The mandatory variant is **hg38 chr17:10641317 C>T, MYH3 p.Arg672His, 0/1**,
confirmed in this template, not substituted from the hg19 regression fixture.
The exporter verifies pinned source checksums, exact identity and source ClinVar
annotation, and fails if any proof is missing. It does not calculate a medical
classification. ClinVar annotations and CNV scores are the fixed values shipped
in the immutable template. The template does not carry separate authenticated
users' manual adjustments or live browser ACMG baselines, so those are not
fabricated or loaded. The UI explicitly describes this limitation.

SNV/InDel sampling is deterministic SHA-256 ranking per chromosome, keeping up
to 1000 whole rows and reserving the mandatory variant first. All sample/genotype
columns remain together. Each CNV table keeps up to 1000 whole records; STR and
MT retain all records. Missing MEI/ROH/UPD data is stated in the overview.
Original and sampled counts are separate. Engine transfer size is separate from
Parquet transfer size.

## Rebuild and validate

With Python 3 and pyarrow, place the five original verified Parquets and a
sanitized `metadata.json` in a local private directory. The metadata contains
`template`, `reference`, `pipeline`, `age`, `sex`, `hpo`, and numeric `qc` groups.
Never copy a full production manifest into public resources.

```
python scripts/build-public-demo.py --source .gotmp/public-demo-source
python scripts/check-public-demo.py
pnpm exec vitest run src/lib/demo/source.test.ts src/middleware.test.ts
pnpm typecheck
pnpm build
```

`pnpm build` copies the dedicated workers from the pinned installed DuckDB
package. No external runtime CDN is used. Treat a released snapshot directory as
immutable; future snapshots need a new directory, policy version, source proof
and website verification. Build and release only outside the production host.
Production continues to run published images with existing Compose/env.
