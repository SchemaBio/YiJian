'use client';

import * as React from 'react';
import { Tag } from '@schema/ui-kit';
import type { TagVariant } from '@schema/ui-kit';

// 角色类型
export type RoleId = 'admin' | 'interpreter' | 'bioinformatics';

// 角色配置
const ROLE_CONFIG: Record<RoleId, { label: string; variant: TagVariant }> = {
  admin: { label: '管理员', variant: 'danger' },
  interpreter: { label: '解读工程师', variant: 'info' },
  bioinformatics: { label: '生信工程师', variant: 'success' },
};

interface RoleTagProps {
  /** Role ID to display */
  role: RoleId;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Role badge component.
 * Displays user role with appropriate visual styling.
 *
 * @example
 * <RoleTag role="admin" />
 * <RoleTag role="interpreter" />
 */
export function RoleTag({ role, className }: RoleTagProps) {
  const config = ROLE_CONFIG[role];
  if (!config) {
    return null;
  }

  return (
    <Tag variant={config.variant} className={className}>
      {config.label}
    </Tag>
  );
}

// 任务状态类型
export type TaskStatus = 
  | 'waiting_for_data'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'pending_interpretation';

// 任务状态配置
const TASK_STATUS_CONFIG: Record<TaskStatus, { label: string; variant: TagVariant }> = {
  waiting_for_data: { label: '等待数据', variant: 'warning' },
  queued: { label: '排队中', variant: 'neutral' },
  running: { label: '运行中', variant: 'info' },
  completed: { label: '已完成', variant: 'success' },
  failed: { label: '失败', variant: 'danger' },
  cancelled: { label: '已取消', variant: 'neutral' },
  pending_interpretation: { label: '待解读', variant: 'warning' },
};

// 任务状态点颜色配置
const TASK_STATUS_DOT_COLORS: Record<TaskStatus, string> = {
  waiting_for_data: 'bg-attention-emphasis',
  queued: 'bg-neutral-emphasis',
  running: 'bg-accent-emphasis',
  completed: 'bg-success-emphasis',
  failed: 'bg-danger-emphasis',
  cancelled: 'bg-neutral-emphasis',
  pending_interpretation: 'bg-attention-emphasis',
};

interface TaskStatusTagProps {
  /** Task status value */
  status: TaskStatus;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Task status tag component.
 *
 * @example
 * <TaskStatusTag status="running" />
 * <TaskStatusTag status="completed" />
 */
export function TaskStatusTag({ status, className }: TaskStatusTagProps) {
  const config = TASK_STATUS_CONFIG[status];
  if (!config) {
    return null;
  }

  return (
    <Tag variant={config.variant} className={className}>
      {config.label}
    </Tag>
  );
}

interface TaskStatusDotProps {
  /** Task status value */
  status: TaskStatus;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Task status dot indicator component.
 *
 * @example
 * <TaskStatusDot status="running" />
 */
export function TaskStatusDot({ status, className }: TaskStatusDotProps) {
  const colorClass = TASK_STATUS_DOT_COLORS[status];
  if (!colorClass) {
    return null;
  }

  return (
    <span className={`inline-block w-2 h-2 rounded-full ${colorClass} ${className || ''}`} />
  );
}
