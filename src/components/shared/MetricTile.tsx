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
    success: 'bg-success-subtle text-success-fg',
    warning: 'bg-warning-subtle text-warning-fg',
    info: 'bg-accent-subtle text-accent-fg',
  }[tone];
  const capacityFillClass = capacityFill ? {
    safe: 'bg-success-emphasis',
    warning: 'bg-warning-emphasis',
    danger: 'bg-danger-emphasis',
  }[capacityFill.tone] : '';
  const capacityPercent = capacityFill
    ? Math.min(100, Math.max(0, capacityFill.percent))
    : 0;

  return (
    <div className="relative min-w-[136px] overflow-hidden rounded-md border border-[var(--yj-border-subtle)] bg-[var(--yj-panel-bg)] px-4 py-3 shadow-[var(--yj-shadow-panel)]">
      {capacityFill && (
        <div
          aria-hidden="true"
          className={`absolute bottom-0 left-0 h-1 ${capacityFillClass}`}
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
