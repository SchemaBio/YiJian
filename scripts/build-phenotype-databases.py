#!/usr/bin/env python3
"""Build immutable indexed resources from a pinned, attributed source manifest.

No patient data is read. Downloads happen outside this builder, never at runtime.
"""
import argparse, csv, hashlib, importlib.util, io, json, re, sqlite3
from pathlib import Path

LIMIT = 100_000_000

def build(manifest_path, output, ontology_builder):
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    sources = {}
    for name, entry in manifest['sources'].items():
        path = (manifest_path.parent / entry['file']).resolve()
        if not path.is_relative_to(manifest_path.parent.resolve()): raise ValueError('source outside release directory')
        raw = path.read_bytes()
        if len(raw) > LIMIT or hashlib.sha256(raw).hexdigest() != entry['sha256']: raise ValueError('source checksum/size mismatch')
        if not all(entry.get(k) for k in ('source', 'version', 'license', 'accessedAt')): raise ValueError('missing attribution')
        sources[name] = raw.decode('utf-8-sig')
    spec = importlib.util.spec_from_file_location('ontology_builder', ontology_builder)
    helper = importlib.util.module_from_spec(spec); spec.loader.exec_module(helper)
    terms = helper.ontology(sources['hpo'])
    annotations = helper.phenotype_annotations(sources['hpoa'], terms)
    names, obsolete = {}, {}
    for block in sources['hpo'].split('[Term]')[1:]:
        ident = re.search(r'^id: (HP:\d{7})$', block, re.M)
        if not ident: continue
        name = re.search(r'^name: (.+)$', block, re.M)
        if name: names[ident[1]] = name[1]
        if re.search(r'^is_obsolete: true$', block, re.M):
            replaced = re.findall(r'^replaced_by: (HP:\d{7})$', block, re.M)
            obsolete[ident[1]] = replaced[0] if len(replaced) == 1 else None
        for alias in re.findall(r'^alt_id: (HP:\d{7})$', block, re.M): obsolete[alias] = ident[1]
    output.mkdir(parents=True, exist_ok=False)
    def db(name, schema):
        conn = sqlite3.connect(output / (name + '.sqlite'))
        conn.executescript('PRAGMA journal_mode=DELETE; PRAGMA page_size=4096; ' + schema)
        return conn
    hpo = db('hpo', 'CREATE TABLE terms(id TEXT PRIMARY KEY, payload TEXT NOT NULL); CREATE TABLE obsolete(id TEXT PRIMARY KEY, replacement TEXT); CREATE TABLE diseases(gene TEXT, id TEXT, name TEXT, hpo TEXT, source TEXT, PRIMARY KEY(gene,id));')
    hpo.executemany('INSERT INTO terms VALUES(?,?)', [(id, json.dumps({**t, 'name': names.get(id, id)}, separators=(',', ':'))) for id, t in terms.items()])
    hpo.executemany('INSERT INTO obsolete VALUES(?,?)', obsolete.items())
    lines = [line for line in sources['hpoa'].splitlines() if line.strip() and not line.startswith('#')]
    titles = {r['database_id']: r.get('disease_name', r['database_id']) for r in csv.DictReader(lines, delimiter='\t')}
    links = csv.DictReader(io.StringIO(sources['gene_disease']), delimiter='\t')
    associations = {}
    for row in links:
        if row.get('association_type') != 'MENDELIAN': continue
        gene, disease = row['gene_symbol'], row['disease_id']
        if gene and disease in annotations:
            associations[(gene, disease)] = (gene, disease, titles.get(disease, disease), json.dumps(sorted(annotations[disease])), row.get('source') or manifest['sources']['gene_disease']['source'])
    if not associations: raise ValueError('no HPO gene disease associations')
    hpo.executemany('INSERT INTO diseases VALUES(?,?,?,?,?)', associations.values())
    hgnc = db('hgnc', 'CREATE TABLE genes(symbol TEXT PRIMARY KEY, hgnc TEXT, ncbi TEXT); CREATE TABLE aliases(alias TEXT, symbol TEXT, PRIMARY KEY(alias,symbol));')
    gene_count = 0
    for row in csv.DictReader(io.StringIO(sources['hgnc']), delimiter='\t'):
        if row.get('status') != 'Approved': continue
        symbol = row['symbol']; gene_count += 1
        hgnc.execute('INSERT INTO genes VALUES(?,?,?)', (symbol, row['hgnc_id'], row.get('entrez_id')))
        aliases = {symbol, row['hgnc_id'], *(row.get('alias_symbol') or '').split('|'), *(row.get('prev_symbol') or '').split('|')}
        if row.get('entrez_id'): aliases.add('NCBIGene:' + row['entrez_id'])
        hgnc.executemany('INSERT OR IGNORE INTO aliases VALUES(?,?)', [(a, symbol) for a in aliases if a])
    if gene_count < 10000: raise ValueError('incomplete HGNC source')
    clingen = db('clingen', 'CREATE TABLE validity(gene TEXT, disease TEXT, payload TEXT, PRIMARY KEY(gene,disease)); CREATE TABLE dosage(reference TEXT, chromosome TEXT, start INTEGER, end INTEGER, payload TEXT); CREATE INDEX dosage_interval ON dosage(reference,chromosome,start);')
    for reference in ('hg19', 'hg38'):
        pack = json.loads(sources['pack_' + reference])
        for disease in pack['diseases']:
            clingen.execute('INSERT OR REPLACE INTO validity VALUES(?,?,?)', (disease['gene'], disease['id'], json.dumps(disease, separators=(',', ':'))))
        clingen.executemany('INSERT INTO dosage VALUES(?,?,?,?,?)', [(r['reference'], r['chromosome'], r['start'], r['end'], json.dumps(r, separators=(',', ':'))) for r in pack['dosage']])
    for conn in (hpo, hgnc, clingen): conn.commit(); conn.execute('VACUUM'); conn.close()
    files = {}
    for path in output.glob('*.sqlite'):
        if path.stat().st_size > LIMIT: raise ValueError('database exceeds 100 MB: ' + path.name)
        files[path.name] = {'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
    release = {'schema': 1, 'version': manifest['version'], 'files': files, 'sources': manifest['sources'], 'counts': {'hpoTerms': len(terms), 'geneDiseases': len(associations), 'genes': gene_count}}
    release['digest'] = hashlib.sha256(json.dumps(release, sort_keys=True).encode()).hexdigest()
    (output / 'manifest.json').write_text(json.dumps(release, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({k: release[k] for k in ('version', 'files', 'counts', 'digest')}))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--manifest', type=Path, required=True); parser.add_argument('--output', type=Path, required=True); parser.add_argument('--ontology-builder', type=Path, required=True)
    args = parser.parse_args(); build(args.manifest, args.output, args.ontology_builder)
