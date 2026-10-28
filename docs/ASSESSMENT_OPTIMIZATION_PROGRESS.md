# Assessment optimization implementation status — 2026-10-28

This is a progress report, not full acceptance of the optimization plan.

## Implemented

- `NEXT_PUBLIC_ASSESSMENT_OPTIMIZED=true` opts into the browser path (default off). Authorized context is checked before cache reuse. The new cache namespace retains the full context/proof/rule fingerprint and replaces loaded CNV reference content with the pinned manifest digest.
- A cache hit skips CNV download/parse. Successfully verified public reference packs are reused by digest. Failed/degraded evaluations remain excluded from completed caches.
- The client uses an ordered, bounded two-batch preparation pipeline. Gene reference queries overlap worker computation; display-only ranking is detached. Preparation failures are immediately observed, and cancellation stops queued consumption.
- CNV containment, imprinting overlap, STR exact matching and CNV reference-gene overlap use reusable indexes. Reference ordering and half-open interval boundaries are preserved.
- Opt-in timing events contain context, cache, CNV/gene reference, read/preparation, worker evaluation/finalization/transfer, first-readable and total durations. They also emit on failure/cancellation and contain no row identifiers or clinical values. Nested durations are inclusive, not additive. Browser Parquet download/materialization timings remain separately instrumented; a comparison report is still outstanding.
- Worker batches expose at most 20 recent read-only row previews through the result toolbar before global candidate selection completes. These previews exclude pin/rank fields, are never cached or saved as completed assessments, and disappear on cancellation/failure/completion. The main Parquet table continues to wait for the final baseline; previews are a separate readable surface.
- Octopus attaches a versioned identity/annotation/sample/family fact pack, preserving zero versus unknown, raw GT/AD/VAF and available DP/GQ. Each fact retains a request JSON pointer and explicitly unversioned source; incompatible engine prerequisites remain not applicable, and unconfirmed family premises remain unknown.
- SepiLens reconstructs the optional fact pack from its normalized request and reports absent/matched/mismatched/unsupported-version input. Forged confirmation/provenance is ignored. Fixed-object gene/transcript/consequence conflicts remain visible. Four-engine wire fixtures are checked on both services after normalization.
- `SEPILENS_AI_EVIDENCE_CHAIN_ENABLED=true` (default off) supplies evidence policy and independently established baseline facts with aliased sources. It emits criterion-level support audits across the four assessment engines. Rebuilt facts are retained in the existing encrypted agent audit; quality summaries expose only schema/coherence states. Prompt metadata identifies this opt-in path.
- Support audits require an independently established baseline, matching references, verified source/object/material, matching scores/strengths, and independently established facts. Duplicate proposal clauses cannot be labeled supported.
- YiJian displays supported, pending, insufficient and conflicting criterion states in four languages.

## Validation performed

- Optimized browser assessment suite: 131 passed, 2 skipped (optional reference/performance fixtures). TypeScript check passed.
- Default-path suite before final added cases: 130 passed, 2 optional fixture skips.
- SepiLens API, assessment and config suites passed with local synthetic HTTP services. Includes a 120-case engineering replay matrix (30 parameterized cases per engine); this is not 120 independent clinical cases or a model-accuracy evaluation.
- Octopus assistance suite passed, including zero/missing fact tests.
- HTTP proxy variables were cleared only in test processes to permit localhost synthetic service connections.

## Remaining before the original plan is complete

- Browser end-to-end baseline and 10k/50k/100k repeated cold/hot runs, p50/p95 and peak-memory comparison. The 50%/25% targets are unverified.
- End-to-end browser timing integration and report, including network/Parquet materialization and memory. HPO pair/ancestor reuse and prefiltered ROH candidate lookup are implemented; final large-fixture comparison is outstanding.
- Real-browser verification of the provisional row preview surface and its withdrawal behavior. The main Parquet table intentionally publishes only the completed baseline; provisional previews have no mutation controls.
- Complete engine-specific structured method/dosage fact extraction and claim-level excerpt/structured-record bindings. The identity/sample/family contract and unknown/conflict/not-applicable states are implemented; unsupported premises are not inferred from caller annotations.
- Missing-evidence-directed retrieval, source/case deduplication, and targeted correction integrated into the existing shared budget. Existing merge validation and billing behavior are retained; the new audit is not itself an accuracy improvement measurement.
- Independent clinically reviewed labels and fixed-model quality comparison, including false acceptance, support, omission, conflict and useful coverage metrics. No paid provider calls were made.
- Expanded UI for per-source reasons, defaults and historical missing metadata; real browser UI verification and production builds.

## Functional commits

- YiJian `83313bf`: opt-in caching, ordered pipeline, reference indexes, HPO/ROH reuse, and 1k/10k mixed-row parity tests.
- YiJian `28e121d`: reference preparation/computation overlap and nonblocking display ranking.
- YiJian `13b1eec`: bounded provisional row previews and multilingual evidence-support display.
- Octopus `684f49d`: versioned request fact packs and sanitized role quality fields; `eb424c8`: wire-fixture comparison independent of checkout line endings.
- SepiLens `c47652b`: canonical fact reconstruction, unknown-engine rejection, independently supported baseline facts, encrypted audit and opt-in evidence-quality metadata. The full `go test ./...` suite passed after these changes, including four-engine feature-on/off HTTP contracts and unchanged model-call/billing assertions.
- YiJian `5a5e7ba`: explicit role quality-field forwarding with missing parents left unknown. Related tests and TypeScript checks passed.
- Optimized suite after scheduling changes: 136 passed, 2 optional fixture skips. Subsequent preview-specific worker/UI tests, 21 AI action/card tests, language key parity and TypeScript checks passed.

Neither new path is enabled by default. The overall plan remains in progress. No paid provider requests, push or production deployment have been performed. This report accompanies functional commits and explicitly records outstanding work; it is not a clinical-accuracy or performance-target acceptance report.
