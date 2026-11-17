'use client';
import { Tooltip } from '@schema/ui-kit';
import { useText } from '@/i18n/useText';
import { usePublicResult } from '@/components/shared/PublicResultContext';
interface PositionLinkProps {
  chromosome: string;
  position: number;
  label?: string;
  onClick: (chromosome: string, position: number) => void;
}

export function PositionLink({ chromosome, position, label, onClick }: PositionLinkProps) {
  const t = useText();
  const publicResult = usePublicResult();
  if (publicResult) return <span className="text-accent-fg">{label ?? `${chromosome}:${position}`}</span>;
  return (
    <Tooltip content={t("tasks.viewInThisTaskIgvEvidence7d29a6")} placement="top" variant="nav">
      <button onClick={event => { event.stopPropagation(); onClick(chromosome, position); }} className="text-left text-accent-fg hover:underline">
        {label ?? `${chromosome}:${position}`}
      </button>
    </Tooltip>
  );
}
