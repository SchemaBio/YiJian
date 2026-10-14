'use client';

import { Tag as KitTag, type TagProps, type TagVariant } from '@schema/ui-kit';
import { cn } from '@/lib/utils';
import { badgeColors, badgeShape, type BadgeTone } from './badge-styles';

const tones: Record<TagVariant, BadgeTone> = {
  success: 'green', warning: 'amber', danger: 'red', info: 'blue', neutral: 'neutral',
  pathogenic: 'red', 'likely-pathogenic': 'orange', vus: 'amber',
  'likely-benign': 'teal', benign: 'green',
  'tier-1': 'red', 'tier-2': 'orange', 'tier-3': 'purple', 'tier-4': 'neutral',
};

/** Application-wide tag appearance; retain ui-kit icons and removal controls. */
export function Tag({ variant, className, ...props }: TagProps) {
  return <KitTag {...props} variant={variant} className={cn(badgeShape, 'h-auto min-h-5', badgeColors[tones[variant]], className)} />;
}
