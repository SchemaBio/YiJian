'use client';

import * as React from 'react';
import { ConfirmDialog as SharedConfirmDialog } from '@/components/shared';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'primary';
  loading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = '确认',
  confirmVariant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  return (
    <SharedConfirmDialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title={title}
      message={message}
      confirmLabel={loading ? '处理中...' : confirmLabel}
      onConfirm={onConfirm}
      variant={confirmVariant === 'danger' ? 'danger' : 'info'}
    />
  );
}
