'use client';
import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';
import { taskStageText, taskStatusText } from '@/i18n/task-labels';
import { chineseText, translateUI, type TextTranslator } from '@/i18n/text';

import { ActionButton as Button } from '@/components/shared/ActionButton';

import { HoverHint } from '@/components/shared/HoverHint';


import * as React from 'react';
import { Tag } from '@schema/ui-kit';
import { AlertCircle, Clock3, FileText, Loader2, RefreshCw, Server } from 'lucide-react';
import { tasksApi } from '@/lib/tasks';
import type { TaskProgressResponse, TaskStatus } from '@/types/task';

interface TaskRuntimeTabProps {
  taskId: string;
  initialStatus: TaskStatus;
  onResultImportChange?: () => Promise<void>;
}

function formatTime(value?: string, t: TextTranslator = chineseText): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(t.locale, { hour12: false });
}

function statusVariant(status?: string): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  if (status === 'completed' || status === 'succeeded' || status === 'success') return 'success';
  if (status === 'failed' || status === 'error') return 'danger';
  if (status === 'running') return 'info';
  if (status === 'queued' || status === 'waiting_for_data' || status === 'pending') return 'warning';
  return 'neutral';
}

function vmStatusLabel(status?: string, t: TextTranslator = chineseText): string {
  switch ((status || '').toUpperCase()) {
    case 'WAITING_CAPACITY': return t("tasks.awaitingSpotResources320ee1");
    case 'DISPATCHING': return t("tasks.confirmingCloudStatus02a628");
    case 'PENDING': return t("tasks.instanceRequested38eb86");
    case 'RUNNING': return t("tasks.instanceRunning8f237f");
    case 'TERMINATING': return t("tasks.releasingNode982e21");
    case 'TERMINATED':
    case 'RECLAIMED': return t("tasks.nodeReleased3f8287");
    case 'LAUNCH_FAILED': return t("tasks.instanceAllocationFailedbe487f");
    default: return status || '-';
  }
}

function livenessLabel(state?: string, t: TextTranslator = chineseText): string {
  switch (state) {
    case 'online': return t("tasks.online0373ff");
    case 'delayed': return t("tasks.delayede9f092");
    case 'offline': return t("tasks.offline211357");
    case 'legacy/unknown': return t("tasks.legacyAgentUnknown89b33f");
    case 'unknown': return t("samples.unknownd9c32a");
    default: return state || t("samples.unknownd9c32a");
  }
}

function livenessVariant(state?: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (state === 'online') return 'success';
  if (state === 'delayed') return 'warning';
  if (state === 'offline') return 'danger';
  return 'neutral';
}

const executionPhaseLabels: Record<string, string> = {
  waiting_quota: '等待组织名额',
  waiting_capacity: '等待竞价节点',
  dispatching: '申请确认中',
  bootstrapping: '初始化中',
	  diagnostic_hold: '诊断日志保留中',
  running: '计算中',
  archiving: '结果归档中',
	terminating: '释放节点中',
	release_failed: '节点释放失败',
  terminal: '本次执行已结束',
};

const executionReasonLabels: Record<string, string> = {
  ORGANIZATION_INACTIVE: '组织已停用',
  ADMISSION_REJECTED: '余额不足或申请未通过',
  DISPATCH_FAILED: '执行申请未确认，系统正在对账',
  BOOTSTRAP_FAILED: '节点初始化失败',
  AGENT_EXITED: '节点 Agent 意外退出',
  MAX_RUNTIME: '超过运行时限',
  LEGACY_RECONCILIATION_REQUIRED: '等待管理员核对',
  INSTANCE_STOPPED: '云实例已停止',
	RELEASE_RETRY: '节点释放正在重试',
	RELEASE_FAILED: '节点释放失败，需要管理员处理',
	SEPIIDA_FIRST_REPORT_TIMEOUT: 'Sepiida 未按时收到任务进度',
	SEPIIDA_QUERY_UNAVAILABLE: '暂时无法读取 Sepiida 状态，已按平台故障处理',
	INPUT_REFRESH: '输入文件地址暂时无法刷新',
	NODE_FIRST_REPORT_TIMEOUT: '节点未在 10 分钟内完成首报',
	NODE_HEARTBEAT_TIMEOUT: '节点心跳中断超过 5 分钟',
	NODE_INITIALIZATION_TIMEOUT: '节点初始化超过 60 分钟',
	NODE_CALLBACK_AUTH_FAILED: '节点状态回报鉴权失败',
	NODE_CALLBACK_RATE_LIMITED: '节点状态回报被限流',
	NODE_CALLBACK_UPSTREAM_ERROR: '节点状态服务暂时异常',
	NODE_DNS_FAILED: '节点无法解析状态服务域名',
	NODE_TLS_FAILED: '节点与状态服务的 TLS 连接失败',
	BOOTSTRAP_DEPENDENCY_MISSING: '节点镜像缺少启动依赖',
	REFERENCE_DATABASE_FAILED: '参考数据库准备失败',
	INPUT_DOWNLOAD_FAILED: '输入文件下载失败',
	AGENT_START_FAILED: 'Sepiida Agent 启动失败',
};


function areTaskProgressResponsesEqual(
  previous: TaskProgressResponse,
  next: TaskProgressResponse
): boolean {
  const previousTasks = previous.tasks ?? [];
  const nextTasks = next.tasks ?? [];
  const tasksEqual = previousTasks.length === nextTasks.length
    && previousTasks.every((task, index) => {
      const candidate = nextTasks[index];
      return task.id === candidate.id
        && task.workflow_id === candidate.workflow_id
        && task.name === candidate.name
        && task.job_name === candidate.job_name
        && task.status === candidate.status
        && task.start_time === candidate.start_time
        && task.end_time === candidate.end_time
        && task.stdout === candidate.stdout
        && task.stderr === candidate.stderr;
    });
  const sepiidaEqual = previous.sepiida === next.sepiida
    || (previous.sepiida !== undefined
      && next.sepiida !== undefined
      && previous.sepiida.id === next.sepiida.id
      && previous.sepiida.uuid === next.sepiida.uuid
      && previous.sepiida.name === next.sepiida.name
      && previous.sepiida.status === next.sepiida.status
      && previous.sepiida.start_time === next.sepiida.start_time
      && previous.sepiida.end_time === next.sepiida.end_time);
  const analysisEqual = JSON.stringify(previous.analysis_progress ?? null) === JSON.stringify(next.analysis_progress ?? null);
  const nodeLivenessEqual = JSON.stringify(previous.node_liveness ?? null) === JSON.stringify(next.node_liveness ?? null);
  const agentLivenessEqual = JSON.stringify(previous.agent_liveness ?? null) === JSON.stringify(next.agent_liveness ?? null);

  return previous.id === next.id
    && previous.uuid === next.uuid
    && previous.name === next.name
    && previous.template === next.template
    && previous.status === next.status
    && previous.progress === next.progress
    && previous.created_at === next.created_at
    && previous.result_import_status === next.result_import_status
    && previous.result_import_error === next.result_import_error
    && previous.result_imported_at === next.result_imported_at
    && previous.result_import_attempts === next.result_import_attempts
    && previous.vm_status === next.vm_status
    && previous.execution_phase === next.execution_phase
    && previous.execution_reason_code === next.execution_reason_code
    && previous.attempt_id === next.attempt_id
    && previous.phase_updated_at === next.phase_updated_at
	    && previous.bootstrap_phase === next.bootstrap_phase
	    && previous.bootstrap_last_heartbeat_at === next.bootstrap_last_heartbeat_at
	    && previous.diagnostic_hold_until === next.diagnostic_hold_until
	    && previous.diagnostic_summary === next.diagnostic_summary
    && previous.dispatch_next_retry_at === next.dispatch_next_retry_at
    && previous.dispatch_retry_deadline_at === next.dispatch_retry_deadline_at
    && previous.dispatch_retry_count === next.dispatch_retry_count
    && analysisEqual
    && nodeLivenessEqual
    && agentLivenessEqual
    && sepiidaEqual
    && tasksEqual;
}

export function TaskRuntimeTab({ taskId, initialStatus, onResultImportChange }: TaskRuntimeTabProps) {
  const t = useText();
  const [progress, setProgress] = React.useState<TaskProgressResponse | null>(null);
  const [logs, setLogs] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [copied, setCopied] = React.useState(false);
  const [retryingImport, setRetryingImport] = React.useState(false);
  const [importRetryError, setImportRetryError] = React.useState('');

  const loadRuntime = React.useCallback(async (background = false) => {
    if (!background) setLoading(true);
    setError('');
    const [progressResult, logsResult] = await Promise.allSettled([
      tasksApi.getProgress(taskId),
      tasksApi.getLogs(taskId),
    ]);

    if (progressResult.status === 'fulfilled') {
      setProgress((previous) => (
        previous && areTaskProgressResponsesEqual(previous, progressResult.value)
          ? previous
          : progressResult.value
      ));
    } else {
      setError(t("tasks.taskRuntimeStatusUnavailable1f0b16"));
    }

    if (logsResult.status === 'fulfilled') {
      setLogs(logsResult.value);
    } else if (progressResult.status === 'fulfilled') {
      setError(t("tasks.taskLogsUnavailable7acb9f"));
    }
    if (!background) setLoading(false);
  }, [taskId, t]);

  React.useEffect(() => {
    void loadRuntime();
  }, [loadRuntime]);

  React.useEffect(() => {
    const status = progress?.status || initialStatus;
    const phase = progress?.execution_phase;
    const executionStillActive = [
      'waiting_quota',
      'waiting_capacity',
      'dispatching',
      'bootstrapping',
	      'diagnostic_hold',
      'running',
      'archiving',
      'terminating',
    ].includes(phase ?? '');
    const importStillActive = status === 'completed' && progress?.result_import_status === 'running';
    if (!['waiting_for_data', 'queued', 'running'].includes(status) && !executionStillActive && !importStillActive) return;
    const timer = window.setInterval(() => void loadRuntime(true), 5000);
    return () => window.clearInterval(timer);
  }, [initialStatus, loadRuntime, progress?.execution_phase, progress?.result_import_status, progress?.status]);

  const handleCopy = async () => {
    if (!logs) return;
    try {
      await navigator.clipboard.writeText(logs);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError(t("tasks.unableToCopyLogsCheckClipboardPermissions7ba8b7"));
    }
  };

  const handleRetryImport = async () => {
    setRetryingImport(true);
    setImportRetryError('');
    try {
      const next = await tasksApi.retryResultImport(taskId);
      setProgress(next);
      await loadRuntime(true);
      await onResultImportChange?.();
    } catch (cause) {
      setImportRetryError(cause instanceof Error ? errorText(cause, t) : t("tasks.unableToReimportResults4208ff"));
      await loadRuntime(true);
      await onResultImportChange?.();
    } finally {
      setRetryingImport(false);
    }
  };

  const value = Math.min(100, Math.max(0, progress?.progress ?? 0));
  const taskSteps = progress?.tasks ?? [];
  const vmStatus = progress?.vm_status?.toUpperCase();
  const executionPhase = progress?.execution_phase;
  const executionPhaseLabel = executionPhase === 'terminal'
    ? vmStatus === 'LAUNCH_FAILED'
      ? t("tasks.noComputeNodeCreatedacf8b0")
      : ['TERMINATED', 'RECLAIMED'].includes(vmStatus ?? '')
        ? t("tasks.nodeReleased3f8287")
        : executionPhaseLabels[executionPhase]
    : executionPhaseLabels[executionPhase ?? ''];
  const initializingWithoutProgress = ['bootstrapping', 'diagnostic_hold'].includes(executionPhase ?? '') && (progress?.progress ?? 0) === 0;
  const analysisProgress = progress?.analysis_progress;
  const canRetryImport = progress?.status === 'completed'
    && (progress.result_import_status === 'failed' || progress.result_import_status === 'running');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="yj-section-title">{t("tasks.runtimeStatus2a4080")}</h3>
          <p className="mt-1 text-xs text-fg-muted">{t("tasks.taskExecutionResultImportAndWorkflowLogsb0a636")}</p>
        </div>
        <Button action="refresh"
          variant="secondary"
          size="small"

          onClick={() => void loadRuntime()}
          disabled={loading}
        >
          {t("admin.refresh38108e")}</Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-warning-muted bg-warning-subtle px-3 py-2 text-sm text-warning-fg">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {(vmStatus === 'WAITING_CAPACITY' || vmStatus === 'DISPATCHING') && (
        <div className="flex items-start gap-2 rounded-md border border-warning-muted bg-warning-subtle px-3 py-2 text-sm text-warning-fg">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">{vmStatusLabel(vmStatus, t)}</p>
            {vmStatus === 'WAITING_CAPACITY' && <p className="mt-1 text-xs">{t("tasks.theSystemRetriesAutomaticallyWithoutChargingThis2bc5c1")}</p>}
            {progress?.dispatch_next_retry_at && <p className="mt-1 text-xs">{t("tasks.nextRetry38e73a")}{formatTime(progress.dispatch_next_retry_at, t)}</p>}
            {progress?.dispatch_retry_deadline_at && <p className="mt-1 text-xs">{t("tasks.waitDeadline799302")}{formatTime(progress.dispatch_retry_deadline_at, t)}</p>}
          </div>
        </div>
      )}

      {canRetryImport && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-warning-muted bg-warning-subtle px-3 py-3 text-sm text-warning-fg">
          <div>
            <p className="font-medium">{progress?.result_import_status === 'running' ? t("tasks.resultImportUnfinisheda0f228") : t("tasks.structuredResultImportFaileda4deee")}</p>
            <p className="mt-1 text-xs">{t("tasks.importResumesFromArchivedFilesWithoutAllocatingbbfbf8")}</p>
          </div>
          <Button loading={retryingImport} action="refresh" variant="secondary" size="small" onClick={() => void handleRetryImport()} disabled={retryingImport}>

            {retryingImport ? t("tasks.importingc3ddf1") : progress?.result_import_status === 'running' ? t("tasks.resumeImport3a09f5") : t("tasks.reimportResultsf469ba")}
          </Button>
        </div>
      )}
      {importRetryError && (
        <div className="rounded-md border border-danger-muted bg-danger-subtle px-3 py-2 text-sm text-danger-fg" role="alert">
          {importRetryError}
        </div>
      )}

      {executionPhase && (
        <div className="flex items-start gap-2 rounded-md border border-border-default bg-canvas-inset/40 px-3 py-2 text-sm">
          <Server className="mt-0.5 h-4 w-4 shrink-0 text-fg-muted" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-fg-muted">{t("tasks.executionStageb836fa")}</span>
              <Tag variant={executionPhase === 'terminating' || executionPhase === 'diagnostic_hold' ? 'warning' : executionPhase === 'terminal' ? 'neutral' : executionPhase === 'running' || executionPhase === 'archiving' ? 'info' : 'warning'}>
                {executionPhaseLabel ?? executionPhase}
              </Tag>
              {progress?.attempt_id && <HoverHint content={translateUI(progress.attempt_id, t)}><span className="font-mono text-xs text-fg-muted" > {t("interface.attempt323ccf")} {progress.attempt_id.slice(0, 8)}…</span></HoverHint>}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
              {progress?.phase_updated_at && <span>{t("tasks.updatedAt4668a1")}{formatTime(progress.phase_updated_at, t)}</span>}
	            {progress?.bootstrap_last_heartbeat_at && <span>{t("tasks.lastHeartbeat3b4213")}{formatTime(progress.bootstrap_last_heartbeat_at, t)}</span>}
	            {progress?.diagnostic_hold_until && <span className="text-warning-fg">{t("tasks.logsRetainedUntil4692f6")}{formatTime(progress.diagnostic_hold_until, t)}</span>}
              {progress?.execution_reason_code && <span className="text-danger-fg">{translateUI(executionReasonLabels[progress.execution_reason_code] ?? progress.execution_reason_code, t)}</span>}
            </div>
	          {progress?.diagnostic_summary && <p className="mt-2 rounded-md bg-danger-subtle px-3 py-2 text-xs text-danger-fg">{progress.diagnostic_summary}</p>}
          </div>
        </div>
      )}

      <div className="yj-panel overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-y divide-[var(--yj-border-subtle)] md:grid-cols-5 md:divide-y-0">
          <RuntimeMetric icon={<Server className="h-4 w-4" />} label={t("tasks.taskStatusb7d412")} value={<Tag variant={statusVariant(progress?.status || initialStatus)}>{taskStatusText(progress?.status || initialStatus, t)}</Tag>} />
          <RuntimeMetric icon={<Server className="h-4 w-4" />} label={t("tasks.spotInstancea176b8")} value={vmStatusLabel(vmStatus, t)} />
          <RuntimeMetric icon={<Clock3 className="h-4 w-4" />} label={t("tasks.analysisProgressa1cede")} value={initializingWithoutProgress || !analysisProgress ? '—' : `${analysisProgress.percent}%`} />
          <RuntimeMetric icon={<FileText className="h-4 w-4" />} label={t("tasks.resultImport88c130")} value={taskStatusText(progress?.result_import_status, t)} />
          <RuntimeMetric icon={<RefreshCw className="h-4 w-4" />} label={t("tasks.importAttemptsdcc827")} value={String(progress?.result_import_attempts ?? 0)} />
        </div>
        <div className="border-t border-[var(--yj-border-subtle)] p-4">
          {!initializingWithoutProgress && analysisProgress && <div className="h-2 overflow-hidden rounded-full bg-canvas-inset">
            <div className="h-full rounded-full bg-accent-emphasis transition-[width]" style={{ width: `${analysisProgress.percent}%` }} />
          </div>}
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-fg-muted">
            <span>{t("tasks.workflowe83800")}{progress?.template || progress?.name || '-'}</span>
            <span>{t("tasks.createdAt4c01f3")}{formatTime(progress?.created_at, t)}</span>
          </div>
          {progress?.result_import_error && (
            <p className="mt-3 rounded-md bg-danger-subtle px-3 py-2 text-xs text-danger-fg">{progress.result_import_error}</p>
          )}
        </div>
      </div>

      {(progress?.node_liveness || progress?.agent_liveness || analysisProgress) && (
        <section className="grid gap-3 lg:grid-cols-3">
          <div className="yj-panel p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-fg-default">{t("tasks.analysisProgressa1cede")}</h3>
              <span className="text-sm font-semibold tabular-nums text-fg-default">{analysisProgress?.percent ?? value}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-canvas-inset">
              <div className="h-full rounded-full bg-accent-emphasis transition-[width]" style={{ width: `${analysisProgress?.percent ?? value}%` }} />
            </div>
            {analysisProgress?.active_stages.length ? (
              <p className="mt-3 text-xs text-fg-muted">{t("tasks.inProgressd21970")}{analysisProgress.active_stages.map((code) => (() => { const stage = analysisProgress.stages.find(stage => stage.code === code); return stage ? taskStageText(stage, analysisProgress.profile_version, progress?.template, t) : code; })()).join(t.locale.startsWith('zh') ? '、' : ', ')}</p>
            ) : (
              <p className="mt-3 text-xs text-fg-muted">{initializingWithoutProgress ? t("tasks.awaitingWorkflowStarta15e96") : t("tasks.noAnalysisStageCurrentlyRunning60306d")}</p>
            )}
          </div>

          <div className="yj-panel p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-fg-default">{t("tasks.computeNodec5c2cb")}</h3>
              <Tag variant={livenessVariant(progress?.node_liveness?.state)}>{livenessLabel(progress?.node_liveness?.state, t)}</Tag>
            </div>
            <p className="mt-3 text-xs text-fg-muted">{t("tasks.latestNodeHeartbeat8e1517")}{formatTime(progress?.node_liveness?.last_seen_at || progress?.bootstrap_last_heartbeat_at, t)}</p>
          </div>

          <div className="yj-panel p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-fg-default">Sepiida Agent</h3>
              <Tag variant={livenessVariant(progress?.agent_liveness?.state)}>{livenessLabel(progress?.agent_liveness?.state, t)}</Tag>
            </div>
            <p className="mt-3 text-xs text-fg-muted">{t("tasks.lastCollection1a8cca")}{formatTime(progress?.agent_liveness?.last_collected_at, t)}</p>
            <p className="mt-1 text-xs text-fg-muted">{t("tasks.lastProgressReportc449f8")}{formatTime(progress?.agent_liveness?.last_progress_push_at, t)}</p>
            {progress?.agent_liveness?.collection_status === 'error' && (
              <p className="mt-2 text-xs text-warning-fg">{t("tasks.latestCollectionError402acf")}{progress.agent_liveness.error_code ? `（${progress.agent_liveness.error_code}）` : ''}</p>
            )}
          </div>
        </section>
      )}

      {analysisProgress?.stages.length ? (
        <section className="yj-panel overflow-hidden">
          <div className="yj-panel-header"><h3 className="yj-section-title">{t("tasks.analysisStages27e1eb")}</h3></div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {analysisProgress.stages.map((stage) => (
              <div key={stage.code} className="rounded-md border border-border-default p-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-fg-default">{taskStageText(stage, analysisProgress.profile_version, progress?.template, t)}</span>
                  <span className="tabular-nums text-fg-muted">{stage.percent}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-canvas-inset">
                  <div className="h-full rounded-full bg-accent-emphasis transition-[width]" style={{ width: `${stage.percent}%` }} />
                </div>
                <p className="mt-2 text-xs text-fg-muted">{t("tasks.weight5a2757")}{stage.weight}% · {stage.status === 'success' ? t("tasks.done33246f") : stage.status === 'running' ? t("tasks.inProgress6f1972") : t("tasks.waitingbd3488")}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {taskSteps.length > 0 && (
        <section className="yj-panel overflow-hidden">
          <div className="yj-panel-header"><h3 className="yj-section-title">{t("tasks.workflowSteps553bb5")}</h3></div>
          <div className="divide-y divide-[var(--yj-border-subtle)]">
            {taskSteps.map((step) => (
              <div key={step.id || step.name} className="grid grid-cols-[minmax(0,1fr)_110px_180px] items-center gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium text-fg-default">{step.name || step.job_name}</div>
                  <div className="truncate text-xs text-fg-muted">{step.job_name || '-'}</div>
                </div>
                <Tag variant={statusVariant(step.status)}>{taskStatusText(step.status, t)}</Tag>
                <div className="text-right text-xs text-fg-muted">{formatTime(step.start_time, t)}{step.end_time ? ` - ${formatTime(step.end_time, t)}` : ''}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="yj-panel overflow-hidden">
        <div className="yj-panel-header">
          <div>
            <h3 className="yj-section-title">{t("tasks.executionLogs5518c2")}</h3>
            <p className="mt-1 text-xs text-fg-muted">{t("tasks.latestWorkflowOutputdf8dee")}</p>
          </div>
          {logs && (
            <Button action={copied ? 'copied' : 'copy'} variant="secondary" size="small"  onClick={() => void handleCopy()}>
              {copied ? t("billing.copiede381a5") : t("tasks.copy4edd1d")}
            </Button>
          )}
        </div>
        {loading && !progress ? (
          <div className="flex min-h-48 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-fg-muted" /></div>
        ) : logs ? (
          <pre className="max-h-[520px] overflow-auto bg-[#111714] p-4 text-xs leading-5 text-[#dce8df]">{logs}</pre>
        ) : (
          <div className="flex min-h-48 items-center justify-center px-6 text-center text-sm text-fg-muted">{t("tasks.noExecutionLogsForThisTask8cb8bd")}</div>
        )}
      </section>
    </div>
  );
}

function RuntimeMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="p-4">
      <div className="flex items-center gap-2 text-xs text-fg-muted">{icon}{label}</div>
      <div className="mt-2 text-sm font-semibold text-fg-default">{value}</div>
    </div>
  );
}
