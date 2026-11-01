'use client';

import { Download, Dna } from 'lucide-react';
import { useText } from '@/i18n/useText';

const references = [
  { label: 'GRCh38 (hg38)', directory: 'hg38', filename: 'Homo_sapiens.GRCh38.dna.primary_assembly.fa.gz' },
  { label: 'GRCh37 (hg19)', directory: 'hg19', filename: 'Homo_sapiens.GRCh37.dna.primary_assembly.fa.gz' },
] as const;

export function ReferenceGenomeDownloads() {
  const t = useText();

  return (
    <section className="yj-panel p-4 sm:p-5" aria-labelledby="reference-genome-downloads-title">
      <div className="flex items-start gap-3">
        <Dna className="mt-0.5 h-5 w-5 shrink-0 text-fg-muted" aria-hidden="true" />
        <div>
          <h3 id="reference-genome-downloads-title" className="text-sm font-semibold text-fg-default">{t('referenceGenomes.title')}</h3>
          <p className="mt-1 text-sm text-fg-muted">{t('referenceGenomes.description')}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {references.map(reference => (
          <div key={reference.directory} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-fg-default">{reference.label}</p>
              <p className="mt-1 break-all text-xs text-fg-muted">{reference.filename}</p>
            </div>
            <a
              href={`https://huggingface.co/datasets/pzweuj/SchemaBio_Bundle/resolve/main/${reference.directory}/${reference.filename}?download=true`}
              target="_blank"
              rel="noopener noreferrer"
              className="yj-tool-button inline-flex shrink-0 items-center gap-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              aria-label={`${t('referenceGenomes.download')} ${reference.label}`}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {t('referenceGenomes.download')}
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
