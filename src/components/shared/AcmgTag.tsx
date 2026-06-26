'use client';

import * as React from 'react';
import { Tag } from '@schema/ui-kit';
import type { TagVariant } from '@schema/ui-kit';

// ACMG分类类型
export type ACMGClassification = 
  | 'Pathogenic' 
  | 'Likely_Pathogenic' 
  | 'VUS' 
  | 'Likely_Benign' 
  | 'Benign';

// ACMG配置
const ACMG_CONFIG: Record<ACMGClassification, { label: string; variant: TagVariant }> = {
  Pathogenic: { label: '致病', variant: 'danger' },
  Likely_Pathogenic: { label: '可能致病', variant: 'warning' },
  VUS: { label: '意义未明', variant: 'neutral' },
  Likely_Benign: { label: '可能良性', variant: 'info' },
  Benign: { label: '良性', variant: 'success' },
};

interface AcmgTagProps {
  /** ACMG classification value */
  classification: ACMGClassification;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ACMG classification tag component.
 * Displays ACMG pathogenicity classification with appropriate visual styling.
 *
 * @example
 * <AcmgTag classification="Pathogenic" />
 * <AcmgTag classification="VUS" />
 */
export function AcmgTag({ classification, className }: AcmgTagProps) {
  const config = ACMG_CONFIG[classification];
  if (!config) {
    return null;
  }

  return (
    <Tag variant={config.variant} className={className}>
      {config.label}
    </Tag>
  );
}

// 线粒体变异致病性类型
export type MitochondrialPathogenicity = 
  | 'Pathogenic' 
  | 'Likely_Pathogenic' 
  | 'VUS' 
  | 'Likely_Benign' 
  | 'Benign';

// 线粒体致病性配置
const MT_PATHOGENICITY_CONFIG: Record<MitochondrialPathogenicity, { label: string; variant: TagVariant }> = {
  Pathogenic: { label: '致病', variant: 'danger' },
  Likely_Pathogenic: { label: '可能致病', variant: 'warning' },
  VUS: { label: '意义未明', variant: 'neutral' },
  Likely_Benign: { label: '可能良性', variant: 'info' },
  Benign: { label: '良性', variant: 'success' },
};

interface MtPathogenicityTagProps {
  /** Mitochondrial pathogenicity value */
  pathogenicity: MitochondrialPathogenicity;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Mitochondrial variant pathogenicity tag component.
 *
 * @example
 * <MtPathogenicityTag pathogenicity="Pathogenic" />
 */
export function MtPathogenicityTag({ pathogenicity, className }: MtPathogenicityTagProps) {
  const config = MT_PATHOGENICITY_CONFIG[pathogenicity];
  if (!config) {
    return null;
  }

  return (
    <Tag variant={config.variant} className={className}>
      {config.label}
    </Tag>
  );
}

// ClinGen CNV分类类型
export type ClinGenClassification = 
  | 'Pathogenic' 
  | 'Likely_Pathogenic' 
  | 'VUS' 
  | 'Likely_Benign' 
  | 'Benign';

// ClinGen配置
const CLINGEN_CONFIG: Record<ClinGenClassification, { label: string; variant: TagVariant }> = {
  Pathogenic: { label: '致病', variant: 'danger' },
  Likely_Pathogenic: { label: '可能致病', variant: 'warning' },
  VUS: { label: '意义未明', variant: 'neutral' },
  Likely_Benign: { label: '可能良性', variant: 'info' },
  Benign: { label: '良性', variant: 'success' },
};

interface ClinGenTagProps {
  /** ClinGen classification value */
  classification: ClinGenClassification;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ClinGen CNV pathogenicity tag component.
 *
 * @example
 * <ClinGenTag classification="Pathogenic" />
 */
export function ClinGenTag({ classification, className }: ClinGenTagProps) {
  const config = CLINGEN_CONFIG[classification];
  if (!config) {
    return null;
  }

  return (
    <Tag variant={config.variant} className={className}>
      {config.label}
    </Tag>
  );
}
