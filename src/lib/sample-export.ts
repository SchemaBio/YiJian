import { GENDER_CONFIG, type Sample } from '@/app/(main)/samples/types';

const MATCH_LABELS: Record<Sample['matchStatus'], string> = {
  unmatched: '未匹配', partial: '部分匹配', conflict: '匹配冲突', matched: '已匹配', missing: '文件缺失',
};

function csvCell(value: string | number | undefined): string {
  let text = value === undefined ? '' : String(value);
  // Spreadsheet software must treat user-entered values as text, not formulas.
  if (/^[\s\uFEFF]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function sampleListCSV(samples: readonly Sample[]): string {
  const rows: Array<Array<string | number | undefined>> = [
    ['样本编号', '内部编号', '性别', '年龄', '样本类型', '批次', '临床诊断', 'HPO 表型', '数据匹配状态', 'Read1', 'Read2', '备注', '创建时间', '更新时间'],
    ...samples.map(sample => [
      sample.id, sample.internalId, GENDER_CONFIG[sample.gender].label, sample.age, sample.sampleType, sample.batch,
      sample.clinicalDiagnosis, sample.hpoTerms.map(term => `${term.id} ${term.name}`.trim()).join('; '),
      MATCH_LABELS[sample.matchStatus], sample.matchedPair?.r1Path, sample.matchedPair?.r2Path,
      sample.remark, sample.createdAt, sample.updatedAt,
    ]),
  ];
  return '\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function downloadSampleList(samples: readonly Sample[]): void {
  if (samples.length === 0) return;
  const blob = new Blob([sampleListCSV(samples)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  try {
    link.href = url;
    link.download = '样本清单.csv';
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
