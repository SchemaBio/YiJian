'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { useAI } from '@/components/providers/AIProvider';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { AssistantDialog } from './AssistantDialog';

export function AssistantButton() {
  const { isConfigured, isExecuting } = useAI();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const isMobile = useMediaQuery('(max-width: 767px)');

  const handleClick = () => setIsOpen(!isOpen);
  const handleClose = () => setIsOpen(false);

  const positionStyle = isMobile
    ? 'fixed bottom-20 right-4 z-40'
    : 'fixed bottom-6 right-6 z-40';

  return (
    <>
      {/* 浮动按钮 */}
      <button
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`
          ${positionStyle}
          group cursor-pointer
          focus:outline-none
        `}
        aria-label="AI 助手"
        title={isConfigured ? 'AI 助手' : '请先配置 AI 服务'}
      >
        {/* 外层光环 */}
        <div className={`
          absolute inset-0 rounded-full
          bg-accent-emphasis/20 blur-xl
          transition-all duration-700
          ${isHovered ? 'scale-150 opacity-80' : 'scale-100 opacity-40'}
          ${isExecuting ? 'animate-pulse scale-125 opacity-60' : ''}
        `} />

        {/* 3D 容器 */}
        <div
          className={`
            relative w-24 h-24
            transition-transform duration-300 ease-out
            ${isHovered ? 'scale-110' : 'scale-100'}
          `}
          style={{ perspective: '600px' }}
        >
          {/* 浮动动画层 */}
          <div
            className="assistant-float w-full h-full"
            style={{
              transformStyle: 'preserve-3d',
              transform: isHovered
                ? 'rotateY(-8deg) rotateX(8deg) translateZ(20px)'
                : 'rotateY(0deg) rotateX(0deg) translateZ(0px)',
              transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            {/* 阴影 */}
            <div
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-16 h-3 bg-black/15 rounded-full blur-md assistant-shadow"
            />

            {/* 图片容器 */}
            <div className="relative w-full h-full drop-shadow-lg">
              {isExecuting ? (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 className="w-12 h-12 text-accent-emphasis animate-spin" />
                </div>
              ) : (
                <img
                  src="/mascot.png"
                  alt="AI 助手"
                  className="w-full h-full object-contain"
                  style={{
                    filter: isHovered
                      ? 'drop-shadow(0 8px 24px rgba(26, 127, 55, 0.35))'
                      : 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.15))',
                    transition: 'filter 0.3s ease',
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </button>

      {/* 对话框 */}
      {isOpen && (
        <AssistantDialog onClose={handleClose} isMobile={isMobile} />
      )}
    </>
  );
}