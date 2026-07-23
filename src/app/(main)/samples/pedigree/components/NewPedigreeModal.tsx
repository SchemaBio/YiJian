'use client';

import * as React from 'react';
import { Button, Input, TextArea, Tag } from '@schema/ui-kit';
import { Search, Check, Users, UserRound, FileText, Loader2 } from 'lucide-react';
import { AppModal, ModalSectionHeading } from '@/components/shared';
import { listSamples } from '@/lib/samples';

interface Sample {
  id: string;
  internalId: string;
  gender: 'male' | 'female' | 'unknown';
}

interface NewPedigreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: NewPedigreeFormData) => void | Promise<void>;
}

export interface NewPedigreeFormData {
  internalId: string;          // 家系内部编号
  clinicalDiagnosis: string;   // 临床诊断
  batch: string;
  probandSampleId: string;     // 先证者样本UUID
  remark: string;
}

export function NewPedigreeModal({ isOpen, onClose, onSubmit }: NewPedigreeModalProps) {
  const [formData, setFormData] = React.useState<NewPedigreeFormData>({
    internalId: '',
    clinicalDiagnosis: '',
    batch: '',
    probandSampleId: '',
    remark: '',
  });

  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState('');
  const [samples, setSamples] = React.useState<Sample[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  // 加载可用样本
  React.useEffect(() => {
    if (isOpen) {
      setLoading(true);
      listSamples()
        .then(data => setSamples(data.map(sample => ({
          id: sample.id,
          internalId: sample.internalId,
          gender: sample.gender,
        }))))
        .catch(() => setSamples([]))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  const filteredSamples = React.useMemo(() => {
    if (!searchQuery) return samples;
    const query = searchQuery.toLowerCase();
    return samples.filter(
      s => s.id.toLowerCase().includes(query) || s.internalId.toLowerCase().includes(query)
    );
  }, [samples, searchQuery]);

  const handleChange = (field: keyof NewPedigreeFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSelectSample = (sampleId: string) => {
    setFormData(prev => ({
      ...prev,
      probandSampleId: prev.probandSampleId === sampleId ? '' : sampleId,
    }));
  };

  const handleSubmit = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!formData.probandSampleId || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await onSubmit(formData);
      onClose();
      // Reset form only after all pedigree creation API steps succeed.
      setFormData({
        internalId: '',
        clinicalDiagnosis: '',
        batch: '',
        probandSampleId: '',
        remark: '',
      });
      setSearchQuery('');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create pedigree');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedSample = samples.find(s => s.id === formData.probandSampleId);

  const genderLabels = {
    male: '男',
    female: '女',
    unknown: '未知',
  };

  return (
    <AppModal
      open={isOpen}
      onOpenChange={(open) => !open && !submitting && onClose()}
      title="新建家系"
      size="large"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button
            variant="primary"
            onClick={(e: React.MouseEvent) => handleSubmit(e)}
            disabled={!formData.probandSampleId || submitting}
            leftIcon={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
          >
            {submitting ? '创建中...' : '创建家系'}
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
          <ModalSectionHeading
            icon={<Users className="h-4 w-4" />}
            title="家系信息"
            description="填写家系编号、批次和临床诊断"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-fg-muted">内部编号 *</label>
              <Input
                value={formData.internalId}
                onChange={(e) => handleChange('internalId', e.target.value)}
                placeholder="如：FAM-001"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-fg-muted">批次</label>
              <Input
                value={formData.batch}
                onChange={(e) => handleChange('batch', e.target.value)}
                placeholder="如：BATCH-2024-001"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-fg-muted">临床诊断</label>
              <Input
                value={formData.clinicalDiagnosis}
                onChange={(e) => handleChange('clinicalDiagnosis', e.target.value)}
                placeholder="如：遗传性心肌病待查"
              />
            </div>
          </div>
        </section>

        <section className="border-t border-[var(--yj-border-subtle)] pt-5">
          <ModalSectionHeading
            icon={<UserRound className="h-4 w-4" />}
            title="先证者样本"
            description="从当前组织的样本中选择一位先证者"
          />
          {selectedSample && (
            <div className="mb-3 text-xs font-medium text-success-fg">已选择：{selectedSample.internalId}</div>
          )}
          <div className="mb-3">
            <Input
              placeholder="搜索样本编号、内部编号..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftElement={<Search className="w-4 h-4" />}
            />
          </div>
          <div className="max-h-64 overflow-y-auto rounded-md border border-border-default">
            {loading ? (
              <div className="flex items-center justify-center gap-2 p-8 text-center text-fg-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                加载样本列表...
              </div>
            ) : filteredSamples.length > 0 ? (
              <div className="divide-y divide-border-default">
                {filteredSamples.map((sample) => {
                  const isSelected = formData.probandSampleId === sample.id;
                  return (
                    <div
                      key={sample.id}
                      onClick={() => handleSelectSample(sample.id)}
                      className={`px-4 py-3 cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-l-2 border-l-accent-emphasis bg-accent-subtle'
                          : 'hover:bg-canvas-subtle'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? 'border-accent-emphasis bg-accent-emphasis' : 'border-border-emphasis'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm text-fg-default">
                                {sample.id.substring(0, 8)}
                              </span>
                              <span className="text-sm text-fg-muted">
                                ({sample.internalId})
                              </span>
                              <Tag variant={sample.gender === 'male' ? 'info' : sample.gender === 'female' ? 'warning' : 'neutral'}>
                                {genderLabels[sample.gender]}
                              </Tag>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-fg-muted">
                未找到匹配的样本
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-fg-muted">
            提示：先证者样本必须已存在于样本管理中
          </p>
        </section>

        <section className="border-t border-[var(--yj-border-subtle)] pt-5">
          <ModalSectionHeading
            icon={<FileText className="h-4 w-4" />}
            title="备注"
            description="补充记录家系相关的分析说明"
          />
          <label className="mb-1.5 block text-xs font-medium text-fg-muted">备注内容</label>
          <TextArea
            value={formData.remark}
            onChange={(e) => handleChange('remark', e.target.value)}
            placeholder="请输入家系相关备注信息"
            rows={3}
          />
        </section>
      </form>
    </AppModal>
  );
}
