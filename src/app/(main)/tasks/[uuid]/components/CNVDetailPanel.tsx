'use client';

import * as React from 'react';
import { WorkspaceInspector, InspectorTabs, type InspectorSection } from '@/components/shared/WorkspaceInspector';
import { CNVRegionPlot } from './CNVRegionPlot';
import { CNVExonPlot } from './CNVExonPlot';
import { X, ExternalLink, FileText, Database, Dna, MapPin } from 'lucide-react';
import { getClassificationLabel, formatScore } from '../utils/pathogenicity-classifier';
import { Tag } from '@schema/ui-kit';
import type { CNVSegment, CNVExon } from '../types';

interface CNVDetailPanelProps {
  variant: CNVSegment | CNVExon | null;
  variantType: 'segment' | 'exon';
  isOpen: boolean;
  onClose: () => void;
  allSegments?: CNVSegment[];  // 保留旧调用方兼容；区域图从完整本地数据集查询
  referenceId?: string;
  taskId?: string;
  onOpenAssessment?: (variant: CNVSegment | CNVExon) => void;
}

function geneCardsURL(gene: string): string {
  return `https://www.genecards.org/cgi-bin/carddisp.pl?gene=${encodeURIComponent(String(gene).trim())}`;
}

function ucscDatabase(referenceId?: string): 'hg19' | 'hg38' | null {
  const normalized = referenceId?.trim().toLowerCase();
  if (normalized === 'hg19' || normalized === 'grch37') return 'hg19';
  if (normalized === 'hg38' || normalized === 'grch38') return 'hg38';
  return null;
}

function ucscRegionURL(database: 'hg19' | 'hg38', chromosome: string, startPosition: number, endPosition: number): string {
  const position = `${chromosome}:${startPosition}-${endPosition}`;
  return `https://genome.ucsc.edu/cgi-bin/hgTracks?db=${database}&position=${encodeURIComponent(position)}`;
}

function ensemblRegionURL(chromosome: string, startPosition: number, endPosition: number): string {
  const region = `${chromosome.replace(/^chr/i, '')}:${startPosition}-${endPosition}`;
  return `https://www.ensembl.org/Homo_sapiens/Location/View?r=${encodeURIComponent(region)}`;
}

function cnvTypeLabel(type: CNVSegment['type']): string {
  if (type === 'Amplification') return '扩增';
  if (type === 'Deletion') return '缺失';
  if (type === 'Normal') return '正常';
  return '未提供';
}

function cnvTypeVariant(type: CNVSegment['type']): 'danger' | 'info' | 'neutral' {
  if (type === 'Amplification') return 'danger';
  if (type === 'Deletion') return 'info';
  return 'neutral';
}

// 信息项组件
function InfoItem({ label, value, link }: { label: string; value?: React.ReactNode; link?: string }) {
  if (value === undefined || value === null || value === '' || value === '-') {
    return (
      <div className="flex justify-between py-1.5 border-b border-border-subtle last:border-0">
        <span className="text-fg-muted text-sm">{label}</span>
        <span className="text-fg-subtle text-sm">-</span>
      </div>
    );
  }

  return (
    <div className="flex justify-between py-1.5 border-b border-border-subtle last:border-0">
      <span className="text-fg-muted text-sm">{label}</span>
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-fg text-sm hover:underline flex items-center gap-1"
        >
          {value}
          <ExternalLink className="w-3 h-3" />
        </a>
      ) : (
        <span className="text-fg-default text-sm font-medium">{value}</span>
      )}
    </div>
  );
}

// 分组标题组件
function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-5 first:mt-0">
      <Icon className="w-4 h-4 text-fg-muted" />
      <h4 className="text-sm font-medium text-fg-default">{title}</h4>
    </div>
  );
}

// 格式化长度显示
function formatLength(length: number): string {
  if (length >= 1000000) return `${(length / 1000000).toFixed(2)} Mb`;
  if (length >= 1000) return `${(length / 1000).toFixed(1)} kb`;
  return `${length} bp`;
}

// 拖动 Hook
function isCNVExon(variant: CNVSegment | CNVExon): variant is CNVExon {
  return 'gene' in variant;
}

export function CNVDetailPanel({ variant, variantType, isOpen, onClose, referenceId, taskId, onOpenAssessment }: CNVDetailPanelProps) {
  const [section, setSection] = React.useState<InspectorSection>('annotation');
  const [plotOpen, setPlotOpen] = React.useState(false);
  React.useEffect(() => { setPlotOpen(false); setSection('annotation'); }, [variant?.id, isOpen]);
  if (!isOpen || !variant) return null;

  const isExon = isCNVExon(variant);
  const exonRatio = isExon ? variant.ratio : null;
  const showPlot = variantType === 'segment' && Boolean(taskId);
  const typeVariant = cnvTypeVariant(variant.type);
  const typeLabel = cnvTypeLabel(variant.type);
  const externalReference = ucscDatabase(referenceId);

  return (
    <>
      <WorkspaceInspector label="变异详情" onClose={onClose}>
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-canvas-subtle">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-medium text-fg-default">
              {variantType === 'exon' ? 'CNV外显子详情' : 'CNV区域详情'}
            </h3>
            <Tag variant={typeVariant}>
              {typeLabel}
            </Tag>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-fg-muted hover:text-fg-default hover:bg-canvas-inset rounded transition-colors"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="yj-inspector-summary">
          <strong className="text-fg-default">{variant.chromosome}:{variant.startPosition}–{variant.endPosition}</strong>
          <p className="mt-1">{variant.assessment?.assessmentState === 'insufficient_evidence' ? '证据不足' : variant.assessment ? getClassificationLabel(variant.assessment.classification) : '尚未评定'} · {variant.assessment ? `${formatScore(variant.assessment.totalScore)} 分` : '—'}</p>
        </div>
        {/* 内容区域 */}
        <InspectorTabs id="variant-inspector" value={section} onChange={setSection} />
        <div id="variant-inspector-content" role="tabpanel" aria-labelledby={`variant-inspector-${section}`} className="yj-inspector-content">
          <section hidden={section !== 'assessment'} >
          <div className="mb-3 flex flex-wrap gap-2">
            {onOpenAssessment && (variant.type === 'Deletion' || variant.type === 'Amplification') && <button type="button" onClick={() => onOpenAssessment(variant)} className="rounded-md bg-accent-emphasis px-3 py-2 text-sm text-fg-on-emphasis">ClinGen {variant.type === 'Deletion' ? 'Loss' : 'Gain'} 计算器</button>}
            {isExon && taskId && <button type="button" onClick={() => setPlotOpen(true)} className="rounded-md border border-border-default px-3 py-2 text-sm">外显子 CN 分布图</button>}
            {showPlot && <button type="button" onClick={() => setPlotOpen(true)} className="rounded-md border border-border-default px-3 py-2 text-sm">区域信号图 · 设置窗口</button>}
          </div>
          </section>
          <section hidden={section !== 'annotation'} >
          {(variant.type === 'Amplification' || variant.type === 'Deletion') && <div className="mt-4 rounded-lg border border-border-default p-3">
            <h4 className="mb-2 text-sm font-medium">ISCN 候选注释</h4>
            <p className="select-text break-words font-mono text-sm">{variant.iscnCandidate || '无法生成：拷贝状态、参考版本或染色体带区待确认'}</p>
            <p className="mt-2 text-xs leading-relaxed text-fg-muted">基于测序 CN 估计取整；x 表示候选拷贝状态。坐标由 BED 转为 1-based。需要确认准确拷贝数后用于回报，尤其是性染色体及嵌合事件。</p>
            {variant.annotationValues?.ISCN && <details className="mt-2 text-xs text-fg-muted"><summary className="cursor-pointer">工作流原始注释（保留原值）</summary><p className="mt-1 select-text break-words font-mono">{variant.annotationValues.ISCN}</p></details>}
          </div>}
          </section>
          <section hidden={section !== 'evidence'} >
          {/* CNV 特征 */}
          <SectionTitle icon={FileText} title="CNV 特征" />
          <div className="space-y-0">
            <InfoItem
              label="类型" 
              value={
                <Tag variant={typeVariant}>
                  {typeLabel}
                </Tag>
              } 
            />
            <InfoItem label="拷贝数" value={variant.copyNumber} />
            <InfoItem label="Copy ratio" value={variant.copyRatio === null ? undefined : variant.copyRatio.toFixed(3)} />
            <InfoItem label="片段 Log2 ratio" value={variant.log2Ratio === null ? undefined : variant.log2Ratio.toFixed(3)} />
            {isExon && (
              <InfoItem label="外显子比值" value={exonRatio === null ? undefined : exonRatio.toFixed(2)} />
            )}
            <InfoItem label={isExon ? "置信度" : "信号权重"} value={isExon ? ({HIGH:"高",MEDIUM:"中",LOW:"低"}[variant.confidenceLabel ?? ""] ?? variant.confidenceLabel) : variant.confidence ?? undefined} />
          </div>

          </section>
          <section hidden={section !== 'annotation'} >
          {/* 涉及基因 (仅 Segment) */}
          {!isExon && (variant as CNVSegment).genes.length > 0 && (
            <>
              <SectionTitle icon={Database} title="涉及基因" />
              <div className="space-y-0">
                <div className="flex flex-wrap gap-2">
                  {(variant as CNVSegment).genes.map((gene) => (
                    <a
                      key={gene}
                      href={geneCardsURL(gene)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-canvas-inset text-accent-fg rounded hover:bg-accent-subtle transition-colors"
                    >
                      {gene}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* 基因组位置链接 */}
          <SectionTitle icon={MapPin} title="外部资源" />
          <div className="space-y-0">
            {externalReference ? (
              <>
                <InfoItem
                  label="UCSC Genome Browser"
                  value={`查看（${externalReference}）`}
                  link={ucscRegionURL(externalReference, variant.chromosome, variant.startPosition, variant.endPosition)}
                />
                <InfoItem
                  label="Ensembl"
                  value="查看"
                  link={ensemblRegionURL(variant.chromosome, variant.startPosition, variant.endPosition)}
                />
              </>
            ) : (
              <InfoItem label="外部资源" value="未提供任务参考版本" />
            )}
            {isExon && (
              <InfoItem
                label="GeneCards" 
                value={(variant as CNVExon).gene}
                link={geneCardsURL((variant as CNVExon).gene)}
              />
            )}
          </div>

          </section>
          <section hidden={section !== 'assessment'} >
          {/* 置顶状态 */}
          <SectionTitle icon={FileText} title="置顶状态" />
          <div className="space-y-0">
            <InfoItem
              label="置顶状态"
              value={variant.pinned ? (
                <Tag variant="success">已置顶</Tag>
              ) : (
                <Tag variant="neutral">未置顶</Tag>
              )} 
            />

            <InfoItem
              label="回报状态" 
              value={variant.reported ? (
                <Tag variant="info">已回报</Tag>
              ) : (
                <Tag variant="neutral">未回报</Tag>
              )} 
            />
            {variant.reported && variant.reportedBy && (
              <>
                <InfoItem label="回报人" value={variant.reportedBy} />
                <InfoItem label="回报时间" value={variant.reportedAt} />
              </>
            )}
          </div>
          </section>
        </div>

      </WorkspaceInspector>

      {isExon && taskId && <CNVExonPlot variant={variant} taskId={taskId} isOpen={plotOpen} onClose={() => setPlotOpen(false)} />}
      {/* CNV 图弹窗 */}
      {showPlot && !isExon && (
        <CNVRegionPlot
          variant={variant as CNVSegment}
          taskId={taskId!}
          isOpen={plotOpen}
          onClose={() => setPlotOpen(false)}
        />
      )}
    </>
  );
}
