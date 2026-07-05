'use client';

import * as React from 'react';
import { Button, Input, TextArea, Tag } from '@schema/ui-kit';
import { X, Search, Check } from 'lucide-react';
import { AppModal } from '@/components/shared';
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
      size="medium"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button
            variant="primary"
            onClick={(e: React.MouseEvent) => handleSubmit(e)}
            disabled={!formData.probandSampleId || submitting}
          >
            创建家系
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
        {/* 家系信息 */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">家系信息</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">内部编号 *</label>
              <Input
                value={formData.internalId}
                onChange={(e) => handleChange('internalId', e.target.value)}
                placeholder="如：FAM-001"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">批次</label>
              <Input
                value={formData.batch}
                onChange={(e) => handleChange('batch', e.target.value)}
                placeholder="如：BATCH-2024-001"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">临床诊断</label>
              <Input
                value={formData.clinicalDiagnosis}
                onChange={(e) => handleChange('clinicalDiagnosis', e.target.value)}
                placeholder="如：遗传性心肌病待查"
              />
            </div>
          </div>
        </div>

        {/* 先证者选择 */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            先证者样本 *
            {selectedSample && (
              <span className="ml-2 text-xs text-green-600 font-normal">
                已选择: {selectedSample.internalId}
              </span>
            )}
          </h3>
          <div className="mb-3">
            <Input
              placeholder="搜索样本编号、内部编号..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftElement={<Search className="w-4 h-4" />}
            />
          </div>
          <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-gray-500">
                加载样本列表...
              </div>
            ) : filteredSamples.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {filteredSamples.map((sample) => {
                  const isSelected = formData.probandSampleId === sample.id;
                  return (
                    <div
                      key={sample.id}
                      onClick={() => handleSelectSample(sample.id)}
                      className={`px-4 py-3 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50 border-l-2 border-l-blue-500'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm text-gray-900">
                                {sample.id.substring(0, 8)}
                              </span>
                              <span className="text-gray-500 text-sm">
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
              <div className="p-8 text-center text-gray-500">
                未找到匹配的样本
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-gray-400">
            提示：先证者样本必须已存在于样本管理中
          </p>
        </div>

        {/* 备注 */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">备注</label>
          <TextArea
            value={formData.remark}
            onChange={(e) => handleChange('remark', e.target.value)}
            placeholder="请输入家系相关备注信息"
            rows={3}
          />
        </div>
      </form>
    </AppModal>
  );
}
