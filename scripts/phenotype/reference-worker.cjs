'use strict';
const { parentPort, workerData } = require('node:worker_threads');
// Load this built-in at runtime: Turbopack's CommonJS external resolver does
// not yet understand node:sqlite when it bundles a Node worker entry point.
const { DatabaseSync } = process.getBuiltinModule('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = workerData.directory;
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
if (manifest.schema !== 1 || !/^[a-f0-9]{64}$/.test(manifest.digest)) throw Error('Invalid resource manifest');
const connections = new Map();
for (const name of ['hpo', 'hgnc', 'clingen']) {
  const filename = name + '.sqlite', info = manifest.files[filename], file = path.join(root, filename);
  if (!info || fs.statSync(file).size !== info.bytes || info.bytes > 100000000) throw Error('Resource size mismatch');
  const hash = crypto.createHash('sha256'), buffer = Buffer.alloc(1024 * 1024), fd = fs.openSync(file, 'r');
  try { let n; while ((n = fs.readSync(fd, buffer, 0, buffer.length, null))) hash.update(buffer.subarray(0, n)); } finally { fs.closeSync(fd); }
  if (hash.digest('hex') !== info.sha256) throw Error('Resource checksum mismatch');
  const db = new DatabaseSync(file, { readOnly: true });
  db.exec('PRAGMA query_only=ON; PRAGMA cache_size=-4096; PRAGMA mmap_size=0; PRAGMA temp_store=MEMORY;');
  connections.set(name, db);
}
const hpo = connections.get('hpo'), hgnc = connections.get('hgnc'), clingen = connections.get('clingen');
const termQuery = hpo.prepare('SELECT payload FROM terms WHERE id=?');
const obsoleteQuery = hpo.prepare('SELECT replacement FROM obsolete WHERE id=?');
const symbolQuery = hgnc.prepare('SELECT symbol FROM genes WHERE symbol=?');
const aliasQuery = hgnc.prepare('SELECT symbol FROM aliases WHERE alias=?');
const diseaseQuery = hpo.prepare('SELECT id,name,hpo,source FROM diseases WHERE gene=? ORDER BY id');
const backgroundQuery = clingen.prepare('SELECT payload FROM validity WHERE gene=? ORDER BY disease');
// Bounded LRU includes only public term rows. Patient HPO and scores are never cached globally.
const terms = new Map(); let termBytes = 0;
function term(id) {
  if (terms.has(id)) { const value = terms.get(id); terms.delete(id); terms.set(id, value); return value.value; }
  const row = termQuery.get(id); if (!row) return undefined;
  const value = JSON.parse(row.payload), bytes = Buffer.byteLength(row.payload) * 3;
  while (termBytes + bytes > 8 * 1024 * 1024 && terms.size) { const key = terms.keys().next().value; termBytes -= terms.get(key).bytes; terms.delete(key); }
  if (bytes <= 8 * 1024 * 1024) { terms.set(id, { value, bytes }); termBytes += bytes; }
  return value;
}
function matcher(sample) {
  // Build patient ancestor weights once. Share target similarities across all
  // diseases/genes within this one request, then release them (no patient cache).
  const weights=sample.map(a=>new Map([a.id,...a.ancestors].map(id=>[id,term(id)?.ic||0])));
  const scores=new Map();
  const similarity=b=>{
    let value=scores.get(b.id);if(value)return value;
    value=sample.map((a,i)=>{
      let ic=weights[i].get(b.id)||0;
      for(const id of b.ancestors)ic=Math.max(ic,weights[i].get(id)||0);
      return a.ic+b.ic>0?Math.min(1,2*ic/(a.ic+b.ic)):0;
    });scores.set(b.id,value);return value;
  };
  return target=>{
  if (!sample.length || !target.length) return { score: 0, eligible: false, matched: [] };
  const forward=sample.map(()=>0),reverse=[];
  for(const b of target){const values=similarity(b);let best=0;for(let i=0;i<values.length;i++){forward[i]=Math.max(forward[i],values[i]);best=Math.max(best,values[i]);}reverse.push(best);}
  const score = (forward.reduce((a,b)=>a+b,0)/forward.length + reverse.reduce((a,b)=>a+b,0)/reverse.length)/2;
  const informative = sample.filter((a,i)=>forward[i]>=0.5 && a.ic>=2);
  const eligible = score >= 0.5 && (informative.length >= 2 || sample.some((a,i)=>forward[i]>=0.5 && a.ic>=4));
  return { score, eligible, matched: sample.filter((a,i)=>forward[i]>=0.5).map(a=>({id:a.id,name:a.name})) };
  };
}
parentPort.on('message', ({ id, request }) => {
  try {
    if (request.resourceVersion && request.resourceVersion !== manifest.digest) throw Error('REFERENCE_VERSION_CHANGED');
    if(request.hpo.length>128)throw Error('HPO_LIMIT_EXCEEDED');
    const warnings = [], sample = [];
    for (const id of [...new Set(request.hpo)]) {
      let value = term(id);
      if (!value) { const old = obsoleteQuery.get(id); if (old?.replacement) value = term(old.replacement); warnings.push({id, replacement:old?.replacement || undefined}); }
      if (value && !sample.some(v=>v.id===value.id)) sample.push(value);
    }
    const matches = {}, canonical = {}, background = {};
    const match=matcher(sample);
    if(request.rank){
      // Scan public associations once per authorized context, retaining only
      // the strongest disease per gene. No patient scores survive this request.
      const best=new Map();
      if(sample.length)for(const disease of hpo.prepare('SELECT gene,id,name,hpo,source FROM diseases ORDER BY gene,id').iterate()){
        const result=match(JSON.parse(disease.hpo).map(term).filter(Boolean));
        if(result.eligible && (!best.has(disease.gene)||best.get(disease.gene).score<result.score))best.set(disease.gene,{...result,gene:disease.gene,diseaseId:disease.id,diseaseName:disease.name,source:disease.source});
      }
      const geneRanking=[...best.values()].sort((a,b)=>b.score-a.score||a.gene.localeCompare(b.gene)).slice(0,200);
      parentPort.postMessage({id,value:{resourceVersion:manifest.digest,version:manifest.version,canonical,matches,background,warnings,geneRanking}});return;
    }
    // Cursor is a gene offset; a gene's complete disease result is never truncated.
    let next = request.cursor || 0, used = 0;
    for (; next < request.genes.length; next++) {
      const input = request.genes[next], direct = symbolQuery.get(input);
      const aliases = direct ? [direct] : aliasQuery.all(input);
      if (aliases.length !== 1) { canonical[input] = null; continue; }
      const gene = aliases[0].symbol;
      const found = [];
      for (const disease of diseaseQuery.iterate(gene)) {
        const target = JSON.parse(disease.hpo).map(term).filter(Boolean), result = match(target);
        if (result.score > 0) found.push({ ...result, gene, diseaseId:disease.id, diseaseName:disease.name, source:disease.source });
      }
      found.sort((a,b)=>b.score-a.score || a.diseaseId.localeCompare(b.diseaseId));
      const bg = backgroundQuery.all(gene).map(r=>{const d=JSON.parse(r.payload);return {id:d.id,validity:d.validity,inheritance:d.inheritance,source:d.source};});
      const bytes = Buffer.byteLength(JSON.stringify({input,gene,found,bg}));
      if (used + bytes > 900000 && used) break;
      if (bytes > 900000) throw Error('GENE_RESULT_EXCEEDS_LIMIT');
      canonical[input] = gene; matches[gene] = found; background[gene] = bg; used += bytes;
    }
    parentPort.postMessage({id,value:{resourceVersion:manifest.digest,version:manifest.version,canonical,matches,background,warnings,nextCursor:next<request.genes.length?next:undefined}});
  } catch (error) { parentPort.postMessage({id,error:error.message}); }
});
