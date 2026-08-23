import * as React from 'react';

interface MetricTileProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'info';
  capacityFill?: {
    percent: number;
    tone: 'safe' | 'warning' | 'danger';
  };
}

export function MetricTile({ label, value, icon, tone = 'neutral', capacityFill }: MetricTileProps) {
  const toneClass = {
    neutral: 'bg-[var(--yj-panel-subtle)] text-fg-muted',
    success: 'bg-[var(--yj-sage-subtle)] text-green-700',
    warning: 'bg-orange-50 text-orange-700',
    info: 'bg-blue-50 text-blue-700',
  }[tone];
  const capacityFillClass = capacityFill ? {
    safe: 'bg-emerald-100/70',
    warning: 'bg-amber-100/70',
    danger: 'bg-red-100/70',
  }[capacityFill.tone] : '';
  const capacityPercent = capacityFill
    ? Math.min(100, Math.max(0, capacityFill.percent))
    : 0;

  return (
    <div className="relative min-w-[136px] overflow-hidden rounded-md border border-[var(--yj-border-subtle)] bg-[var(--yj-panel-bg)] px-4 py-3 shadow-[var(--yj-shadow-panel)]">
      {capacityFill && (
        <div
          aria-hidden="true"
          className={`absolute inset-y-0 left-0 transition-[width,background-color] duration-500 ${capacityFillClass}`}
          style={{ width: `${capacityPercent}%` }}
        />
      )}
      <div className="relative z-[1] flex items-start justify-between gap-3">
        <span className="text-sm text-fg-muted">{label}</span>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${toneClass}`}>
          {icon}
        </span>
      </div>
      <p className="relative z-[1] mt-4 text-2xl font-semibold leading-none text-[var(--yj-text-strong)] tabular-nums">
        {value}
      </p>
    </div>
  );
}
