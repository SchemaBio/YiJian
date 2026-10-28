# Isolated browser assessment benchmark

This harness imports the production `queryBrowserParquet`, Arrow streaming and
assessment client/Worker modules. Only API/object/reference inputs are synthetic.
It starts no production service and calls no provider or billing endpoint. It
serves only on 127.0.0.1; do not expose its fixture/report endpoints publicly.

Requires the repository's Node/pnpm environment, Python with PyArrow, and the
already prepared `public/duckdb` runtime assets (`node scripts/copy-duckdb-assets.mjs`).
No generated data or binary is committed. All fixtures, builds and raw reports
live under ignored `.assessment-benchmark/`.

In PowerShell from the YiJian root:

```powershell
python scripts/assessment-benchmark/generate.py
$env:ASSESSMENT_BENCH_OPTIMIZED='false'
node scripts/assessment-benchmark/run.mjs build
node scripts/assessment-benchmark/run.mjs serve
# Baseline: http://127.0.0.1:4123
```

In a second terminal, use `ASSESSMENT_BENCH_OPTIMIZED='true'` for both build and
preview. The optimized build listens on port 4124. These flags affect only the
isolated benchmark builds, not a Next.js image or deployment configuration.
Use the same browser, hardware, fixture manifest, scenario and repeat count for
both paths. Run paths sequentially, keeping the tab foreground within the test
browser; browser background throttling invalidates first-paint comparisons.

The normal suite runs 10k/50k/100k rows, each with repeated cold/hot pairs. Eight
tables contain SNV, CNV, STR, MEI, MT, UPD and ROH records plus synthetic unused
annotations. All row identities follow the real dataset SHA256/ordinal contract.
Pinned CNV reference files still pass the real integrity checks. The manifest
records fixture/context/reference hashes and the PyArrow version. The report
records browser/hardware metadata, Git HEAD, phase timings where available,
requests, final row and first-page digests, and nearest-rank p50/p95. A small
repeat count has weak p95 precision and must be reported explicitly.

Cold means completed-result and parsed-CNV-reference caches are cleared, with
fresh DuckDB/assessment Workers. Compiled modules and OS/HTTP caches may be warm.
Hot means the same authorized immutable task/context is re-opened with completed
assessment caches retained and a fresh DuckDB worker. This separates assessment
cache benefit from the browser table's still-required object and WASM work.
The first readable time includes a painted provisional preview or the final page;
an internal assessment-ready event alone is not counted as a rendered page.
Full time includes Parquet materialization and the first sorted page query.
Final-result hashing runs after timing/memory sampling ends and is excluded.

Additional scenarios provide 150 ms endpoint latency, unavailable references and
cancellation after the first processed batch. Weak mode does not simulate reduced
bandwidth or packet loss. Cancellation must publish no partial automatic baseline,
and previews must be withdrawn. Reference-failure runs must not reuse degraded
results as completed caches. These scenarios test engineering behavior, not
clinical accuracy. The provisional list is a benchmark read-only projection of
real client events; product toolbar layout needs its own browser verification.

Raw reports persist as `.assessment-benchmark/reports/{baseline,optimized}-SCENARIO.json`.
The last run for a scenario replaces that report. The server accepts report writes
only from its same-origin benchmark page, never arbitrary filesystem paths.

Compare completed, balanced normal suites with at least five runs per group:

```powershell
python scripts/assessment-benchmark/compare.py .assessment-benchmark/reports/baseline-normal.json .assessment-benchmark/reports/optimized-normal.json --output .assessment-benchmark/reports/comparison.json
```

The comparer rejects incomplete runs, mismatched fixtures/browser/hardware,
insufficient repetitions and any full-result or sorted-first-page digest change.
It reports target misses directly. It always keeps overall acceptance false while
whole-page memory and product-surface verification remain unproven.

After running both paths for all additional scenarios, validate cancellation,
degraded-cache exclusion and result/page equivalence:

```powershell
python scripts/assessment-benchmark/validate_scenarios.py .assessment-benchmark/reports --output .assessment-benchmark/reports/scenarios.json
python -m unittest discover -s scripts/assessment-benchmark -p 'test_*.py'
```

`performance.memory` is an implementation-dependent heap counter, sampled every
50 ms. It is **not proof of total main-thread plus Worker peak memory**. The report
preserves that limitation, and the 110% memory acceptance requirement remains open
until a suitable whole-page/worker measurement is obtained. Never use this counter
to claim that acceptance gate passed. Timing parity and whole-page memory are
separate gates; a failed/unknown gate keeps the optimization disabled by default.
