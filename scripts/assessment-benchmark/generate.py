"""Generate disposable, deterministic synthetic Parquet/context fixtures. No clinical data."""
import hashlib
import json
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '.assessment-benchmark' / 'fixtures'
TABLES = ['snv-indel', 'cnv-segment', 'cnv-exon', 'str', 'mei', 'mt', 'upd', 'roh']


def digest(value):
    return hashlib.sha256(value).hexdigest()


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')


manifest = {'version': 'synthetic-browser-benchmark-v1', 'clinical': False, 'pyarrowVersion': pa.__version__,
            'cnvReferenceManifest': json.loads((ROOT / 'src/lib/assessment/cnv-reference-manifest.json').read_text(encoding='utf-8')),
            'fixtures': {}}
for size in [10000, 50000, 100000]:
    folder = OUT / str(size)
    folder.mkdir(parents=True, exist_ok=True)
    pack = {'version': 'synthetic-v1', 'reference': 'hg19', 'licenses': [{'source': 'synthetic', 'license': 'CC0', 'accessedAt': '2026-10-28'}],
            'hpo': {'HP:0001250': {'id': 'HP:0001250', 'ic': 4, 'ancestors': ['HP:0000118']},
                    'HP:0000118': {'id': 'HP:0000118', 'ic': 0, 'ancestors': []}},
            'diseases': [], 'dosage': [], 'str': [], 'imprinting': []}
    for n in range(80):
        interval = {'reference': 'hg19', 'chromosome': str(n % 2 + 1), 'start': 1000 + n * 100, 'end': 1050 + n * 100}
        pack['dosage'].append({**interval, 'id': f'd{n}', 'gene': f'G{n}', 'hi': 3 if n % 3 == 0 else 0, 'ts': 3 if n % 3 == 1 else 0, 'source': 'synthetic'})
        pack['str'].append({**interval, 'id': f's{n}', 'gene': f'G{n}', 'motif': 'CAG', 'pathogenicMin': 40, 'source': 'synthetic'})
        pack['imprinting'].append({**interval, 'id': f'i{n}', 'gene': f'G{n}', 'source': 'synthetic'})
        pack['diseases'].append({'id': f'D{n}', 'gene': f'G{n}', 'hpo': ['HP:0001250'], 'validity': 'Strong', 'inheritance': 'AR'})
    context = {'taskId': f'synthetic-{size}', 'attemptId': 'synthetic-attempt-v1', 'version': 'synthetic-context-v1', 'reference': 'hg19',
               'hpo': ['HP:0001250'], 'hpoVersion': 'synthetic-hpo-v1', 'referenceVersion': 'synthetic-reference-v1',
               'members': [], 'availability': [], 'proofs': {}, 'pack': pack, 'tables': TABLES}
    rows = {name: [] for name in TABLES}
    for i in range(size):
        n = i % 80
        table = TABLES[i % len(TABLES)]
        start, end = 1000 + n * 100 - i % 3, 1050 + n * 100 + i % 5
        loss = i % 3 != 0
        rows[table].append({'Gene': f'G{n}', 'Filter': 'PASS', 'Type': 'SNP' if table == 'snv-indel' else ('DEL' if loss else 'DUP'),
                            'Transcript': 'SYNTHETIC', 'Consequence': 'stop_gained' if i % 3 == 0 else 'missense_variant', 'AlphaMissense_AM': .99,
                            'Repeat_Unit': 'CAG', 'Allele1_Repeats': 45, 'Chromosome': str(n % 2 + 1), 'Start': start, 'End': end,
                            'Col4': 'DEL' if loss else 'DUP', 'Col5': f'G{n}', 'Col6': -1.0 if loss else .58, 'Col7': 30, 'Col8': 12,
                            **{f'Synthetic_Unused_Annotation_{j}': digest(f'{i}/{j}/benchmark-v1'.encode()) for j in range(4)}})
    datasets = {}
    for name, values in rows.items():
        path = folder / f'{name}.parquet'
        pq.write_table(pa.Table.from_pylist(values), path, compression='zstd', row_group_size=5000)
        sha = digest(path.read_bytes())
        dataset_id = f'synthetic-{size}-{name}'
        info = {'dataset': {'id': dataset_id, 'executionAttemptId': context['attemptId'], 'dataVersion': 'synthetic-data-v1',
                            'objectSha256': sha, 'rows': len(values), 'expectedRows': len(values), 'automaticAssessmentProfile': 'synthetic'},
                'url': f'/fixtures/{size}/{name}.parquet', 'expiresAt': '2099-01-01T00:00:00Z',
                'columns': list(values[0]), 'aliases': {'Gene': ['gene'], 'Start': ['startPosition'], 'End': ['endPosition']}}
        write_json(folder / f'{name}.info.json', {'data': info})
        datasets[name] = {'rows': len(values), 'sha256': sha, 'bytes': path.stat().st_size}
        for ordinal, row in enumerate(values):
            row_id = digest(f'{dataset_id}/{sha}/{ordinal}'.encode())
            proof = {'reference': 'hg19', 'interval': {'reference': 'hg19', 'chromosome': row['Chromosome'], 'start': row['Start'], 'end': row['End']},
                     'qualityPassed': True, 'proband': {'gt': '1/1', 'dp': 30, 'gq': 40, 'ad': [0, 30]},
                     'frequency': [{'population': 'global', 'af': 0, 'an': 10000, 'pass': True}],
                     'populationRule': {'code': 'PM2', 'strength': 'supporting', 'maxAF': .001, 'minAN': 1000, 'source': 'synthetic'}}
            if name == 'snv-indel' and row['Consequence'] == 'stop_gained':
                proof['pvs1'] = {'strength': 'very_strong', 'nmdApplicable': True, 'relevantTranscript': True, 'source': 'synthetic'}
            context['proofs'][row_id] = proof
    write_json(folder / 'context.json', {'data': {'active': context, 'latestVersion': context['version'], 'reassessmentAvailable': False}})
    manifest['fixtures'][str(size)] = {'tables': datasets, 'contextSha256': digest((folder / 'context.json').read_bytes())}
write_json(OUT / 'manifest.json', manifest)
print(json.dumps({'version': manifest['version'], 'sizes': list(manifest['fixtures']), 'output': str(OUT)}))
