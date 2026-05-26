'use client';

import * as React from 'react';
import { Button, Input, Select } from '@schema/ui-kit';
import { X, Search, Loader2 } from 'lucide-react';
import {
  pipelinesApi,
  samplesApi,
  templatesApi,
  type TaskPipelineOption,
  type TaskSampleListItem,
  type TaskTemplateOption,
} from '@/lib/task-resources';

export interface NewTaskFormData {
  sampleId: string;
  internalId: string;
  pipelineId: string;
  pipelineName: string;
  pipelineVersion: string;
  remark: string;
  template: string;
  inputs: Record<string, unknown>;
  uploaded_file_ids: number[];
  estimatedMinutes: number;
}

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: NewTaskFormData) => void;
}

export function NewTaskModal({ isOpen, onClose, onSubmit }: NewTaskModalProps) {
  const [sampleSearch, setSampleSearch] = React.useState('');
  const [samples, setSamples] = React.useState<TaskSampleListItem[]>([]);
  const [pipelines, setPipelines] = React.useState<TaskPipelineOption[]>([]);
  const [templates, setTemplates] = React.useState<TaskTemplateOption[]>([]);
  const [selectedSample, setSelectedSample] = React.useState<TaskSampleListItem | null>(null);
  const [selectedPipeline, setSelectedPipeline] = React.useState<string>('');
  const [uploadedFileIds, setUploadedFileIds] = React.useState('');
  const [estimatedMinutes, setEstimatedMinutes] = React.useState(120);
  const [remark, setRemark] = React.useState('');
  const [loadingResources, setLoadingResources] = React.useState(false);
  const [resourceError, setResourceError] = React.useState('');

  React.useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    async function loadResources() {
      setLoadingResources(true);
      setResourceError('');
      try {
        const [sampleItems, pipelineItems, templateItems] = await Promise.all([
          samplesApi.list(),
          pipelinesApi.list().catch(() => []),
          templatesApi.list().catch(() => []),
        ]);
        if (cancelled) return;
        setSamples(sampleItems);
        setPipelines(pipelineItems);
        setTemplates(templateItems);
        const firstValue = pipelineItems[0]?.id || templateItems[0]?.name || '';
        setSelectedPipeline(prev => prev || firstValue);
      } catch (err) {
        if (!cancelled) {
          setResourceError(err instanceof Error ? err.message : '加载任务资源失败');
        }
      } finally {
        if (!cancelled) setLoadingResources(false);
      }
    }

    loadResources();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // 筛选样本
  const filteredSamples = React.useMemo(() => {
    if (!sampleSearch) return samples;
    const query = sampleSearch.toLowerCase();
    return samples.filter(
      s => s.id.toLowerCase().includes(query) || s.internalId.toLowerCase().includes(query)
    );
  }, [sampleSearch, samples]);

  const pipelineOptions = React.useMemo(() => {
    if (pipelines.length > 0) {
      return pipelines.map(p => ({
        value: p.id,
        label: `${p.name}${p.version ? ` (${p.version})` : ''}`,
      }));
    }
    return templates.map(t => ({
      value: t.name,
      label: t.name,
    }));
  }, [pipelines, templates]);

  const resolveTemplate = (pipeline: TaskPipelineOption | undefined) => {
    if (pipeline?.template) return pipeline.template;
    const byBaseType: Record<string, string> = {
      wes_single: 'single',
      wes_family: 'family',
      panel: 'panel',
    };
    const baseTemplate = pipeline?.baseType ? byBaseType[pipeline.baseType] : '';
    if (baseTemplate && templates.some(t => t.name === baseTemplate)) return baseTemplate;

    const target = `${pipeline?.id ?? selectedPipeline} ${pipeline?.name ?? ''}`.toLowerCase();
    const matchedTemplate = templates.find(t => target.includes(t.name.toLowerCase()));
    return matchedTemplate?.name || templates[0]?.name || pipeline?.id || selectedPipeline;
  };

  const parseUploadedFileIds = () => uploadedFileIds
    .split(',')
    .map(id => Number(id.trim()))
    .filter(id => Number.isInteger(id) && id > 0);

  const buildInputs = (sample: TaskSampleListItem) => {
    const inputs: Record<string, unknown> = {
      sample_name: sample.internalId || sample.id,
      sample_id: sample.id,
    };

    if (sample.matchedPair?.r1Path) {
      inputs.fastq1 = sample.matchedPair.r1Path;
    }
    if (sample.matchedPair?.r2Path) {
      inputs.fastq2 = sample.matchedPair.r2Path;
    }

    return inputs;
  };

  const handleSubmit = () => {
    if (!selectedSample || !selectedPipeline) return;

    const pipeline = pipelines.find(p => p.id === selectedPipeline);
    const template = resolveTemplate(pipeline);
    if (!template) return;

    onSubmit({
      sampleId: selectedSample.id,
      internalId: selectedSample.internalId,
      pipelineId: pipeline?.id || template,
      pipelineName: pipeline?.name || template,
      pipelineVersion: pipeline?.version || '',
      remark,
      template,
      inputs: buildInputs(selectedSample),
      uploaded_file_ids: parseUploadedFileIds(),
      estimatedMinutes,
    });
    handleClose();
  };

  const handleClose = () => {
    setSampleSearch('');
    setSelectedSample(null);
    setSelectedPipeline('');
    setUploadedFileIds('');
    setEstimatedMinutes(120);
    setRemark('');
    setResourceError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">新建分析任务</h2>
          <button
            onClick={handleClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {loadingResources && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              正在加载样本和流程...
            </div>
          )}
          {resourceError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
              {resourceError}
            </div>
          )}

          {/* 选择样本 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">选择样本 *</label>
            <div className="relative mb-2">
              <Input
                placeholder="搜索样本编号或内部编号..."
                value={sampleSearch}
                onChange={(e) => setSampleSearch(e.target.value)}
                leftElement={<Search className="w-4 h-4" />}
              />
            </div>
            <div className="border border-gray-200 rounded-md max-h-40 overflow-y-auto">
              {filteredSamples.map(sample => (
                <div
                  key={sample.id}
                  onClick={() => setSelectedSample(sample)}
                  className={`px-3 py-2 cursor-pointer transition-colors ${
                    selectedSample?.id === sample.id
                      ? 'bg-accent-subtle text-accent-fg'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="text-sm font-mono">{sample.id.substring(0, 8)}...</div>
                  <div className="text-xs text-gray-500">{sample.internalId}</div>
                </div>
              ))}
              {filteredSamples.length === 0 && (
                <div className="px-3 py-4 text-center text-sm text-gray-500">
                  未找到匹配的样本
                </div>
              )}
            </div>
            {selectedSample && (
              <div className="mt-2 text-sm text-accent-fg">
                已选择: {selectedSample.internalId}
              </div>
            )}
          </div>

          {/* 选择流程 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">分析流程 *</label>
            <Select
              value={selectedPipeline}
              onChange={(v) => setSelectedPipeline(Array.isArray(v) ? v[0] : v)}
              options={pipelineOptions}
              placeholder="请选择分析流程"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">预计耗时（分钟）</label>
              <Input
                type="number"
                min="1"
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">上传文件 ID</label>
              <Input
                value={uploadedFileIds}
                onChange={(e) => setUploadedFileIds(e.target.value)}
                placeholder="如：1,2（可选）"
              />
            </div>
          </div>

          {/* 备注 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">备注</label>
            <Input
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="请输入备注信息（可选）"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <Button variant="secondary" onClick={handleClose}>取消</Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={loadingResources || !selectedSample || !selectedPipeline}
          >
            创建任务
          </Button>
        </div>
      </div>
    </div>
  );
}
