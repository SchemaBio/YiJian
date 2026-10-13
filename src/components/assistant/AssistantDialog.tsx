'use client';
import { useText } from '@/i18n/useText';


import { ActionButton, IconActionButton } from '@/components/shared/ActionButton';

import { HoverHint } from '@/components/shared/HoverHint';


import * as React from 'react';
import { Settings, AlertCircle } from 'lucide-react';
import { useAI } from '@/components/providers/AIProvider';
import { AssistantChat } from './AssistantChat';
import Link from 'next/link';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';

interface AssistantDialogProps {
  onClose: () => void;
  isMobile: boolean;
}

/**
 * AI 助手对话框
 * 展开后显示聊天界面
 */
export function AssistantDialog({ onClose, isMobile }: AssistantDialogProps) {
  const t = useText();
  const { isEnabled, isConfigured, clearHistory } = useAI();
  const isSaaS = getRuntimeBackendFlavor() === 'squid';
  const dialogRef = React.useRef<HTMLDivElement>(null);

  // 点击外部关闭
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // ESC 键关闭
  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // 位置样式：向上展开
  const positionStyle = isMobile
    ? 'fixed bottom-24 right-4 z-50'
    : 'fixed bottom-20 right-4 z-50';

  // 尺寸样式
  const sizeStyle = isMobile
    ? 'w-[calc(100vw-32px)] max-h-[60vh]'
    : 'w-[360px] max-h-[480px]';

  // 清空历史
  const handleClearHistory = () => {
    if (confirm(t("assistance.clearConversationHistory25fd8c"))) {
      clearHistory();
    }
  };

  return (
    <div
      ref={dialogRef}
      className={`
        ${positionStyle}
        ${sizeStyle}
        flex flex-col
        bg-canvas-default
        border border-border
        rounded-lg
        shadow-xl
        animate-in slide-in-from-bottom-2 fade-in-0 duration-200
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <img src="/mascot.png" alt={t("assistance.xiaomo31ed60")} className="w-5 h-5 object-contain" />
          <span className="font-medium text-fg-default">{t("assistance.xiaomo31ed60")}</span>
        </div>
        <IconActionButton label={t("tasks.close6c14bd")} action="close" variant="ghost"
          onClick={onClose}
          className="p-1 rounded hover:bg-canvas-subtle text-fg-muted hover:text-fg-default transition-colors"

         />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {!isConfigured ? (
          // 未配置提示
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <AlertCircle className="w-8 h-8 text-fg-muted mb-2" />
            <p className="text-sm text-fg-muted mb-4">
              {t("assistance.configureTheAiServiceFirst4a3222")}</p>
            {!isSaaS && (
              <Link
                href="/admin"
                onClick={onClose}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-accent-emphasis text-white hover:opacity-90 transition-colors"
              >
                <Settings className="w-4 h-4" />
                {t("assistance.configure776cc3")}</Link>
            )}
          </div>
        ) : !isEnabled ? (
          // 已禁用提示
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <img src="/mascot.png" alt={t("assistance.xiaomo31ed60")} className="w-8 h-8 object-contain mb-2" />
            <p className="text-sm text-fg-muted mb-4">
              {t("assistance.xiaomoDisabled8ff96c")}</p>
            {!isSaaS && (
              <Link
                href="/admin"
                onClick={onClose}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-gray-500 text-white hover:opacity-80 transition-colors"
              >
                <Settings className="w-4 h-4" />
                {t("assistance.goToSettings9ea2c9")}</Link>
            )}
          </div>
        ) : (
          // 聊天界面
          <AssistantChat />
        )}
      </div>

      {/* Footer */}
      {isConfigured && isEnabled && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-border shrink-0">
          <span className="text-xs text-fg-muted">
            {t("assistance.enterNaturalLanguageInstructionsToControlThec3e72d")}</span>
          <HoverHint content={t("assistance.clearHistory578bbc")}><ActionButton action="delete" variant="ghost"
            onClick={handleClearHistory}
            className="flex items-center gap-1 px-2 py-1 text-xs text-fg-muted hover:text-fg-default hover:bg-canvas-subtle rounded transition-colors"

          >

            {t("assistance.clear84fcd7")}</ActionButton></HoverHint>
        </div>
      )}
    </div>
  );
}
