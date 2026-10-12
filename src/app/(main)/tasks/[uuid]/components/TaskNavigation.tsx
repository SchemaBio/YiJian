'use client';

import * as React from 'react';
import { LayoutDashboard, Dna, Files, Copy, Layers, Repeat2, GitBranch, Zap, Users, Link2, type LucideIcon } from 'lucide-react';
import type { TabType } from '../types';

export const TaskNavigationCollapsed = React.createContext(false);

// Region copies, exon layers, repeats, insertions, energy, inheritance and homozygosity.
export const TASK_NAV_ICONS: Record<TabType, LucideIcon> = {
  overview: LayoutDashboard,
  'snv-indel': Dna,
  report: Files,
  'cnv-segment': Copy,
  'cnv-exon': Layers,
  str: Repeat2,
  mei: GitBranch,
  mt: Zap,
  upd: Users,
  roh: Link2,
};
