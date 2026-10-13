'use client';
import { useText } from '@/i18n/useText';


import { HoverHint } from '@/components/shared/HoverHint';


import * as React from 'react';
import { Bot, Loader2 } from 'lucide-react';
import { useAI } from '@/components/providers/AIProvider';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { AssistantDialog } from './AssistantDialog';

export function AssistantButton() {
  const t = useText();
  const { isConfigured, isExecuting } = useAI();
  const [isOpen, setIsOpen] = React.useState(false);
  const isMobile = useMediaQuery('(max-width: 767px)');

  const handleClick = () => setIsOpen(!isOpen);
  const handleClose = () => setIsOpen(false);

  const positionStyle = isMobile
    ? 'fixed bottom-20 right-4 z-40'
    : 'fixed bottom-5 right-5 z-40';

  return (
    <>
      <HoverHint content={isConfigured ? t("assistance.aiAssistant5341ec") : t("assistance.configureTheAiServiceFirst4a3222")}><button
        onClick={handleClick}
        className={`
          ${positionStyle}
          group flex h-10 w-10 items-center justify-center rounded-full
          border border-[var(--yj-border-subtle)] bg-white text-accent-fg
          shadow-[0_8px_24px_rgba(17,19,18,0.08)]
          transition-all hover:border-accent-muted hover:shadow-[0_10px_28px_rgba(17,19,18,0.12)]
          cursor-pointer focus:outline-none
        `}
        aria-label={t("assistance.aiAssistant5341ec")}

      >
        {isExecuting ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Bot className="h-5 w-5" />
        )}
      </button></HoverHint>

      {isOpen && (
        <AssistantDialog onClose={handleClose} isMobile={isMobile} />
      )}
    </>
  );
}
