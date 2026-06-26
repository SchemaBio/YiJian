'use client';

import * as React from 'react';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from '@schema/ui-kit';
import type { ModalSize } from '@schema/ui-kit';

export interface AppModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Modal title */
  title: string;
  /** Modal size variant */
  size?: ModalSize;
  /** Whether to show the close button */
  showCloseButton?: boolean;
  /** Whether clicking the overlay closes the modal */
  closeOnOverlayClick?: boolean;
  /** Whether pressing Escape closes the modal */
  closeOnEscape?: boolean;
  /** Modal content */
  children: React.ReactNode;
  /** Optional footer content */
  footer?: React.ReactNode;
  /** Additional CSS classes for the modal content */
  className?: string;
}

/**
 * Unified modal wrapper component for the YiJian application.
 * Wraps @schema/ui-kit's Modal with consistent API and styling.
 *
 * @example
 * <AppModal open={isOpen} onOpenChange={setIsOpen} title="新建样本">
 *   <form>...</form>
 * </AppModal>
 *
 * @example
 * <AppModal
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   title="编辑任务"
 *   footer={<Button onClick={onSave}>保存</Button>}
 * >
 *   <div>Content here</div>
 * </AppModal>
 */
export function AppModal({
  open,
  onOpenChange,
  title,
  size = 'medium',
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  children,
  footer,
  className,
}: AppModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size={size}
      closeOnOverlayClick={closeOnOverlayClick}
      closeOnEscape={closeOnEscape}
      className={className}
    >
      <ModalHeader showCloseButton={showCloseButton}>
        {title}
      </ModalHeader>
      <ModalBody>
        {children}
      </ModalBody>
      {footer && (
        <ModalFooter>
          {footer}
        </ModalFooter>
      )}
    </Modal>
  );
}

interface ConfirmDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Dialog title */
  title: string;
  /** Dialog message */
  message: string;
  /** Confirm button label */
  confirmLabel?: string;
  /** Cancel button label */
  cancelLabel?: string;
  /** Callback when user confirms */
  onConfirm: () => void;
  /** Visual variant */
  variant?: 'danger' | 'warning' | 'info';
}

/**
 * Confirmation dialog component.
 * Pre-built pattern for common confirmation use cases.
 *
 * @example
 * <ConfirmDialog
 *   open={showConfirm}
 *   onOpenChange={setShowConfirm}
 *   title="确认删除"
 *   message="确定要删除这条记录吗？此操作不可撤销。"
 *   variant="danger"
 *   onConfirm={handleDelete}
 * />
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel = '确认',
  cancelLabel = '取消',
  onConfirm,
  variant = 'info',
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const buttonVariant = variant === 'danger' ? 'danger' : 'primary';

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      size="small"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={buttonVariant}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-fg-default">{message}</p>
    </AppModal>
  );
}
