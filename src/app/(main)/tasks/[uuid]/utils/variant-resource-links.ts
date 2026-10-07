import type { SNVIndel } from '../types';

export interface VariantResourceLink { label: string; href?: string; reason?: string }
export interface VariantResourceGroup { label: string; links: VariantResourceLink[] }

const encode = encodeURIComponent;
const present = (value?: string) => value && !/^(?:\.|-|na|n\/a|null|undefined)$/i.test(value.trim()) ? value.trim() : undefined;
const values = (variant: SNVIndel, fields: string[], fallback: string[] = []) => [...new Set([
  ...fields.flatMap(field => (variant.annotationValues?.[field] || '').split(/[;,|&]/)), ...fallback.flatMap(value => value.split(/[;,|&]/)),
].map(value => present(value)).filter((value): value is string => !!value))];

/** Build only explicit outbound links from public variant/gene annotations. */
export function variantResourceGroups(variant: SNVIndel, referenceGenome?: string): VariantResourceGroup[] {
  const reference = referenceGenome === 'hg19' || referenceGenome === 'hg38' ? referenceGenome : undefined;
  const chromosome = variant.chromosome.replace(/^chr/i, '').toUpperCase();
  const coordinateValid = /^(?:[1-9]|1[0-9]|2[0-2]|X|Y|M|MT)$/.test(chromosome)
    && Number.isSafeInteger(variant.position) && variant.position > 0;
  const alleleValid = coordinateValid && /^[ACGTN]+$/i.test(variant.ref) && /^[ACGTN]+$/i.test(variant.alt);
  const variantQuery = `${chromosome}:${variant.position}:${variant.ref}:${variant.alt}`;
  const unavailable = (label: string, reason = '流程未提供对应的数据库标识'): VariantResourceLink => ({ label, reason });
  const idLinks = (label: string, ids: string[], url: (id: string) => string): VariantResourceLink[] => ids.length
    ? ids.map(id => ({ label: ids.length > 1 ? `${label} · ${id}` : label, href: url(id) })) : [unavailable(label)];
  const rs = values(variant, ['RSID', 'dbSNP'], [variant.rsId || '']).filter(id => /^rs\d+$/i.test(id));
  const hgvs = values(variant, ['CLNHGVS', 'HGVS_g', 'HGVS_c'], [variant.hgvsc]).flatMap(value => {
    if (/^[A-Za-z]+_[0-9]+(?:\.[0-9]+)?:[cgmnrp]\./.test(value)) return [value];
    if (/^c\./.test(value) && /^[A-Za-z]+_[0-9]+(?:\.[0-9]+)?$/.test(variant.transcript)) return [`${variant.transcript}:${value}`];
    return [];
  });
  const genes = values(variant, ['Gene'], [variant.gene]);
  const hgnc = values(variant, ['HGNC_ID']).filter(id => /^(?:HGNC:)?\d+$/i.test(id)).map(id => `HGNC:${id.replace(/^HGNC:/i, '')}`);
  const omim = values(variant, ['OMIM_Num', 'OMIM_ID', 'OMIM', 'GenCC_disease_original_curie'], [variant.omimId || ''])
    .filter(id => /^(?:OMIM:)?\d{6}$/i.test(id)).map(id => id.replace(/^OMIM:/i, ''));
  // HPO browse/gene requires an NCBI Gene ID, not a symbol or an HGNC number.
  const hpoGene = values(variant, ['HPO_Gene', 'NCBI_Gene_ID', 'Entrez_Gene_ID', 'EntrezGene_ID']).filter(id => /^\d+$/.test(id));
  const uniparc = values(variant, ['UNIPARC', 'UniParc']).filter(id => /^UPI[0-9A-F]+$/i.test(id));
  const uniprot = values(variant, ['Uniprot_ID', 'UniProt_ID', 'SWISSPROT', 'TREMBL']).filter(id => /^[A-Z0-9]+(?:-\d+)?$/i.test(id));
  const cosmic = values(variant, ['COSMIC', 'COSMIC_ID']).filter(id => /^COS[MNV]\d+$/i.test(id));
  const pubmed = values(variant, ['PUBMED', 'PubMed', 'PMID'], variant.pubmedIds || []).map(id => id.replace(/^PMID:/i, '')).filter(id => /^\d+$/.test(id));
  const mito = /^(M|MT)$/.test(chromosome) ? values(variant, ['MitoHGVSg']) : [];
  const locusReason = reference ? '未提供兼容的变异坐标或等位基因' : '未提供明确的 hg19/hg38 参考版本';
  return [
    { label: '位点与检索', links: [
      // Franklin's legacy URL uses hg19; hg38 requires the explicit HG38 suffix.
      { label: 'Franklin', href: reference && alleleValid ? `https://franklin.genoox.com/clinical-db/variant/snp/${encode(`chr${chromosome === 'MT' ? 'M' : chromosome}-${variant.position}-${variant.ref.toUpperCase()}-${variant.alt.toUpperCase()}${reference === 'hg38' ? '-HG38' : ''}`)}` : undefined, reason: locusReason },
      { label: 'VarSome', href: reference && alleleValid ? `https://varsome.com/variant/${reference}/${encode(variantQuery)}?annotation-mode=germline` : undefined, reason: locusReason },
      { label: 'UCSC Browser', href: reference && coordinateValid ? `https://genome.ucsc.edu/cgi-bin/hgTracks?db=${reference}&lastVirtModeType=default&lastVirtModeExtraState=&virtModeType=default&virtMode=0&nonVirtPosition=&position=${encode(`chr${chromosome === 'MT' ? 'M' : chromosome}:${variant.position}-${variant.position}`)}` : undefined, reason: locusReason },
      ...idLinks('ClinVar', [...new Set(hgvs.length ? hgvs : rs)], id => `https://www.ncbi.nlm.nih.gov/clinvar/?term=${encode(id)}`),
      ...idLinks('dbSNP', rs, id => `https://www.ncbi.nlm.nih.gov/snp/${encode(id)}`),
      ...idLinks('COSMIC', cosmic, id => `https://cancer.sanger.ac.uk/cosmic/search?q=${encode(id)}#`),
      { label: 'Google', href: alleleValid ? `https://www.google.com.hk/search?q=${encode([present(variant.gene), variantQuery].filter(Boolean).join(' '))}` : undefined, reason: '未提供兼容的变异坐标' },
    ] },
    { label: '基因与蛋白', links: [
      ...idLinks('NCBI Gene', genes, id => `https://www.ncbi.nlm.nih.gov/gene/?term=${encode(id)}`),
      ...idLinks('HGNC', [...new Set(hgnc)], id => `https://www.genenames.org/data/gene-symbol-report/#!/hgnc_id/${encode(id)}`),
      ...idLinks('OMIM', [...new Set(omim)], id => `https://www.omim.org/entry/${encode(id)}`),
      ...idLinks('HPO Gene', hpoGene, id => `https://hpo.jax.org/app/browse/gene/${encode(id)}`),
      ...idLinks('UniParc', uniparc, id => `https://www.uniprot.org/uniparc/${encode(id)}/entry`),
      ...idLinks('UniProt', uniprot, id => `https://www.uniprot.org/uniprotkb/${encode(id)}/entry`),
    ] },
    { label: '文献与线粒体', links: [
      ...idLinks('PubMed', pubmed, id => `https://pubmed.ncbi.nlm.nih.gov/${encode(id)}`),
      ...idLinks('MITOMAP', mito, id => `https://www.mitomap.org/foswiki/bin/view/Main/SearchSite?search=${encode(id)}`),
    ] },
  ];
}
