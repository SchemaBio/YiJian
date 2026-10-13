'use client';
import { useText } from '@/i18n/useText';
import { translateUI } from '@/i18n/text';



import { taskDisplayCreatedAt, taskDisplayStatus, taskStatusConfig, taskStatusClass } from '@/lib/task-presentation';
import { HoverHint } from '@/components/shared/HoverHint';


import * as React from 'react';
import { Tag } from '@schema/ui-kit';
import { ArrowLeft, Clock, Clock3, Server, User } from 'lucide-react';
import type { AnalysisTaskDetail } from '../types';
import { TaskCostDetail } from '@/components/billing';

interface TaskHeaderProps {
  task: AnalysisTaskDetail;
  onBack: () => void;
  compact?: boolean;
  completionControl?: React.ReactNode;
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
	INPUT_REFRESH: '输入文件地址暂时无法刷新',
	NODE_FIRST_REPORT_TIMEOUT: '节点首报超时',
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


export function TaskHeader({ task, onBack, compact = false, completionControl }: TaskHeaderProps) {
  const t = useText();
  const statusInfo = taskStatusConfig[taskDisplayStatus(task)];
  const taskVMStatus = task.vmStatus?.toUpperCase();
  const executionPhaseLabel = task.executionPhase === 'terminal'
    ? taskVMStatus === 'LAUNCH_FAILED'
      ? t("tasks.noComputeNodeCreatedacf8b0")
      : ['TERMINATED', 'RECLAIMED'].includes(taskVMStatus ?? '')
        ? t("tasks.nodeReleased3f8287")
        : executionPhaseLabels[task.executionPhase]
    : executionPhaseLabels[task.executionPhase ?? ''];

  if (compact) return <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2">
    <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-1">
    <HoverHint content={t("tasks.backToTaskListcd3b22")}><button onClick={onBack} aria-label={t("tasks.backToTaskListcd3b22")}  className="shrink-0 rounded p-1.5 text-fg-muted hover:bg-canvas-subtle"><ArrowLeft className="h-4 w-4"/></button></HoverHint>
    <HoverHint content={translateUI(task.name, t)}><h1  className="min-w-0 flex-1 truncate text-base font-semibold text-fg-default">{task.name}</h1></HoverHint>
    <Tag variant={statusInfo.variant} className={`yj-task-status-tag ${taskStatusClass(taskDisplayStatus(task))}`}>{translateUI(statusInfo.label, t)}</Tag>
    </div>
    <span className="hidden text-xs text-fg-muted md:inline">{task.pipeline} · {task.pipelineVersion}</span>
    <HoverHint content={translateUI(task.id, t)}><span className="shrink-0 text-xs text-fg-muted sm:ml-auto" >{t("tasks.task6fda8e")}{task.id.substring(0,8)}</span></HoverHint>
    <TaskCostDetail taskId={task.id} status={task.status} compact/>
    {completionControl}
  </div>;

  return (
    <div className="mb-6">
      {/* 返回链接 */}
      <button
        onClick={onBack}
        className="text-sm text-fg-muted hover:text-fg-default mb-4 flex items-center gap-1 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {t("tasks.backToTaskListcd3b22")}</button>

      {/* 任务标题和状态 */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-xl font-semibold text-fg-default">{task.name}</h1>
            <Tag variant={statusInfo.variant} className={`yj-task-status-tag ${taskStatusClass(taskDisplayStatus(task))}`}>{translateUI(statusInfo.label, t)}</Tag>
          </div>

          {/* 任务信息 */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-fg-muted">
            <div className="flex items-center gap-1">
              <span className="font-medium text-fg-default">{t("tasks.sample5be4cb")}</span>
              <span className="font-mono text-xs">{task.sampleId.substring(0, 8)}</span>
              <span className="text-fg-subtle">({task.internalId})</span>
            </div>

            <div className="flex items-center gap-1">
              <span className="font-medium text-fg-default">{t("tasks.analysisPipeline072d06")}</span>
              <span>{task.pipeline}</span>
              <span className="text-fg-subtle">{task.pipelineVersion}</span>
            </div>

            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{t("tasks.createdAtd28598")}{taskDisplayCreatedAt(task)}</span>
            </div>

            <div className="flex items-center gap-1">
              <User className="w-3.5 h-3.5" />
              <span>{task.createdBy}</span>
            </div>

            {task.completedAt && (
              <div className="flex items-center gap-1">
                <span className="font-medium text-fg-default">{t("tasks.completedAt20d088")}</span>
                <span>{task.completedAt}</span>
              </div>
            )}
          </div>

          {task.executionPhase && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-border-default bg-canvas-inset/40 px-3 py-2 text-xs">
              <span className="inline-flex items-center gap-1.5 font-medium text-fg-default">
                <Server className="h-3.5 w-3.5 text-fg-muted" />
                {t("tasks.executionStage58550e")}{executionPhaseLabel ?? task.executionPhase}
              </span>
              {task.attemptId && <HoverHint content={task.attemptId}><span className="font-mono text-fg-muted" > {t("interface.attempt323ccf")} {task.attemptId.slice(0, 8)}…</span></HoverHint>}
              {task.phaseUpdatedAt && <span className="inline-flex items-center gap-1 text-fg-muted"><Clock3 className="h-3.5 w-3.5" />{new Date(task.phaseUpdatedAt).toLocaleString(t.locale, { hour12: false })}</span>}
              {task.bootstrapLastHeartbeatAt && <span className="text-fg-muted">{t("tasks.lastHeartbeat3b4213")}{new Date(task.bootstrapLastHeartbeatAt).toLocaleString(t.locale, { hour12: false })}</span>}
              {task.dispatchNextRetryAt && <span className="text-fg-muted">{t("tasks.nextRetry23d0ee")}{new Date(task.dispatchNextRetryAt).toLocaleString(t.locale, { hour12: false })}</span>}
              {task.diagnosticHoldUntil && <span className="text-warning-fg">{t("tasks.logsRetainedUntil058b69")}{new Date(task.diagnosticHoldUntil).toLocaleString(t.locale, { hour12: false })}</span>}
              {task.executionReasonCode && <span className="text-danger-fg">{translateUI(executionReasonLabels[task.executionReasonCode] ?? task.executionReasonCode, t)}</span>}
              {task.diagnosticSummary && <p className="mt-2 max-w-2xl text-xs text-danger-fg">{task.diagnosticSummary}</p>}
            </div>
          )}
        </div>

        {/* 任务ID */}
        <div className="text-right">
          <span className="text-xs text-fg-muted">{t("history.taskId6fd967")}</span>
          <HoverHint content={translateUI(task.id, t)}><div className="font-mono text-xs text-fg-subtle" >
            {task.id.substring(0, 8)}...
          </div></HoverHint>
          <div className="mt-3">
            <TaskCostDetail taskId={task.id} status={task.status} />
          </div>
        </div>
      </div>
    </div>
  );
}
