# Indexed phenotype supplements

The v4 assessment computes local HPO → disease → gene priorities using
information-content-weighted Lin similarity and bidirectional best-match averages.
It uses ontology ancestors, so a related, more specific term can contribute even
without an exact HPO match. It does not run Phenolyzer or infer gene networks.
An eligible match requires similarity ≥0.5 and at least two informative patient
terms (IC ≥2), or one specific term (IC ≥4). The candidate-gene toolbar lists the
best eligible disease per gene, up to 200 genes, with scores and provenance.
This list is independent of whether the task contains a variant in each gene.

Variant triage scores (0–100) combine P=60 / LP=50, HPO similarity ×30,
reported AF ≤0.001 (+5), and coding/splice functional impact (+5), capped at100.
Benign/likely-benign, conflicting, and explicitly failed-quality rows score0.
These are transparent ranking heuristics, neither calibrated probabilities nor
ACMG evidence points. AF annotations alone never create PM2/PVS1 or P/LP labels.

P/LP variants are automatically pinned unless an explicit quality failure exists.
Missing GQ/AN does not veto triage; missing clinical prerequisites remain pending.
HPO-related SNV/indel VUS are also candidates: select the highest scores across
the entire task, at most 20 genes / 100 candidate variants. Frequency and
functional impact contribute ranking points rather than act as mandatory gates;
noncoding variants and unknown AF can therefore be prioritized for review.
Benign/conflicting annotations and explicit quality failures are excluded.
VUS candidates remain VUS. No de novo, trans, or inheritance fact is inferred.
Functional impact includes stop gained, frameshift, canonical splice, missense,
start/stop lost and in-frame coding changes; this is not verified PVS1 evidence.

SQL applies focus/pin priority before pagination. Within automatic pins, HPO-related
P/LP precede other P/LP and VUS candidates; unpinned rows default to triage score
then stable source order. Explicit user sorting is retained within these groups.
Manual pins, explicit unpins and classifications remain authoritative. Scores and
HPO matches are displayed separately from ACMG evidence points.

## Reproducible resources

`source-manifest.json` pins source checksums, retrieval dates, versions and terms.
`release-manifest.json` records indexed file sizes, checksums and release digest.
Download the pinned sources outside the runtime and verify their checksums.
Place them beside the source manifest, using its filenames. The two ClinGen
packs are built by Octopus's existing assessment-reference builder from its
attributed reference manifest. Preserve those source manifests with the release.

Build once before deployment:

```sh
python scripts/build-phenotype-databases.py --manifest sources/manifest.json --output release --ontology-builder ../Octopus/scripts/build-assessment-reference.py
```

Each SQLite file includes its indexes and must be at most 100,000,000 bytes.
The runtime downloads nothing. HPO vocabulary is preserved; associations use
official HPO annotations and gene–disease links. Attribution: Human Phenotype
Ontology (HPO), HGNC (CC0), and ClinGen gene–disease validity/dosage sensitivity
(CC0), accessed on the dates in the manifest. Terms:
[HPO](https://human-phenotype-ontology.github.io/license.html),
[HGNC](https://www.genenames.org/about/license/),
[ClinGen](https://clinicalgenome.org/docs/terms-of-use/).

## Runtime mounts and versioning

Mount the immutable release directory read-only at `/app/data` in YiJian.
Mount **only** its manifest read-only in Octopus and set
`ASSESSMENT_SUPPLEMENT_MANIFEST` to that manifest's container path.
The release digest becomes part of new assessment context versions. Previously
activated contexts and human review adjustments are retained. Users explicitly
reassess after changing resources or patient HPO.

`POST /reference-api/assessment/{taskId}` accepts a fixed context version,
resource digest, up to 512 gene identifiers and a gene-offset cursor. Authorization
uses the existing task permission check; patient HPO comes from that authorized
context, never from the request. Responses carry canonical genes, full disease
matches, ClinGen background and warning IDs. Follow every cursor; no valid
association is silently truncated. Workers process existing batches of at most
1,000 variant rows. Gene requests are deduplicated across the whole task.

A dedicated SQLite thread uses prepared statements, a 4 MiB page cache per
database, a bounded 8 MiB public term cache and at most eight queued requests.
A rank request scans all public disease–gene associations once and returns up to
200 eligible gene matches. Patient-specific scores are released after each query. Responses are paginated
below 1 MB. Resource errors remove supplementary priority and keep the legacy
assessment available; a version mismatch aborts publication of mixed results.

## Verification

```sh
node --test scripts/phenotype/reference-worker.test.cjs
node scripts/phenotype/benchmark.cjs /app/data
pnpm test
pnpm exec tsc --noEmit
pnpm build
```

Benchmark output includes RSS deltas, cold/warm query times, two queued tasks
and Linux I/O counters. Targets: hot RSS delta <=64 MiB, cold <=128 MiB,
warm P95 <=200 ms. Checksums scan once at worker initialization; subsequent
queries use indexed reads. Retain previous images, configuration and release
directories for rollback. Build YiJian and Octopus sequentially on small hosts.
