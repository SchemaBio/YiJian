'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { PageContent } from '@/components/layout';
import { Button, Input, Select, FormItem, Checkbox } from '@schema/ui-kit';
import { Play, Info, Loader2, Upload } from 'lucide-react';
import { requestPairedUploadJob, uploadToCOS } from '@/lib/api';
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
  const [uploadJobId, setUploadJobId] = React.useState('');
  const [r1File, setR1File] = React.useState<File | null>(null);
  const [r2File, setR2File] = React.useState<File | null>(null);
  const [uploadingFiles, setUploadingFiles] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [uploadNotice, setUploadNotice] = React.useState('');
  const [enableCNV, setEnableCNV] = React.useState(true);
  const [enableSV, setEnableSV] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState('');

  const selectedSampleInfo = samples.find((sample) => sample.id === selectedSample);
  const selectedPipelineInfo = pipelines.find((pipeline) => pipeline.id === selectedPipeline);
  const uploadJobID = uploadJobId.trim();
  const hasSequencingInput = Boolean(selectedSampleInfo?.matchedPair || uploadJobID);

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
    if (!hasSequencingInput) {
      setFormError('The selected sample has no matched sequencing data. Provide an Upload job ID or upload paired FASTQ files.');
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
        ...(uploadJobID ? { uploadJobId: uploadJobID } : {}),
      });
      router.push(`/tasks/${encodeURIComponent(task.id)}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create analysis task');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePairedUpload = async () => {
    if (!r1File || !r2File || uploadingFiles) {
      setFormError('Please choose both R1 and R2 FASTQ files before uploading.');
      return;
    }

    setUploadingFiles(true);
    setUploadProgress(0);
    setUploadNotice('');
    setFormError('');
    try {
      const job = await requestPairedUploadJob(r1File, r2File, selectedSampleInfo?.id);
      const r1 = job.files.find(file => file.read_type === 'read1');
      const r2 = job.files.find(file => file.read_type === 'read2');
      if (!r1 || !r2) {
        throw new Error('Upload job did not return both R1 and R2 upload URLs');
      }

      await uploadToCOS(r1.upload_url, r1File, pct => setUploadProgress(Math.round(pct / 2)));
      await uploadToCOS(r2.upload_url, r2File, pct => setUploadProgress(50 + Math.round(pct / 2)));
      setUploadJobId(job.job_id);
      setUploadProgress(100);
      setUploadNotice(`Upload job ${job.job_id} is ready; Octopus will inject fastq_r1/fastq_r2 from this job.`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to upload paired FASTQ files');
    } finally {
      setUploadingFiles(false);
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

        <div className="rounded-md border border-border bg-canvas-subtle p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-fg-default">Paired FASTQ upload / Upload job</div>
              <div className="text-xs text-fg-muted">
                If the sample has no matched_pair, use a completed Octopus upload job or upload R1/R2 here.
              </div>
            </div>
            <Button
              variant="secondary"
              onClick={handlePairedUpload}
              disabled={!r1File || !r2File || uploadingFiles || submitting}
              leftIcon={uploadingFiles ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            >
              {uploadingFiles ? `Uploading ${uploadProgress}%` : 'Upload pair'}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="block rounded border border-dashed border-border bg-canvas-default px-3 py-2 text-xs text-fg-muted">
              <span className="block font-medium text-fg-default">R1 FASTQ</span>
              <span className="block truncate">{r1File?.name || 'Choose read1 file'}</span>
              <input
                type="file"
                accept=".fq,.fastq,.fq.gz,.fastq.gz,.gz"
                className="hidden"
                disabled={uploadingFiles || submitting}
                onChange={(e) => setR1File(e.target.files?.[0] ?? null)}
              />
            </label>
            <label className="block rounded border border-dashed border-border bg-canvas-default px-3 py-2 text-xs text-fg-muted">
              <span className="block font-medium text-fg-default">R2 FASTQ</span>
              <span className="block truncate">{r2File?.name || 'Choose read2 file'}</span>
              <input
                type="file"
                accept=".fq,.fastq,.fq.gz,.fastq.gz,.gz"
                className="hidden"
                disabled={uploadingFiles || submitting}
                onChange={(e) => setR2File(e.target.files?.[0] ?? null)}
              />
            </label>
            <label className="block text-xs text-fg-muted">
              Upload job ID
              <Input
                value={uploadJobId}
                onChange={(e) => setUploadJobId(e.target.value)}
                placeholder="Completed upload job UUID"
                disabled={uploadingFiles || submitting}
              />
            </label>
          </div>
          {uploadNotice && (
            <div className="mt-2 text-xs text-success-fg">{uploadNotice}</div>
          )}
          {selectedSampleInfo && !selectedSampleInfo.matchedPair && !uploadJobID && (
            <div className="mt-2 text-xs text-amber-700">
              This sample has no Octopus matched_pair. A valid Upload job ID is required before creating the task.
            </div>
          )}
        </div>

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
            disabled={!hasSequencingInput || !selectedPipelineInfo || uploadingFiles}
          >
            {submitting ? 'Submitting...' : 'Submit task'}
          </Button>
        </div>
      </div>
    </PageContent>
  );
}
