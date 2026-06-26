'use client';

import * as React from 'react';
import { Button, Input, Select } from '@schema/ui-kit';
import { X, Search, Loader2 } from 'lucide-react';
import { AppModal } from '@/components/shared';
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
    <AppModal
      open={isOpen}
      onOpenChange={(open) => !open && handleClose()}
      title="新建分析任务"
      size="medium"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>取消</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={loadingResources || !selectedSample || !selectedPipeline}>创建任务</Button>
        </>
      }
    >
      <div className="space-y-4">
        {loadingResources && (
          <div className="flex items-center gap-2 text-sm text-fg-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            正在加载样本和流程...
          </div>
        )}
        {resourceError && (
          <div className="text-sm text-danger-fg bg-danger-subtle border border-danger-emphasis rounded-md px-3 py-2">
            {resourceError}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-fg-default mb-2">选择样本 *</label>
          <div className="relative mb-2">
            <Input placeholder="搜索样本编号或内部编号..." value={sampleSearch} onChange={(e) => setSampleSearch(e.target.value)} leftElement={<Search className="w-4 h-4" />} />
          </div>
          <div className="border border-border rounded-md max-h-40 overflow-y-auto">
            {filteredSamples.map(sample => (
              <div
                key={sample.id}
                onClick={() => setSelectedSample(sample)}
                className={`px-3 py-2 cursor-pointer transition-colors ${selectedSample?.id === sample.id ? 'bg-accent-subtle text-accent-fg' : 'hover:bg-canvas-subtle'}`}
              >
                <div className="text-sm font-mono">{sample.id.substring(0, 8)}...</div>
                <div className="text-xs text-fg-muted">{sample.internalId}</div>
              </div>
            ))}
            {filteredSamples.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-fg-muted">未找到匹配的样本</div>
            )}
          </div>
          {selectedSample && (
            <div className="mt-2 text-sm text-accent-fg">已选择: {selectedSample.internalId}</div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-fg-default mb-2">分析流程 *</label>
          <Select value={selectedPipeline} onChange={(v) => setSelectedPipeline(Array.isArray(v) ? v[0] : v)} options={pipelineOptions} placeholder="请选择分析流程" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-fg-default mb-2">预计耗时（分钟）</label>
            <Input type="number" min="1" value={estimatedMinutes} onChange={(e) => setEstimatedMinutes(Math.max(1, Number(e.target.value) || 1))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-fg-default mb-2">上传文件 ID</label>
            <Input value={uploadedFileIds} onChange={(e) => setUploadedFileIds(e.target.value)} placeholder="如：1,2（可选）" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-fg-default mb-2">备注</label>
          <Input value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="请输入备注信息（可选）" />
        </div>
      </div>
    </AppModal>
  );
}
