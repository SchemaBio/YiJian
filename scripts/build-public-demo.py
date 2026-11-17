"""Build an immutable, offline demo from the curated HG002/MYH3 template.

Requires pyarrow. Inputs are private local downloads, never production URLs.
Usage: python scripts/build-public-demo.py --source .gotmp/public-demo-source
"""
import argparse
import collections
import hashlib
import json
import re
from pathlib import Path
import pyarrow as pa
import pyarrow.parquet as pq

VERSION = 'hg002-myh3-20261117-v1'
TEMPLATE = 'hg002-myh3-hg38-20261110-v1'
REQUIRED = dict(reference='hg38', chromosome='17', position=10641317, ref='C', alt='T', gene='MYH3')
SEED = 'yijian-public-demo-v1'
INPUTS = [
    ('snv-indel', 'SNV / InDel', 'snv_indel.parquet', '0963b13b49656344853f2dad78bad444bb048689b41e931044ba92336fec0ddc'),
    ('cnv-gene', 'CNV · Gene', 'gene.cnvanno.parquet', 'a6f90c667fe4032c8360cf6ed0a54d9d444e18cb49cbf5a1e1c85bbf0f2ae3c2'),
    ('cnv-region', 'CNV · Region', 'region.cnvanno.parquet', 'c8fabfc73f10f5b6459bc201896e38415e93fdc218d50bae99d1c29eac40def0'),
    ('str', 'STR', 'str.parquet', '802e57eec59a243a63ca5732ce6aeb4ee1339f008423f90614be8dc48a9de34c'),
    ('mt', 'MT', 'mt_report.parquet', '43c73ef0015829ef21f72fb62a57e028c4f86909f7728873e42b2ad30e8e0f28'),
]

def required(row):
    return str(row['Chromosome']).removeprefix('chr') == REQUIRED['chromosome'] and int(row['Position']) == REQUIRED['position'] and row['Ref'] == REQUIRED['ref'] and row['Alt'] == REQUIRED['alt'] and row['Gene'] == REQUIRED['gene']

def rank(row):
    return hashlib.sha256((SEED + json.dumps(row, sort_keys=True, ensure_ascii=True, default=str)).encode()).hexdigest()

def sample(rows, per_chromosome):
    groups = collections.defaultdict(list)
    for i, row in enumerate(rows):
        groups[str(row.get('Chromosome', '')).removeprefix('chr')].append((i, row))
    selected = set()
    for group in groups.values():
        mandatory = [(i, r) for i, r in group if per_chromosome and required(r)]
        remaining = sorted(((i, r) for i, r in group if (i, r) not in mandatory), key=lambda x: rank(x[1]))
        selected.update(i for i, _ in mandatory + remaining[:max(0, 1000 - len(mandatory))])
    return sorted(selected)

def build(source, output):
    metadata = json.loads((source / 'metadata.json').read_text())
    if metadata['template'] != TEMPLATE or metadata['reference'] != REQUIRED['reference']:
        raise ValueError('Unexpected source template/reference; do not substitute a test fixture')
    prepared = []
    for id, label, name, expected in INPUTS:
        data = (source / name).read_bytes()
        if hashlib.sha256(data).hexdigest() != expected:
            raise ValueError('Source checksum mismatch: ' + name)
        table = pq.read_table(source / name)
        # Preserve CNV positional fields using the source result schema's labels.
        aliases = ({'Col4':'Type','Col5':'Gene','Col6':'Transcript','Col7':'Ensembl_Transcript','Col8':'Exon_Count','Col9':'Log2_Ratio','Col10':'Log2_Median','Col11':'Log2_Std','Col12':'Copy_Number','Col13':'Depth','Col14':'Weight','Col15':'Bin_Count','Col16':'Segment_Count','Col17':'Coverage_Ratio','Col18':'Confidence','Col19':'P_Value'} if id == 'cnv-gene' else {'Col4':'Type','Col5':'Log2_Ratio','Col7':'Confidence','Col8':'Copy_Number'}) if id.startswith('cnv-') else {}
        table = table.rename_columns([aliases.get(c,c) for c in table.column_names])
        table = table.select([c for c in table.column_names if not re.search(r'url|path$|sample_id|fingerprint|savedby|reviewedby|focusedby', c, re.I)])
        rows = table.to_pylist()
        if id == 'snv-indel':
            matches = [r for r in rows if required(r)]
            if len(matches) != 1 or matches[0]['HGVS_p'] != 'p.Arg672His' or matches[0]['ClinVar_Sig'] != 'Pathogenic':
                raise ValueError('The curated MYH3 variant is missing or ambiguous')
            indices = sample(rows, True)
        elif id.startswith('cnv-'):
            # Keep up to 1000 representative records overall for each CNV table.
            indices = sorted(sorted(range(len(rows)), key=lambda i: rank(rows[i]))[:1000])
        else:
            indices = list(range(len(rows)))
        result = table.take(pa.array(indices, type=pa.int64()))
        # Keep whole rows: genotype/AD/DP and any family columns stay together.
        if id == 'snv-indel' and sum(required(r) for r in result.to_pylist()) != 1:
            raise ValueError('Required variant was lost in sampling')
        payload = json.dumps(result.to_pylist(), ensure_ascii=True, default=str)
        if re.search(r'https?://|s3://|cos://|example://|/home/|/data/|Bearer |access_token|secret_key', payload, re.I):
            raise ValueError('Non-public provenance detected: ' + name)
        prepared.append((id, label, result, len(rows), collections.Counter(str(r.get('Chromosome', '')).removeprefix('chr') for r in result.to_pylist())))
    output.mkdir(parents=True, exist_ok=True)
    files = []
    for id, label, table, original, chromosomes in prepared:
        filename = id + '.parquet'
        target = output / filename
        pq.write_table(table, target, compression='zstd', compression_level=9, version='2.6', write_statistics=True)
        data = target.read_bytes()
        files.append(dict(id=id, label=label, file=filename, bytes=len(data), sha256=hashlib.sha256(data).hexdigest(), rows=table.num_rows, originalRows=original, columns=table.column_names, chromosomes=dict(sorted(chromosomes.items()))))
    manifest = dict(version=VERSION, source=dict(template=TEMPLATE, revision='c6da6c2a064b9efa47deb4100d8a277f5b3275fa', reference=metadata['reference'], pipeline=metadata['pipeline']), sample=dict(name='HG002 · MYH3', description='Constructed HG002 demonstration case', sex=metadata['sex'], age=metadata['age'], hpo=metadata['hpo']), qc=metadata['qc'], requiredVariant=REQUIRED, sampling=dict(seed=SEED, snvPerChromosome=1000, cnvPerTable=1000), files=files)
    (output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(dict(version=VERSION, bytes=sum(f['bytes'] for f in files), rows={f['id']: f['rows'] for f in files}, requiredVariant=REQUIRED)))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=Path('public/demo') / VERSION)
    args = parser.parse_args()
    build(args.source, args.output)
