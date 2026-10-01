'use client';

import * as React from 'react';
import { X, ExternalLink, FileText, Database, Dna, Edit2, Check, Plus, Trash2, MessageSquare } from 'lucide-react';
import { Tag } from '@schema/ui-kit';
import type { SNVIndel, ACMGClassification } from '../types';
import { ACMG_CONFIG } from '../result-api';
import { formatPopulationFrequency, sourceAnnotation } from '../utils/snv-annotations';

// ACMG 证据项定义
const ACMG_CRITERIA_OPTIONS = {
  pathogenic: {
    veryStrong: ['PVS1'],
    strong: ['PS1', 'PS2', 'PS3', 'PS4'],
    moderate: ['PM1', 'PM2', 'PM3', 'PM4', 'PM5', 'PM6'],
    supporting: ['PP1', 'PP2', 'PP3', 'PP4', 'PP5'],
  },
  benign: {
    standalone: ['BA1'],
    strong: ['BS1', 'BS2', 'BS3', 'BS4'],
    supporting: ['BP1', 'BP2', 'BP3', 'BP4', 'BP5', 'BP6', 'BP7'],
  },
};

function pubMedURL(pmid: string): string {
  return `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(String(pmid).trim())}`;
}

function clinVarURL(clinvarId: string): string {
  const id = String(clinvarId).trim().replace(/^VCV/i, '');
  return `https://www.ncbi.nlm.nih.gov/clinvar/variation/${encodeURIComponent(id)}`;
}

function dbSnpURL(rsId: string): string {
  return `https://www.ncbi.nlm.nih.gov/snp/${encodeURIComponent(String(rsId).trim())}`;
}

function omimURL(omimId: string): string {
  return `https://omim.org/entry/${encodeURIComponent(String(omimId).trim())}`;
}

interface VariantDetailPanelProps {
  variant: SNVIndel | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenIGV?: (chromosome: string, position: number) => void;
  onUpdateClassification?: (variantId: string, classification: ACMGClassification, criteria: string[]) => void;
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
        <span className="max-w-[65%] break-words text-right text-fg-default text-sm font-medium">{value}</span>
      )}
    </div>
  );
}

// 分组标题组件
function SectionTitle({ icon: Icon, title, action }: { icon: React.ElementType; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3 mt-5 first:mt-0">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-fg-muted" />
        <h4 className="text-sm font-medium text-fg-default">{title}</h4>
      </div>
      {action}
    </div>
  );
}

// ACMG 分类编辑器组件
function ACMGClassificationEditor({
  currentClassification,
  currentCriteria,
  onSave,
  onCancel,
}: {
  currentClassification: ACMGClassification;
  currentCriteria: string[];
  onSave: (classification: ACMGClassification, criteria: string[]) => void;
  onCancel: () => void;
}) {
  const [classification, setClassification] = React.useState<ACMGClassification>(currentClassification);
  const [selectedCriteria, setSelectedCriteria] = React.useState<Set<string>>(new Set(currentCriteria));

  const toggleCriteria = (criterion: string) => {
    const newSet = new Set(selectedCriteria);
    if (newSet.has(criterion)) {
      newSet.delete(criterion);
    } else {
      newSet.add(criterion);
    }
    setSelectedCriteria(newSet);
  };

  const handleSave = () => {
    onSave(classification, Array.from(selectedCriteria));
  };

  return (
    <div className="space-y-4">
      {/* 分类选择 */}
      <div>
        <label className="block text-sm text-fg-muted mb-2">ACMG 分类</label>
        <select
          value={classification}
          onChange={(e) => setClassification(e.target.value as ACMGClassification)}
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-canvas-default text-fg-default"
        >
          {Object.entries(ACMG_CONFIG).map(([key, config]) => (
            <option key={key} value={key}>{config.label}</option>
          ))}
        </select>
      </div>

      {/* 致病性证据 */}
      <div>
        <label className="block text-sm text-fg-muted mb-2">致病性证据</label>
        <div className="space-y-2">
          <div>
            <span className="text-xs text-fg-subtle">非常强 (PVS)</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {ACMG_CRITERIA_OPTIONS.pathogenic.veryStrong.map((c) => (
                <button
                  key={c}
                  onClick={() => toggleCriteria(c)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    selectedCriteria.has(c)
                      ? 'bg-danger-emphasis text-fg-on-emphasis'
                      : 'bg-canvas-inset text-fg-muted hover:bg-canvas-subtle'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="text-xs text-fg-subtle">强 (PS)</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {ACMG_CRITERIA_OPTIONS.pathogenic.strong.map((c) => (
                <button
                  key={c}
                  onClick={() => toggleCriteria(c)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    selectedCriteria.has(c)
                      ? 'bg-danger-subtle text-danger-fg'
                      : 'bg-canvas-inset text-fg-muted hover:bg-canvas-subtle'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="text-xs text-fg-subtle">中等 (PM)</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {ACMG_CRITERIA_OPTIONS.pathogenic.moderate.map((c) => (
                <button
                  key={c}
                  onClick={() => toggleCriteria(c)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    selectedCriteria.has(c)
                      ? 'bg-warning-subtle text-warning-fg'
                      : 'bg-canvas-inset text-fg-muted hover:bg-canvas-subtle'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="text-xs text-fg-subtle">支持 (PP)</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {ACMG_CRITERIA_OPTIONS.pathogenic.supporting.map((c) => (
                <button
                  key={c}
                  onClick={() => toggleCriteria(c)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    selectedCriteria.has(c)
                      ? 'bg-warning-subtle text-warning-fg'
                      : 'bg-canvas-inset text-fg-muted hover:bg-canvas-subtle'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 良性证据 */}
      <div>
        <label className="block text-sm text-fg-muted mb-2">良性证据</label>
        <div className="space-y-2">
          <div>
            <span className="text-xs text-fg-subtle">独立 (BA)</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {ACMG_CRITERIA_OPTIONS.benign.standalone.map((c) => (
                <button
                  key={c}
                  onClick={() => toggleCriteria(c)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    selectedCriteria.has(c)
                      ? 'bg-success-emphasis text-fg-on-emphasis'
                      : 'bg-canvas-inset text-fg-muted hover:bg-canvas-subtle'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="text-xs text-fg-subtle">强 (BS)</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {ACMG_CRITERIA_OPTIONS.benign.strong.map((c) => (
                <button
                  key={c}
                  onClick={() => toggleCriteria(c)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    selectedCriteria.has(c)
                      ? 'bg-success-subtle text-success-fg'
                      : 'bg-canvas-inset text-fg-muted hover:bg-canvas-subtle'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="text-xs text-fg-subtle">支持 (BP)</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {ACMG_CRITERIA_OPTIONS.benign.supporting.map((c) => (
                <button
                  key={c}
                  onClick={() => toggleCriteria(c)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    selectedCriteria.has(c)
                      ? 'bg-success-subtle text-success-fg'
                      : 'bg-canvas-inset text-fg-muted hover:bg-canvas-subtle'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={handleSave}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-accent-emphasis text-fg-on-emphasis rounded-md hover:bg-accent-emphasis/90 transition-colors"
        >
          <Check className="w-4 h-4" />
          保存
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-2 text-sm border border-border rounded-md hover:bg-canvas-inset transition-colors"
        >
          取消
        </button>
      </div>
    </div>
  );
}

export function VariantDetailPanel({ variant, isOpen, onClose, onOpenIGV, onUpdateClassification }: VariantDetailPanelProps) {
  const [isEditingACMG, setIsEditingACMG] = React.useState(false);
  const [localClassification, setLocalClassification] = React.useState<ACMGClassification | null>(null);
  const [localCriteria, setLocalCriteria] = React.useState<string[] | null>(null);
  const [interpretation, setInterpretation] = React.useState('');
  const canEditACMG = Boolean(onUpdateClassification);

  // 当 variant 变化时重置编辑状态
  React.useEffect(() => {
    setIsEditingACMG(false);
    setLocalClassification(null);
    setLocalCriteria(null);
    setInterpretation('');
  }, [variant?.id]);

  if (!isOpen || !variant) return null;

  const currentClassification = localClassification ?? variant.acmgClassification;
  const currentCriteria = localCriteria ?? variant.acmgCriteria ?? [];
  const acmgConfig = currentClassification ? ACMG_CONFIG[currentClassification] : undefined;
  
  const annotation = (column: string, fallback?: string | number) => sourceAnnotation(variant, column, fallback);

  // 保存 ACMG 分类
  const handleSaveACMG = (classification: ACMGClassification, criteria: string[]) => {
    if (!onUpdateClassification) {
      setIsEditingACMG(false);
      return;
    }
    setLocalClassification(classification);
    setLocalCriteria(criteria);
    setIsEditingACMG(false);
    onUpdateClassification(variant.id, classification, criteria);
  };

  return (
    <>
      {/* 背景遮罩 */}
      <div 
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />
      
      {/* 侧边面板 */}
      <div className="fixed right-0 top-0 h-full w-[480px] max-w-full bg-white dark:bg-[#0d1117] border-l border-border shadow-xl z-50 flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-canvas-subtle">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-medium text-fg-default">变异详情</h3>
            {acmgConfig ? <Tag variant={acmgConfig.variant}>{acmgConfig.label}</Tag> : <Tag variant="neutral">ACMG 未评定</Tag>}
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
            <InfoItem label="基因" value={variant.gene} />
            <InfoItem 
              label="位置" 
              value={
                <button
                  onClick={() => onOpenIGV?.(variant.chromosome, variant.position)}
                  className="text-accent-fg hover:underline"
                >
                  {variant.chromosome}:{variant.position}
                </button>
              }
            />
            <InfoItem label="参考/变异" value={`${variant.ref} > ${variant.alt}`} />
            <InfoItem label="变异类型" value={variant.variantType} />
            <InfoItem label="杂合性" value={
              variant.zygosity === 'Heterozygous' ? '杂合' :
              variant.zygosity === 'Homozygous' ? '纯合' :
              variant.zygosity === 'Hemizygous' ? '半合' : '未提供'
            } />
            <InfoItem label="转录本" value={variant.transcript} />
            <InfoItem label="cDNA变化" value={variant.hgvsc} />
            <InfoItem label="蛋白质变化" value={variant.hgvsp} />
            <InfoItem label="变异后果" value={variant.consequence} />
          </div>

          {/* 测序质量 */}
          <SectionTitle icon={FileText} title="测序质量" />
          <div className="bg-canvas-subtle rounded-lg p-3">
            <InfoItem label="样本变异等位基因比例（VAF）" value={`${(variant.alleleFrequency * 100).toFixed(1)}%`} />
            <InfoItem label="覆盖深度" value={`${variant.depth}X`} />
          </div>

          <SectionTitle icon={Database} title="ClinVar 注释" />
          <div className="bg-canvas-subtle rounded-lg p-3">
            <InfoItem label="临床意义" value={annotation('ClinVar_Sig', variant.clinvarSignificance)} />
            <InfoItem label="审核状态" value={annotation('ClinVar_RevStat', variant.clinvarReviewStatus)} />
            <InfoItem label="审核星级" value={annotation('ClinVar_Star', variant.clinvarStars)} />
            <InfoItem label="关联疾病" value={annotation('ClinVar_DN', variant.clinvarDisease)} />
          </div>

          {/* 人群频率 */}
          <SectionTitle icon={Database} title="人群频率" />
          <div className="bg-canvas-subtle rounded-lg p-3">
            <InfoItem label="gnomAD 总体 AF" value={formatPopulationFrequency(annotation('GnomAD_AF', variant.gnomadAF))} />
            <InfoItem label="gnomAD 东亚 AF" value={formatPopulationFrequency(annotation('GnomAD_AF_EAS', variant.gnomadEasAF))} />
            <InfoItem label="VEP MAX_AF" value={formatPopulationFrequency(annotation('MAX_AF', variant.maxAF))} />
            <InfoItem label="gnomAD nhomalt XX" value={annotation('GnomAD_nhomalt_XX', variant.gnomadNhomaltXX)} />
            <InfoItem label="gnomAD nhomalt XY" value={annotation('GnomAD_nhomalt_XY', variant.gnomadNhomaltXY)} />
            <p className="mt-2 text-xs text-fg-muted">AF 为 0–1 的原始比值；nhomalt 为纯合变异计数。</p>
          </div>

          {/* 功能预测 */}
          <SectionTitle icon={Dna} title="功能预测" />
          <div className="bg-canvas-subtle rounded-lg p-3">
            <InfoItem label="Pangolin gain" value={annotation('Pangolin_Gain', variant.pangolinGain)} />
            <InfoItem label="Pangolin loss" value={annotation('Pangolin_Loss', variant.pangolinLoss)} />
            <InfoItem label="Pangolin 预测标签" value={annotation('Pangolin_AN', variant.pangolinAnnotation)} />
            <InfoItem label="EVOScore2" value={annotation('EVOScore', variant.evoScore)} />
            <InfoItem label="EVOScore2 预测标签" value={annotation('EVOScore_AN', variant.evoAnnotation)} />
            <InfoItem label="AlphaMissense 分数" value={annotation('AlphaMissense_AM', variant.alphaMissenseScore)} />
            <InfoItem label="AlphaMissense 预测标签" value={annotation('AlphaMissense_AMC', variant.alphaMissenseClass)} />
            <p className="mt-2 text-xs text-fg-muted">保留流程输出的多值与标签；功能预测标签不是 ACMG 分级。</p>
          </div>

          {/* ACMG 分类 */}
          <SectionTitle 
            icon={FileText} 
            title="ACMG 分类" 
            action={
              canEditACMG && !isEditingACMG && (
                <button
                  onClick={() => setIsEditingACMG(true)}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-fg-muted hover:text-fg-default hover:bg-canvas-inset rounded transition-colors"
                >
                  <Edit2 className="w-3 h-3" />
                  编辑
                </button>
              )
            }
          />
          <div className="bg-canvas-subtle rounded-lg p-3">
            {isEditingACMG ? (
              <ACMGClassificationEditor
                currentClassification={currentClassification ?? 'VUS'}
                currentCriteria={currentCriteria}
                onSave={handleSaveACMG}
                onCancel={() => setIsEditingACMG(false)}
              />
            ) : (
              <>
                <InfoItem label="分类" value={acmgConfig ? <Tag variant={acmgConfig.variant}>{acmgConfig.label}</Tag> : '未评定'} />
                {!acmgConfig && <p className="mt-2 text-xs text-fg-muted">当前 SNP/Indel 流程未输出 ACMG 分级。ClinVar 临床意义和功能预测单独展示。</p>}
                <InfoItem 
                  label="证据项" 
                  value={currentCriteria.length ? (
                    <div className="flex flex-wrap gap-1">
                      {currentCriteria.map((c) => (
                        <span key={c} className="px-1.5 py-0.5 text-xs bg-canvas-inset rounded">
                          {c}
                        </span>
                      ))}
                    </div>
                  ) : undefined}
                />
              </>
            )}
          </div>

          {/* 人工解读 */}
          <SectionTitle icon={MessageSquare} title="人工解读" />
          <div className="bg-canvas-subtle rounded-lg p-3">
            <textarea
              value={interpretation}
              onChange={(e) => setInterpretation(e.target.value)}
              placeholder="请输入您对该变异的解读分析..."
              className="w-full min-h-[120px] px-3 py-2 text-sm border border-border-default rounded-md bg-canvas-default text-fg-default resize-y focus:outline-none focus:ring-2 focus:ring-accent-emphasis focus:border-transparent"
            />
            <div className="flex justify-end mt-2">
              <span className="text-xs text-fg-muted">{interpretation.length} 字</span>
            </div>
          </div>

          {/* 临床意义 */}
          <SectionTitle icon={Database} title="GenCC 与变异标识" />
          <div className="bg-canvas-subtle rounded-lg p-3">
            <InfoItem 
              label="dbSNP" 
              value={variant.rsId}
              link={variant.rsId ? dbSnpURL(variant.rsId) : undefined}
            />
            <InfoItem label="HGNC ID" value={annotation('HGNC_ID')} />
            <InfoItem label="Cytoband" value={annotation('Cytoband')} />
            <InfoItem label="GenCC 疾病关联" value={annotation('GenCC_disease_title', variant.diseaseAssociation)} />
            <InfoItem label="GenCC 遗传模式名称" value={annotation('GenCC_moi_title')} />
            <InfoItem label="GenCC 疾病标识" value={annotation('GenCC_disease_original_curie')} />
            <InfoItem label="遗传模式" value={
              variant.inheritanceMode === 'AD' ? '常染色体显性' :
              variant.inheritanceMode === 'AR' ? '常染色体隐性' :
              variant.inheritanceMode === 'XL' ? 'X连锁' :
              variant.inheritanceMode === 'XLD' ? 'X连锁显性' :
              variant.inheritanceMode === 'XLR' ? 'X连锁隐性' :
              annotation('GenCC_moi_curie', variant.inheritanceMode)
            } />
          </div>

          {/* 文献 */}
          {variant.pubmedIds && variant.pubmedIds.length > 0 && (
            <>
              <SectionTitle icon={FileText} title="相关文献" />
              <div className="bg-canvas-subtle rounded-lg p-3">
                <div className="flex flex-wrap gap-2">
                  {variant.pubmedIds.map((pmid) => (
                    <a
                      key={pmid}
                      href={pubMedURL(pmid)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-canvas-inset text-accent-fg rounded hover:bg-accent-subtle transition-colors"
                    >
                      PMID:{pmid}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="border-t border-border p-4 bg-canvas-subtle">
          <div className="flex gap-2">
            <button
              onClick={() => onOpenIGV?.(variant.chromosome, variant.position)}
              className="flex-1 px-4 py-2 text-sm bg-accent-emphasis text-fg-on-emphasis rounded-md hover:bg-accent-emphasis/90 transition-colors"
            >
              在 IGV 中查看
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border border-border rounded-md hover:bg-canvas-inset transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
