import * as React from 'react';

interface MetricTileProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'info';
}

export function MetricTile({ label, value, icon, tone = 'neutral' }: MetricTileProps) {
  const toneClass = {
    neutral: 'bg-[var(--yj-panel-subtle)] text-fg-muted',
    success: 'bg-[var(--yj-sage-subtle)] text-green-700',
    warning: 'bg-orange-50 text-orange-700',
    info: 'bg-blue-50 text-blue-700',
  }[tone];

  return (
    <div className="min-w-[136px] rounded-md border border-[var(--yj-border-subtle)] bg-[var(--yj-panel-bg)] px-4 py-3 shadow-[var(--yj-shadow-panel)]">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm text-fg-muted">{label}</span>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${toneClass}`}>
          {icon}
        </span>
      </div>
      <p className="mt-4 text-2xl font-semibold leading-none text-[var(--yj-text-strong)] tabular-nums">
        {value}
      </p>
    </div>
  );
}
