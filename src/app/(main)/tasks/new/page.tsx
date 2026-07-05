'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { PageContent } from '@/components/layout';
import { Button, Input, Select, FormItem, Checkbox } from '@schema/ui-kit';
import { Play, Info } from 'lucide-react';
import { tasksApi } from '@/lib/tasks';
import {
  pipelinesApi,
  samplesApi,
  templatesApi,
  type TaskPipelineOption,
  type TaskSampleListItem,
  type TaskTemplateOption,
} from '@/lib/task-resources';

export default function NewAnalysisPage() {
  const router = useRouter();
  const [samples, setSamples] = React.useState<TaskSampleListItem[]>([]);
  const [pipelines, setPipelines] = React.useState<TaskPipelineOption[]>([]);
  const [templates, setTemplates] = React.useState<TaskTemplateOption[]>([]);
  const [loadError, setLoadError] = React.useState('');
  const [selectedSample, setSelectedSample] = React.useState('');
  const [selectedPipeline, setSelectedPipeline] = React.useState('');
  const [taskName, setTaskName] = React.useState('');
  const [enableCNV, setEnableCNV] = React.useState(true);
  const [enableSV, setEnableSV] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState('');

  const selectedSampleInfo = samples.find((sample) => sample.id === selectedSample);
  const selectedPipelineInfo = pipelines.find((pipeline) => pipeline.id === selectedPipeline);

  React.useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      try {
        const [sampleOptions, pipelineOptions, templateOptions] = await Promise.all([
          samplesApi.list({ page: 1, page_size: 100 }),
          pipelinesApi.list(),
          templatesApi.list().catch(() => []),
        ]);
        if (cancelled) return;
        setSamples(sampleOptions);
        setPipelines(pipelineOptions);
        setTemplates(templateOptions);
        setSelectedPipeline((current) => current || pipelineOptions[0]?.id || '');
        setLoadError('');
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load task options');
        }
      }
    }

    loadOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  const resolvePipelineTemplate = React.useCallback((pipeline: TaskPipelineOption): string => {
    if (pipeline.template) return pipeline.template;
    const byBaseType: Record<string, string> = {
      wes_single: 'single',
      wes_family: 'trio',
      panel: 'panel',
    };
    const baseTemplate = pipeline.baseType ? byBaseType[pipeline.baseType] : '';
    if (baseTemplate && (templates.length === 0 || templates.some(template => template.name === baseTemplate))) {
      return baseTemplate;
    }

    const target = `${pipeline.id} ${pipeline.name}`.toLowerCase();
    const matchedTemplate = templates.find(template => target.includes(template.name.toLowerCase()));
    return matchedTemplate?.name || templates[0]?.name || '';
  }, [templates]);

  React.useEffect(() => {
    if (selectedSampleInfo && selectedPipelineInfo) {
      setTaskName(`${selectedSampleInfo.internalId || selectedSampleInfo.id} ${selectedPipelineInfo.name} analysis`);
    }
  }, [selectedSampleInfo, selectedPipelineInfo]);

  const handleSubmit = async () => {
    setFormError('');
    if (!selectedSampleInfo || !selectedPipelineInfo) {
      setFormError('Please select a sample and a pipeline.');
      return;
    }
    if (!selectedSampleInfo.matchedPair) {
      setFormError('The selected sample has no matched sequencing data.');
      return;
    }
    const template = resolvePipelineTemplate(selectedPipelineInfo);
    if (!template) {
      setFormError('No compatible WDL template is available for the selected pipeline.');
      return;
    }

    setSubmitting(true);
    try {
      const task = await tasksApi.create({
        sampleId: selectedSampleInfo.id,
        internalId: selectedSampleInfo.internalId,
        pipelineId: selectedPipelineInfo.id,
        pipelineName: selectedPipelineInfo.name,
        pipelineVersion: selectedPipelineInfo.version,
        remark: taskName,
        template,
        inputs: {
          enable_cnv: enableCNV,
          enable_sv: enableSV,
        },
      });
      router.push(`/tasks/${encodeURIComponent(task.id)}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create analysis task');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContent className="yj-page-shell">
      <div className="yj-page-header">
        <h2 className="yj-page-title">New analysis task</h2>
      </div>

      <div className="yj-panel yj-form-card space-y-6">
        <div className="yj-info-panel">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4 h-4 text-fg-muted" />
            <span className="text-sm font-medium text-fg-default">Task ID</span>
          </div>
          <p className="text-xs text-fg-muted">
            The backend will assign the task UUID after creation.
          </p>
        </div>

        {loadError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {loadError}
          </div>
        )}

        {formError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {formError}
          </div>
        )}

        <FormItem label="Sample" required>
          <Select
            options={samples.map((sample) => ({
              value: sample.id,
              label: `${sample.internalId || sample.id}${!sample.matchedPair ? ' (no sequencing data)' : ''}`,
              disabled: !sample.matchedPair,
            }))}
            value={selectedSample}
            onChange={(value) => setSelectedSample(Array.isArray(value) ? value[0] : value)}
            placeholder="Select a sample"
            searchable
          />
          {selectedSampleInfo && (
            <div className="mt-2 text-xs text-fg-muted">
              {selectedSampleInfo.matchedPair ? (
                <span className="text-success-fg">Sequencing data is available.</span>
              ) : (
                <span className="text-danger-fg">No matched sequencing data.</span>
              )}
            </div>
          )}
        </FormItem>

        <FormItem label="Pipeline" required>
          <Select
            options={pipelines.map((pipeline) => ({
              value: pipeline.id,
              label: `${pipeline.name}${pipeline.version ? ` (${pipeline.version})` : ''}`,
            }))}
            value={selectedPipeline}
            onChange={(value) => setSelectedPipeline(Array.isArray(value) ? value[0] : value)}
            placeholder="Select a pipeline"
            searchable
          />
        </FormItem>

        <FormItem label="Task note">
          <Input
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            placeholder="Optional task note"
          />
        </FormItem>

        <div>
          <h3 className="text-sm font-medium text-fg-default mb-3">Advanced options</h3>
          <div className="space-y-2">
            <Checkbox
              checked={enableCNV}
              onCheckedChange={(checked) => setEnableCNV(checked === true)}
              label="Enable CNV analysis"
            />
            <Checkbox
              checked={enableSV}
              onCheckedChange={(checked) => setEnableSV(checked === true)}
              label="Enable SV analysis"
            />
          </div>
        </div>

        <div className="pt-5 border-t border-[var(--yj-border-subtle)] flex items-center justify-end">
          <Button
            variant="primary"
            leftIcon={<Play className="w-4 h-4" />}
            onClick={handleSubmit}
            loading={submitting}
            disabled={!selectedSampleInfo?.matchedPair || !selectedPipelineInfo}
          >
            {submitting ? 'Submitting...' : 'Submit task'}
          </Button>
        </div>
      </div>
    </PageContent>
  );
}
