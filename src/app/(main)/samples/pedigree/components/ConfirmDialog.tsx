'use client';
import { useText } from '@/i18n/useText';
import { translateUI } from '@/i18n/text';


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
  confirmLabel: suppliedConfirmLabel,
  confirmVariant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  const t = useText();
  const confirmLabel = suppliedConfirmLabel ?? t("samples.confirmb56d9a");
  return (
    <SharedConfirmDialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title={translateUI(title, t)}
      message={message}
      confirmLabel={loading ? t("samples.processingdde1db") : confirmLabel}
      onConfirm={onConfirm}
      variant={confirmVariant === 'danger' ? 'danger' : 'info'}
    />
  );
}
