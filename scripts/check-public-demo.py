"""Validate the shipped public demo without any API or storage credentials."""
import collections
import hashlib
import json
import re
import argparse
from pathlib import Path
import pyarrow.parquet as pq
from importlib.util import module_from_spec, spec_from_file_location

root = Path(__file__).resolve().parents[1]
spec = spec_from_file_location('builder', root / 'scripts/build-public-demo.py')
builder = module_from_spec(spec)
spec.loader.exec_module(builder)
directory = root / 'public/demo' / builder.VERSION
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', type=Path)
args = parser.parse_args()
m = json.loads((directory / 'manifest.json').read_text(encoding='utf-8'))
assert m['source']['template'] == builder.TEMPLATE
assert m['requiredVariant'] == builder.REQUIRED
assert m['source']['reference'] == builder.REQUIRED['reference']
total = 0
for f in m['files']:
    assert re.fullmatch('[a-z0-9-]+[.]parquet', f['file'])
    data = (directory / f['file']).read_bytes()
    assert len(data) == f['bytes'] and hashlib.sha256(data).hexdigest() == f['sha256'], f['id']
    table = pq.read_table(directory / f['file'])
    assert table.num_rows == f['rows'] and table.column_names == f['columns'], f['id']
    rows = table.to_pylist()
    counts = collections.Counter(str(r.get('Chromosome', '')).removeprefix('chr') for r in rows)
    assert dict(counts) == f['chromosomes']
    if f['id'] == 'snv-indel':
        assert max(counts.values()) <= 1000
        required = [r for r in rows if builder.required(r)]
        assert len(required) == 1 and required[0]['HGVS_p'] == 'p.Arg672His'
        assert required[0]['Genotype'] == '0/1' and required[0]['ClinVar_Sig'] == 'Pathogenic'
    if args.source and f['id'] == 'cnv-gene':
        # Independent comparison with the backend's documented positional schema.
        # Col8 is exon count; Col12 is absolute CN, never an exon count or ratio.
        originals = pq.read_table(args.source / 'gene.cnvanno.parquet').to_pylist()
        def key(row, original=False):
            return tuple(row[c] for c in (['Chromosome','Start','End','Col5','Col6'] if original else ['Chromosome','Start','End','Gene','Transcript']))
        lookup = collections.defaultdict(list)
        for row in originals:
            lookup[key(row, True)].append(row)
        for row in rows:
            assert any(row['Copy_Number'] == o['Col12'] and row['Exon_Count'] == o['Col8'] and row['Log2_Ratio'] == o['Col9'] for o in lookup[key(row)])
    payload = json.dumps(rows, default=str)
    assert not re.search(r'https?://|s3://|cos://|example://|/home/|/data/|Bearer |access_token|secret_key', payload, re.I)
    total += len(data)
assert {p.name for p in directory.iterdir()} == {'manifest.json', *(f['file'] for f in m['files'])}
print(json.dumps({'status':'passed','parquetBytes':total,'tables':len(m['files']),'requiredVariant':m['requiredVariant']}))
