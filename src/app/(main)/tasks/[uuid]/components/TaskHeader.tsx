'use client';

import * as React from 'react';
import { Tag, Button } from '@schema/ui-kit';
import { ArrowLeft, Clock, Clock3, Server, User } from 'lucide-react';
import type { AnalysisTaskDetail, AnalysisStatus } from '../types';
import { TaskCostDetail } from '@/components/billing';

interface TaskHeaderProps {
  task: AnalysisTaskDetail;
  onBack: () => void;
}

const statusConfig: Record<AnalysisStatus, { label: string; variant: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }> = {
  waiting_for_data: { label: '等待数据', variant: 'warning' },
  queued: { label: '排队中', variant: 'neutral' },
  running: { label: '运行中', variant: 'info' },
  completed: { label: '已完成', variant: 'success' },
  failed: { label: '失败', variant: 'danger' },
  cancelled: { label: '已取消', variant: 'neutral' },
  pending_interpretation: { label: '待解读', variant: 'warning' },
};

const executionPhaseLabels: Record<string, string> = {
  waiting_quota: '等待组织名额',
  waiting_capacity: '等待竞价节点',
  dispatching: '申请确认中',
  bootstrapping: '节点初始化中',
  running: '计算中',
  archiving: '结果归档中',
  terminating: '释放节点中',
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
  INPUT_REFRESH: '输入文件地址暂时无法刷新',
};

export function TaskHeader({ task, onBack }: TaskHeaderProps) {
  const statusInfo = statusConfig[task.status];

  return (
    <div className="mb-6">
      {/* 返回链接 */}
      <button
        onClick={onBack}
        className="text-sm text-fg-muted hover:text-fg-default mb-4 flex items-center gap-1 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        返回任务列表
      </button>

      {/* 任务标题和状态 */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-xl font-semibold text-fg-default">{task.name}</h1>
            <Tag variant={statusInfo.variant}>{statusInfo.label}</Tag>
          </div>
          
          {/* 任务信息 */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-fg-muted">
            <div className="flex items-center gap-1">
              <span className="font-medium text-fg-default">样本:</span>
              <span className="font-mono text-xs">{task.sampleId.substring(0, 8)}</span>
              <span className="text-fg-subtle">({task.internalId})</span>
            </div>

            <div className="flex items-center gap-1">
              <span className="font-medium text-fg-default">分析流程:</span>
              <span>{task.pipeline}</span>
              <span className="text-fg-subtle">{task.pipelineVersion}</span>
            </div>
            
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>创建于 {task.createdAt}</span>
            </div>
            
            <div className="flex items-center gap-1">
              <User className="w-3.5 h-3.5" />
              <span>{task.createdBy}</span>
            </div>

            {task.completedAt && (
              <div className="flex items-center gap-1">
                <span className="font-medium text-fg-default">完成于:</span>
                <span>{task.completedAt}</span>
              </div>
            )}
          </div>

          {task.executionPhase && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-border-default bg-canvas-inset/40 px-3 py-2 text-xs">
              <span className="inline-flex items-center gap-1.5 font-medium text-fg-default">
                <Server className="h-3.5 w-3.5 text-fg-muted" />
                执行阶段：{executionPhaseLabels[task.executionPhase] ?? task.executionPhase}
              </span>
              {task.attemptId && <span className="font-mono text-fg-muted" title={task.attemptId}>attempt: {task.attemptId.slice(0, 8)}…</span>}
              {task.phaseUpdatedAt && <span className="inline-flex items-center gap-1 text-fg-muted"><Clock3 className="h-3.5 w-3.5" />{new Date(task.phaseUpdatedAt).toLocaleString('zh-CN', { hour12: false })}</span>}
              {task.dispatchNextRetryAt && <span className="text-fg-muted">下次重试 {new Date(task.dispatchNextRetryAt).toLocaleString('zh-CN', { hour12: false })}</span>}
              {task.executionReasonCode && <span className="text-danger-fg">{executionReasonLabels[task.executionReasonCode] ?? task.executionReasonCode}</span>}
            </div>
          )}
        </div>

        {/* 任务ID */}
        <div className="text-right">
          <span className="text-xs text-fg-muted">任务ID</span>
          <div className="font-mono text-xs text-fg-subtle" title={task.id}>
            {task.id.substring(0, 8)}...
          </div>
          <div className="mt-3">
            <TaskCostDetail taskId={task.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
