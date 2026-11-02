import type { TextTranslator } from '@/i18n/text';

const labels: Record<string, string> = {
  "先证者 BAM": "proband",
  "父亲 BAM": "father",
  "母亲 BAM": "mother",
  "联合变异 VCF": "vcf",
  "目标区域 BED": "bed",
  "原始 CNVkit CNR": "cnr",
  "该执行的归档测序证据当前不可用": "noArchive",
  "归档未提供可读取的 BAM、VCF 或目标 BED 轨迹": "noTracks",
  "BAM 已超过任务完成后 7 天保留期限，无法复核 reads": "bamExpired",
  "BAM 未归档、名称不唯一或已删除": "bamMissing",
  "BAM 索引缺失": "bamIndex",
  "VCF tabix 索引缺失": "vcfIndex",
  "IGV 参考资源配置不可用": "referenceConfig",
  "该执行的输入快照未提供参考序列身份": "referenceIdentity",
  "该参考序列未配置为可判读的 IGV 参考资源": "referenceUnsupported",
  "该执行的参考 FASTA 与 FAI 尚未配置": "referenceMissing",
  "该执行的本地参考 FASTA 与 FAI 尚未配置或不可读": "referenceLocal"
};

/** Only known application labels are translated; sample names and data remain intact. */
export function igvDisplayText(value: string, t: TextTranslator): string {
  const clean = value.replace(/[。]$/, '');
  const key = Object.hasOwn(labels, clean) ? labels[clean] : undefined;
  return key ? t(`igvDisplay.${key}`) : value;
}

/** IGV.js does not expose locale settings for its navigation controls. */
export function localizeIGVNavigation(container: HTMLElement, t: TextTranslator): void {
  const controls: Record<string, string> = {
    'cursor guide': 'cursorGuide', 'center line': 'centerLine', 'track labels': 'trackLabels',
    'sample names': 'sampleNames', 'save svg': 'saveSVG', 'circular view': 'circularView',
  };
  container.querySelectorAll<HTMLElement>('.igv-navbar .igv-navbar-button').forEach(button => {
    const label = button.textContent?.trim().toLowerCase() ?? '';
    const key = Object.hasOwn(controls, label) ? controls[label] : undefined;
    if (!key) return;
    const translated = t(`igvDisplay.${key}`);
    button.textContent = translated;
    button.setAttribute('title', translated);
    button.setAttribute('aria-label', translated);
  });
}
