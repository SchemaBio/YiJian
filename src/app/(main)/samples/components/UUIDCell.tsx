'use client';
import { IconActionButton } from '@/components/shared/ActionButton';


import * as React from 'react';
import { Tooltip } from '@schema/ui-kit';

interface UUIDCellProps {
  uuid: string;
  truncateLength?: number;
}

/**
 * UUID展示组件
 *
 * 展示方式：截断显示前8位，hover时tooltip显示完整UUID，点击复制按钮可复制完整UUID
 *
 * 业界常见做法参考：
 * - GitHub commit hash: 前7位
 * - Docker container ID: 前12位
 * - MongoDB ObjectId: 前8位
 */
export function UUIDCell({ uuid, truncateLength = 8 }: UUIDCellProps) {
  const [copied, setCopied] = React.useState(false);

  const truncated = uuid.slice(0, truncateLength);
  const isTruncated = uuid.length > truncateLength;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(uuid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy UUID:', err);
    }
  };

  const content = (
    <div className="flex items-center gap-1.5 group">
      <span className="font-mono text-xs text-accent-fg hover:underline cursor-pointer">
        {isTruncated ? truncated : uuid}
      </span>
      <IconActionButton action={copied ? 'copied' : 'copy'} size="small" label={copied ? '已复制完整 UUID' : '复制完整UUID'} variant="ghost"
        onClick={handleCopy}
        className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 p-1 rounded hover:bg-canvas-subtle transition-opacity"
      />
    </div>
  );

  if (isTruncated) {
    return (
      <Tooltip content={uuid} placement="top" variant="nav">
        {content}
      </Tooltip>
    );
  }

  return content;
}
