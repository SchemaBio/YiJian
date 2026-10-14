/** Common palette for status tags and scientific classifications. */
export type BadgeTone = 'neutral' | 'amber' | 'orange' | 'red' | 'teal' | 'green' | 'blue' | 'purple';

export const badgeColors: Record<BadgeTone, string> = {
  neutral: 'bg-canvas-inset text-fg-muted border-border-default',
  amber: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200',
  orange: 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-200',
  red: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200',
  teal: 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950 dark:text-teal-200',
  green: 'bg-green-50 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200',
  blue: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-200',
  purple: 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-200',
};

export const badgeShape = 'inline-flex max-w-full items-center justify-center rounded-md border px-2 py-1 text-center text-xs font-medium';
