'use client';

import * as React from 'react';
import { Button, Input, Select, TextArea } from '@schema/ui-kit';
import { FileText, Search, Stethoscope, UserRound, X } from 'lucide-react';
import { AppModal } from '@/components/shared';
import type { Gender, SampleType, Sample } from '../types';

interface EditSampleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (id: string, data: EditSampleFormData) => void | Promise<void>;
  sample: Sample | null;
}

export interface EditSampleFormData {
  internalId: string;
  gender: Gender;
  age?: number;
  sampleType: SampleType;
  batch: string;
  clinicalDiagnosis: string;
  hpoTerms: { id: string; name: string }[];
  remark: string;
}

const genderOptions = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
  { value: 'unknown', label: '未知' },
];

const sampleTypeOptions = [
  { value: '全血', label: '全血' },
  { value: '唾液', label: '唾液' },
  { value: 'DNA', label: 'DNA' },
  { value: '组织', label: '组织' },
  { value: '其他', label: '其他' },
];

// 常用HPO术语列表
const COMMON_HPO_TERMS = [
  { id: 'HP:0001250', name: '癫痫发作' },
  { id: 'HP:0001249', name: '智力障碍' },
  { id: 'HP:0001252', name: '肌张力减退' },
  { id: 'HP:0001263', name: '发育迟缓' },
  { id: 'HP:0000252', name: '小头畸形' },
  { id: 'HP:0001635', name: '充血性心力衰竭' },
  { id: 'HP:0001962', name: '心悸' },
  { id: 'HP:0002094', name: '呼吸困难' },
  { id: 'HP:0000365', name: '听力损失' },
  { id: 'HP:0000518', name: '白内障' },
];

export function EditSampleModal({ isOpen, onClose, onSubmit, sample }: EditSampleModalProps) {
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState('');
  const [formData, setFormData] = React.useState<EditSampleFormData>({
    internalId: '',
    gender: 'unknown',
    age: undefined,
    sampleType: '全血',
    batch: '',
    clinicalDiagnosis: '',
    hpoTerms: [],
    remark: '',
  });

  const [hpoSearchQuery, setHpoSearchQuery] = React.useState('');
  const [showHpoDropdown, setShowHpoDropdown] = React.useState(false);

  // 当 sample 变化时更新表单数据
  React.useEffect(() => {
    if (sample) {
      setSubmitError('');
      setHpoSearchQuery('');
      setShowHpoDropdown(false);
      setFormData({
        internalId: sample.internalId,
        gender: sample.gender,
        age: sample.age,
        sampleType: sample.sampleType,
        batch: sample.batch,
        clinicalDiagnosis: sample.clinicalDiagnosis,
        hpoTerms: sample.hpoTerms || [],
        remark: sample.remark,
      });
    }
  }, [sample]);

  const filteredHpoTerms = React.useMemo(() => {
    if (!hpoSearchQuery) return COMMON_HPO_TERMS.slice(0, 5);
    const query = hpoSearchQuery.toLowerCase();
    return COMMON_HPO_TERMS.filter(
      t => t.id.toLowerCase().includes(query) || t.name.includes(query)
    );
  }, [hpoSearchQuery]);

  const handleChange = (field: keyof EditSampleFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addHpoTerm = (term: { id: string; name: string }) => {
    if (!formData.hpoTerms.find(t => t.id === term.id)) {
      setFormData(prev => ({ ...prev, hpoTerms: [...prev.hpoTerms, term] }));
    }
    setHpoSearchQuery('');
    setShowHpoDropdown(false);
  };

  const removeHpoTerm = (termId: string) => {
    setFormData(prev => ({
      ...prev,
      hpoTerms: prev.hpoTerms.filter(t => t.id !== termId)
    }));
  };

  const handleSubmit = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!sample || submitting) return;
    setSubmitError('');
    if (!formData.internalId.trim()) {
      setSubmitError('请填写内部编号');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(sample.id, { ...formData, internalId: formData.internalId.trim() });
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '更新样本失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (!sample) return null;

  return (
    <AppModal
      open={isOpen}
      onOpenChange={(open) => !open && !submitting && onClose()}
      title="编辑样本"
      size="large"
      className="!fixed !left-1/2 !right-auto !top-1/2 !bottom-auto !m-0 !max-h-[calc(100vh-2rem)] !w-[min(920px,calc(100vw-2rem))] !max-w-[920px] !-translate-x-1/2 !-translate-y-1/2"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button variant="primary" onClick={(e: React.MouseEvent) => handleSubmit(e)} disabled={submitting}>
            {submitting ? '保存中...' : '保存修改'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {submitError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {submitError}
          </div>
        )}
        <section>
          <SectionHeading
            icon={<UserRound className="h-4 w-4" />}
            title="基本信息"
            description="用于样本检索、分组和基础分析配置"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-fg-muted">样本 UUID</label>
              <Input value={sample.id} disabled className="bg-gray-50 font-mono text-fg-muted" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-fg-muted">内部编号 *</label>
              <Input value={formData.internalId} onChange={(e) => handleChange('internalId', e.target.value)} placeholder="如：INT-001" required />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-fg-muted">批次</label>
              <Input value={formData.batch} onChange={(e) => handleChange('batch', e.target.value)} placeholder="如：BATCH-2026-001" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-fg-muted">样本类型 *</label>
              <Select value={formData.sampleType} onChange={(value) => handleChange('sampleType', Array.isArray(value) ? value[0] : value)} options={sampleTypeOptions} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-fg-muted">性别</label>
              <Select value={formData.gender} onChange={(value) => handleChange('gender', Array.isArray(value) ? value[0] : value)} options={genderOptions} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-fg-muted">年龄</label>
              <Input
                type="number"
                min="0"
                max="150"
                value={formData.age ?? ''}
                onChange={(e) => setFormData(prev => ({ ...prev, age: e.target.value ? parseInt(e.target.value, 10) : undefined }))}
                placeholder="如：35"
              />
            </div>
          </div>
        </section>

        <section className="border-t border-[var(--yj-border-subtle)] pt-5">
          <SectionHeading
            icon={<Stethoscope className="h-4 w-4" />}
            title="临床信息"
            description="记录诊断摘要和可用于分析筛选的 HPO 表型"
          />
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-fg-muted">临床诊断</label>
              <TextArea value={formData.clinicalDiagnosis} onChange={(e) => handleChange('clinicalDiagnosis', e.target.value)} placeholder="请输入临床诊断" rows={2} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-fg-muted">HPO 表型术语</label>
              {formData.hpoTerms.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {formData.hpoTerms.map((term) => (
                    <div key={term.id} className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-sm text-blue-700">
                      <span className="font-mono text-xs text-blue-500">{term.id}</span>
                      <span>{term.name}</span>
                      <button type="button" onClick={() => removeHpoTerm(term.id)} className="ml-1 text-blue-400 hover:text-red-500" aria-label={`移除 ${term.name}`}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="relative">
                <Input
                  placeholder="搜索HPO术语（如：HP:0001250 或 癫痫）"
                  value={hpoSearchQuery}
                  onChange={(e) => { setHpoSearchQuery(e.target.value); setShowHpoDropdown(true); }}
                  onFocus={() => setShowHpoDropdown(true)}
                  leftElement={<Search className="h-4 w-4" />}
                />
                {showHpoDropdown && filteredHpoTerms.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-40 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
                    {filteredHpoTerms.map((term) => (
                      <button key={term.id} type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50" onClick={() => addHpoTerm(term)}>
                        <span className="font-mono text-xs text-blue-500">{term.id}</span>
                        <span className="text-sm">{term.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-[var(--yj-border-subtle)] pt-5">
          <SectionHeading
            icon={<FileText className="h-4 w-4" />}
            title="备注"
            description="补充记录送检或分析注意事项"
          />
          <TextArea value={formData.remark} onChange={(e) => handleChange('remark', e.target.value)} placeholder="请输入备注信息" rows={2} />
        </section>
      </form>
    </AppModal>
  );
}

function SectionHeading({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--yj-panel-subtle)] text-accent-fg">
        {icon}
      </span>
      <div>
        <h3 className="text-sm font-semibold text-fg-default">{title}</h3>
        <p className="mt-0.5 text-xs text-fg-muted">{description}</p>
      </div>
    </div>
  );
}
