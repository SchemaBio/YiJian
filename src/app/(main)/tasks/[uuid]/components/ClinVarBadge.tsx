'use client';

import { useText } from '@/i18n/useText';
import { translateUI } from '@/i18n/text';

import { HoverHint } from '@/components/shared/HoverHint';
import * as React from 'react';
import { ClinicalSignificanceBadge } from './ClinicalSignificanceBadge';

export function ClinVarBadge({value}: {value?: string}) {
  const t = useText();
  const text = value?.trim();
  return <HoverHint content={translateUI(text, t)}><ClinicalSignificanceBadge value={text} className="yj-clinvar-badge">{text && !['.','-'].includes(text) ? text : t("history.notProvided071fb2")}</ClinicalSignificanceBadge></HoverHint>;
}
