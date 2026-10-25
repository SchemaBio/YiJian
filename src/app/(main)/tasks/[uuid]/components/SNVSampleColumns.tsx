import * as React from 'react';
import type { Column } from '@schema/ui-kit';
import { HoverHint } from '@/components/shared/HoverHint';
import { formatNumericString } from '@/i18n/format';
import type { TextTranslator } from '@/i18n/text';
import type { SNVSampleMetrics, SNVZygosity } from '@/lib/snv-sample-metrics';
import type { SNVIndel } from '../types';

export function formatSampleVaf(value: number | undefined, t: TextTranslator): string {
  return value === undefined || !Number.isFinite(value) || value < 0 || value > 1
    ? t('history.notProvided071fb2') : formatNumericString((value*100).toFixed(1), t.locale)+'%';
}
export function sampleZygosityLabel(value: SNVZygosity, t: TextTranslator): string {
  const keys = {Reference:'tasks.referenceGenotype', Heterozygous:'tasks.heterozygous0eee7c', Homozygous:'tasks.homozygousf691c3', Hemizygous:'tasks.hemizygous75566a', Unknown:'history.notProvided071fb2'};
  return t(keys[value]);
}
export function snvSampleColumns(family: boolean, t: TextTranslator): Column<SNVIndel>[] {
  const roles = family ? ['proband','father','mother'] as const : ['proband'] as const;
  return roles.flatMap(role => {
    const sample = (row: SNVIndel): SNVSampleMetrics => row[role] ?? {zygosity: role==='proband' ? row.zygosity : 'Unknown', alleleFrequency: role==='proband' ? row.alleleFrequency : undefined};
    const isProband = role === 'proband';
    return [{
      id: isProband ? 'zygosity' : role+'Zygosity',
      header: family ? t('tasks.'+role+'Zygosity') : t('tasks.zygosity50c147'),
      accessor: (row: SNVIndel) => {
        const value = sample(row);
        const colors = {Heterozygous:'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200', Homozygous:'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200', Hemizygous:'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-200', Reference:'border-border-default bg-canvas-inset text-fg-muted', Unknown:'border-border-default bg-canvas-inset text-fg-muted'};
        return <HoverHint content={value.genotype ?? t('history.notProvided071fb2')}><span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${colors[value.zygosity]}`}>{sampleZygosityLabel(value.zygosity,t)}</span></HoverHint>;
      }, width:110, align:'center' as const,
    },{
      id: isProband ? 'alleleFrequency' : role+'AlleleFrequency',
      header: family ? t('tasks.'+role+'Vaf') : 'VAF',
      accessor: (row: SNVIndel) => {
        const value=sample(row);
        return <HoverHint content={value.vafSource==='ad' ? t('tasks.sampleVafFromAd',{p0:value.alleleDepth ?? '-'}) : t('tasks.sampleVafReported')}><span className="font-mono tabular-nums text-accent-fg">{formatSampleVaf(value.alleleFrequency,t)}</span></HoverHint>;
      }, width:110, align:'center' as const, sortable:true,
    }];
  });
}
