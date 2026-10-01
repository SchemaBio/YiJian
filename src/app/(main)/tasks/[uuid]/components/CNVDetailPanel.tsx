'use client';

import * as React from 'react';
import { X, ExternalLink, FileText, Database, Dna, MapPin, BarChart3, GripHorizontal } from 'lucide-react';
import { Tag } from '@schema/ui-kit';
import type { CNVSegment, CNVExon } from '../types';

interface CNVDetailPanelProps {
  variant: CNVSegment | CNVExon | null;
  variantType: 'segment' | 'exon';
  isOpen: boolean;
  onClose: () => void;
  allSegments?: CNVSegment[];  // 所有CNV片段数据，用于绘制全基因组图
  referenceId?: string;
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
function useDraggable(initialPosition: { x: number; y: number } = { x: 0, y: 0 }) {
  const [position, setPosition] = React.useState(initialPosition);
  const [isDragging, setIsDragging] = React.useState(false);
  const dragStartRef = React.useRef({ x: 0, y: 0 });
  const positionRef = React.useRef(position);

  React.useEffect(() => {
    positionRef.current = position;
  }, [position]);

  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - positionRef.current.x,
      y: e.clientY - positionRef.current.y,
    };
  }, []);

  React.useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      });
    };
    const handleMouseUp = () => setIsDragging(false);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const resetPosition = React.useCallback(() => setPosition({ x: 0, y: 0 }), []);
  return { position, isDragging, handleMouseDown, resetPosition };
}

// 判断是否为 CNVExon 类型
function isCNVExon(variant: CNVSegment | CNVExon): variant is CNVExon {
  return 'gene' in variant && 'exon' in variant;
}

// CNV 图弹窗组件
function CNVPlotModal({
  variant,
  allSegments,
  isOpen,
  onClose
}: {
  variant: CNVSegment;
  allSegments: CNVSegment[];
  isOpen: boolean;
  onClose: () => void;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const { position, isDragging, handleMouseDown, resetPosition } = useDraggable();

  React.useEffect(() => {
    if (!isOpen) resetPosition();
  }, [isOpen, resetPosition]);

  // 当前接口提供的是当前页的 segment 调用结果，而不是 CNR/bin 级原始信号。
  // 因此只画已加载片段与调用出的 copy number，不以零值填充未检出区域。
  const segmentData = React.useMemo(() => {
    const segments = allSegments
      .filter((segment) => segment.chromosome === variant.chromosome)
      .sort((left, right) => left.startPosition - right.startPosition || left.endPosition - right.endPosition);
    const starts = segments.map((segment) => segment.startPosition).concat(variant.startPosition);
    const ends = segments.map((segment) => segment.endPosition).concat(variant.endPosition);
    const first = Math.min(...starts);
    const last = Math.max(...ends);
    const padding = Math.max(Math.round((last - first) * 0.08), 1_000);

    return {
      segments,
      rangeStart: Math.max(0, first - padding),
      rangeEnd: last + padding,
    };
  }, [allSegments, variant.chromosome, variant.endPosition, variant.startPosition]);

  React.useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const containerWidth = container.clientWidth - 40;
    canvas.width = containerWidth * dpr;
    canvas.height = 280 * dpr;
    canvas.style.width = `${containerWidth}px`;
    canvas.style.height = '280px';
    ctx.scale(dpr, dpr);

    const width = containerWidth;
    const height = 280;
    const padding = { top: 38, right: 20, bottom: 48, left: 74 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    // 背景
    ctx.fillStyle = '#f6f8fa';
    ctx.fillRect(0, 0, width, height);

    // 绑定区域背景
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(padding.left, padding.top, plotWidth, plotHeight);

    const { segments, rangeStart, rangeEnd } = segmentData;
    const coordinateRange = Math.max(rangeEnd - rangeStart, 1);
    const laneLabels: Record<CNVSegment['type'], string> = {
      Amplification: '扩增',
      Deletion: '缺失',
      Normal: '其他',
      Unknown: '未提供',
    };
    const laneIndex: Record<CNVSegment['type'], number> = {
      Amplification: 0,
      Deletion: 1,
      Normal: 2,
      Unknown: 3,
    };
    const laneHeight = 34;
    const laneGap = 17;
    const laneTop = padding.top + 12;

    Object.entries(laneLabels).forEach(([type, label]) => {
      const lane = laneIndex[type as CNVSegment['type']];
      const y = laneTop + lane * (laneHeight + laneGap);
      ctx.fillStyle = '#f6f8fa';
      ctx.fillRect(padding.left, y, plotWidth, laneHeight);
      ctx.fillStyle = '#586069';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(label, padding.left - 8, y + 21);
    });

    segments.forEach((segment) => {
      const x = padding.left + ((segment.startPosition - rangeStart) / coordinateRange) * plotWidth;
      const end = padding.left + ((segment.endPosition - rangeStart) / coordinateRange) * plotWidth;
      const y = laneTop + laneIndex[segment.type] * (laneHeight + laneGap);
      const selected = segment.id === variant.id;
      ctx.fillStyle = segment.type === 'Amplification'
        ? '#cf222e'
        : segment.type === 'Deletion'
          ? '#0969da'
          : '#8b949e';
      ctx.globalAlpha = selected ? 1 : 0.62;
      ctx.fillRect(x, y + 5, Math.max(end - x, 3), laneHeight - 10);
      if (selected) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#24292f';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y + 5, Math.max(end - x, 3), laneHeight - 10);
      }
      if (end - x > 54 && segment.copyNumber !== null) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`CN ${segment.copyNumber}`, x + (end - x) / 2, y + 21);
      }
    });
    ctx.globalAlpha = 1;

    // X轴标签只描述当前已导入片段的坐标范围，不推断整条染色体的长度。
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#586069';
    const tickCount = 5;
    for (let i = 0; i <= tickCount; i++) {
      const pos = rangeStart + (coordinateRange / tickCount) * i;
      const x = padding.left + ((pos - rangeStart) / coordinateRange) * plotWidth;
      const label = pos >= 1000000 ? `${(pos / 1000000).toFixed(0)}Mb` : `${(pos / 1000).toFixed(0)}kb`;
      ctx.fillText(label, x, padding.top + plotHeight + 15);
    }

    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#24292f';
    ctx.fillText(`${variant.chromosome} 坐标`, padding.left + plotWidth / 2, padding.top + plotHeight + 32);

  }, [isOpen, segmentData, variant]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed left-1/2 top-1/2 w-[900px] max-w-[calc(100vw-480px)] bg-white rounded-lg shadow-2xl z-[51]"
      style={{
        transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
        cursor: isDragging ? 'grabbing' : 'default',
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b border-border cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-3">
          <GripHorizontal className="w-4 h-4 text-fg-muted" />
          <BarChart3 className="w-4 h-4 text-fg-muted" />
          <span className="font-medium text-sm text-fg-default">{variant.chromosome} 当前页 CNV 片段概览</span>
          <Tag variant={cnvTypeVariant(variant.type)}>
            {variant.startPosition.toLocaleString()}-{variant.endPosition.toLocaleString()}
          </Tag>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="p-1 text-fg-muted hover:text-fg-default rounded hover:bg-canvas-inset"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div ref={containerRef} className="p-4">
        <p className="mb-2 text-xs text-amber-700">
          仅显示当前页已加载的 CNV 片段和调用出的拷贝数。该任务未提供原始 CNR/bin log2 ratio，因此本图不能用于判断覆盖度波动。
        </p>
        <canvas ref={canvasRef} className="rounded" style={{ display: 'block', maxWidth: '100%' }} />
      </div>
      <div className="flex items-center justify-center gap-6 px-4 pb-4 text-xs text-fg-muted">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-danger-fg" />扩增</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-accent-fg" />缺失</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-2.5 rounded-sm bg-danger-subtle" />选中区域</span>
      </div>
    </div>
  );
}

export function CNVDetailPanel({ variant, variantType, isOpen, onClose, allSegments = [], referenceId }: CNVDetailPanelProps) {
  if (!isOpen || !variant) return null;

  const isExon = isCNVExon(variant);
  const exonRatio = isExon ? variant.ratio : null;
  const showPlot = variantType === 'segment' && allSegments.length > 0;
  const typeVariant = cnvTypeVariant(variant.type);
  const typeLabel = cnvTypeLabel(variant.type);
  const externalReference = ucscDatabase(referenceId);

  return (
    <>
      {/* 背景遮罩 */}
      <div 
        className="hidden"
        onClick={onClose}
      />
      
      {/* 侧边面板 */}
      <div role="region" aria-label="变异详情" tabIndex={-1} onKeyDown={event => { if (event.key === 'Escape') onClose(); }} className="fixed right-0 top-0 h-dvh w-[min(480px,100vw)] bg-white dark:bg-[#0d1117] border-l border-border shadow-xl z-50 flex flex-col">
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

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* 基本信息 */}
          <SectionTitle icon={Dna} title="基本信息" />
          <div className="bg-canvas-subtle rounded-lg p-3">
            {isExon && (
              <>
                <InfoItem label="基因" value={variant.gene} />
                <InfoItem label="转录本" value={variant.transcript} />
                <InfoItem label="外显子" value={variant.exon} />
              </>
            )}
            <InfoItem label="染色体" value={variant.chromosome} />
            <InfoItem label="起始位置" value={variant.startPosition} />
            <InfoItem label="终止位置" value={variant.endPosition} />
            {!isExon && (
              <InfoItem label="长度" value={formatLength((variant as CNVSegment).length)} />
            )}
          </div>

          {/* CNV 特征 */}
          <SectionTitle icon={FileText} title="CNV 特征" />
          <div className="bg-canvas-subtle rounded-lg p-3">
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
            <InfoItem label="置信度" value={variant.confidence === null ? undefined : `${(variant.confidence * 100).toFixed(0)}%`} />
          </div>

          {/* 涉及基因 (仅 Segment) */}
          {!isExon && (variant as CNVSegment).genes.length > 0 && (
            <>
              <SectionTitle icon={Database} title="涉及基因" />
              <div className="bg-canvas-subtle rounded-lg p-3">
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
          <div className="bg-canvas-subtle rounded-lg p-3">
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

          {/* 审核状态 */}
          <SectionTitle icon={FileText} title="审核状态" />
          <div className="bg-canvas-subtle rounded-lg p-3">
            <InfoItem 
              label="审核状态" 
              value={variant.reviewed ? (
                <Tag variant="success">已审核</Tag>
              ) : (
                <Tag variant="neutral">未审核</Tag>
              )} 
            />
            {variant.reviewed && variant.reviewedBy && (
              <>
                <InfoItem label="审核人" value={variant.reviewedBy} />
                <InfoItem label="审核时间" value={variant.reviewedAt} />
              </>
            )}
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
        </div>

        {/* 底部操作栏 */}
        <div className="border-t border-border p-4 bg-canvas-subtle">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm border border-border rounded-md hover:bg-canvas-inset transition-colors"
          >
            关闭
          </button>
        </div>
      </div>

      {/* CNV 图弹窗 */}
      {showPlot && !isExon && (
        <CNVPlotModal
          variant={variant as CNVSegment}
          allSegments={allSegments}
          isOpen={isOpen}
          onClose={onClose}
        />
      )}
    </>
  );
}
