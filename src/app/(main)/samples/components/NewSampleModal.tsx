'use client';

import * as React from 'react';
import { Button, Input, Select, TextArea } from '@schema/ui-kit';
import { X, Search } from 'lucide-react';
import { AppModal } from '@/components/shared';
import type { Gender, SampleType } from '../types';

interface NewSampleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: NewSampleFormData) => void | Promise<void>;
}

export interface NewSampleFormData {
  internalId: string;
  gender: Gender;
  age?: number;
  sampleType: SampleType;
  batch: string;
  clinicalDiagnosis: string;
  hpoTerms: { id: string; name: string }[];
  r1Path?: string;
  r2Path?: string;
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

export function NewSampleModal({ isOpen, onClose, onSubmit }: NewSampleModalProps) {
  const [formData, setFormData] = React.useState<NewSampleFormData>({
    internalId: '',
    gender: 'unknown',
    age: undefined,
    sampleType: '全血',
    batch: '',
    clinicalDiagnosis: '',
    hpoTerms: [],
    remark: '',
  });

  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState('');

  const [hpoSearchQuery, setHpoSearchQuery] = React.useState('');
  const [showHpoDropdown, setShowHpoDropdown] = React.useState(false);

  const filteredHpoTerms = React.useMemo(() => {
    if (!hpoSearchQuery) return COMMON_HPO_TERMS.slice(0, 5);
    const query = hpoSearchQuery.toLowerCase();
    return COMMON_HPO_TERMS.filter(
      t => t.id.toLowerCase().includes(query) || t.name.includes(query)
    );
  }, [hpoSearchQuery]);

  const handleChange = (field: keyof NewSampleFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await onSubmit(formData);
      onClose();
      // Reset form only after the backend confirms creation.
      setFormData({
        internalId: '',
        gender: 'unknown',
        age: undefined,
        sampleType: '全血',
        batch: '',
        clinicalDiagnosis: '',
        hpoTerms: [],
        remark: '',
      });
      setHpoSearchQuery('');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create sample');
    } finally {
      setSubmitting(false);
    }
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

  return (
    <AppModal
      open={isOpen}
      onOpenChange={(open) => !open && !submitting && onClose()}
      title="新建样本"
      size="medium"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button variant="primary" onClick={(e: React.MouseEvent) => handleSubmit(e)} disabled={submitting}>
            创建样本
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        {submitError && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {submitError}
          </div>
        )}
        {/* 基本信息 */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-fg-default mb-3">基本信息</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-fg-muted mb-1">内部编号 *</label>
              <Input
                value={formData.internalId}
                onChange={(e) => handleChange('internalId', e.target.value)}
                placeholder="如：INT-001"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-fg-muted mb-1">批次</label>
              <Input
                value={formData.batch}
                onChange={(e) => handleChange('batch', e.target.value)}
                placeholder="如：BATCH-2024-001"
              />
            </div>
            <div>
              <label className="block text-xs text-fg-muted mb-1">性别</label>
              <Select
                value={formData.gender}
                onChange={(value) => handleChange('gender', Array.isArray(value) ? value[0] : value)}
                options={genderOptions}
              />
            </div>
            <div>
              <label className="block text-xs text-fg-muted mb-1">年龄</label>
              <Input
                type="number"
                min="0"
                max="150"
                value={formData.age ?? ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  age: e.target.value ? parseInt(e.target.value, 10) : undefined
                }))}
                placeholder="如：35"
              />
            </div>
            <div>
              <label className="block text-xs text-fg-muted mb-1">样本类型 *</label>
              <Select
                value={formData.sampleType}
                onChange={(value) => handleChange('sampleType', Array.isArray(value) ? value[0] : value)}
                options={sampleTypeOptions}
              />
            </div>
          </div>
        </div>

        {/* 临床信息 */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-fg-default mb-3">临床信息</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-fg-muted mb-1">临床诊断</label>
              <TextArea
                value={formData.clinicalDiagnosis}
                onChange={(e) => handleChange('clinicalDiagnosis', e.target.value)}
                placeholder="请输入临床诊断"
                rows={2}
              />
            </div>
            {/* HPO术语 */}
            <div>
              <label className="block text-xs text-fg-muted mb-1">HPO表型术语</label>
              {formData.hpoTerms.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.hpoTerms.map((term) => (
                    <div
                      key={term.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-md text-sm border border-blue-200"
                    >
                      <span className="font-mono text-xs text-blue-500">{term.id}</span>
                      <span>{term.name}</span>
                      <button
                        type="button"
                        onClick={() => removeHpoTerm(term.id)}
                        className="ml-1 text-blue-400 hover:text-red-500"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="relative">
                <Input
                  placeholder="搜索HPO术语（如：HP:0001250 或 癫痫）"
                  value={hpoSearchQuery}
                  onChange={(e) => {
                    setHpoSearchQuery(e.target.value);
                    setShowHpoDropdown(true);
                  }}
                  onFocus={() => setShowHpoDropdown(true)}
                  leftElement={<Search className="w-4 h-4" />}
                />
                {showHpoDropdown && filteredHpoTerms.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-40 overflow-auto">
                    {filteredHpoTerms.map((term) => (
                      <button
                        key={term.id}
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                        onClick={() => addHpoTerm(term)}
                      >
                        <span className="font-mono text-xs text-blue-500">{term.id}</span>
                        <span className="text-sm">{term.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {/* Matched sequencing paths */}
            <div className="pt-2 border-t border-gray-100">
              <label className="block text-xs text-fg-muted mb-2">Matched data (optional; R1/R2 must be provided together)</label>
              <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Octopus sample API accepts validated FASTQ storage keys or paths only. For browser local uploads, use Paired FASTQ upload when creating a task and run it with the Upload job ID.
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-fg-muted mb-1">R1 FASTQ</label>
                  <Input
                    value={formData.r1Path ?? ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, r1Path: e.target.value }))}
                    placeholder="/data/sample_R1.fastq.gz or storage key"
                  />
                </div>
                <div>
                  <label className="block text-xs text-fg-muted mb-1">R2 FASTQ</label>
                  <Input
                    value={formData.r2Path ?? ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, r2Path: e.target.value }))}
                    placeholder="/data/sample_R2.fastq.gz or storage key"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs text-fg-muted mb-1">备注</label>
              <TextArea
                value={formData.remark}
                onChange={(e) => handleChange('remark', e.target.value)}
                placeholder="请输入备注信息"
                rows={2}
              />
            </div>
          </div>
        </div>
      </form>
    </AppModal>
  );
}
