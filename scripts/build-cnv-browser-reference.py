#!/usr/bin/env python3
"""Build public, immutable ClinGen dosage snapshots; never reads patient data.
Input: reviewed source manifest used by Octopus/build-assessment-reference.py.
Coordinates in ClinGen TSV are one-based inclusive; output is half-open.
"""
import argparse,csv,hashlib,json,re
from pathlib import Path

def build(manifest_file):
 manifest=json.loads(manifest_file.read_text(encoding='utf-8-sig'));reference=manifest['reference']
 if reference not in ('hg19','hg38'):raise ValueError('unsupported assembly')
 records=[];sources=[]
 for name in ('dosage_genes','dosage_regions'):
  source=manifest['sources'][name];file=(manifest_file.parent/source['file']).resolve()
  if not file.is_relative_to(manifest_file.parent.resolve()):raise ValueError('source path')
  raw=file.read_bytes()
  if hashlib.sha256(raw).hexdigest()!=source['sha256']:raise ValueError('source hash')
  sources.append(source);header=None
  for line in raw.decode('utf-8-sig').splitlines():
   if line.startswith(('#Gene Symbol','#ISCA ID')):header=line.lstrip('#').split('\t');continue
   if not line or line.startswith('#'):continue
   if not header:raise ValueError('source header')
   row=dict(zip(header,line.split('\t')));location=re.fullmatch(r'(?:chr)?([\w]+):(\d+)-(\d+)',row.get('Genomic Location',''))
   if not location:continue
   start,end=int(location[2])-1,int(location[3])
   if start<0 or end<=start:raise ValueError('source interval')
   number=lambda key:int(row[key]) if row.get(key,'').isdigit() else -1
   records.append({'reference':reference,'chromosome':location[1],'start':start,'end':end,'id':row.get('ISCA ID') or row.get('Gene Symbol'),'gene':row.get('Gene Symbol') or None,'hi':number('Haploinsufficiency Score'),'ts':number('Triplosensitivity Score'),'source':source['source']})
 if not records:raise ValueError('empty dosage resource')
 return {'version':manifest['version']+'-cnv-browser-v1','reference':reference,'coordinateSystem':'zero-based-half-open','sources':sources,'dosage':records}

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--source-dir',type=Path,required=True);parser.add_argument('--root',type=Path,default=Path('.'));args=parser.parse_args();output=args.root/'public/assessment-reference/cnv';output.mkdir(parents=True,exist_ok=True);manifest={}
 for reference in ('hg19','hg38'):
  value=build(args.source_dir/(reference+'-manifest.json'));raw=(json.dumps(value,ensure_ascii=False,separators=(',',':'))+'\n').encode();digest=hashlib.sha256(raw).hexdigest();(output/(digest+'.json')).write_bytes(raw);manifest[reference]={'sha256':digest,'url':'/assessment-reference/cnv/'+digest+'.json','version':value['version'],'bytes':len(raw)}
 (args.root/'src/lib/assessment/cnv-reference-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
if __name__=='__main__':main()
