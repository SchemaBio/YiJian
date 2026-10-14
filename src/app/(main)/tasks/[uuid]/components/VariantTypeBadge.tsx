import * as React from 'react';
import { ClinicalSignificanceBadge, type BadgeTone } from './ClinicalSignificanceBadge';

const tones: Record<string, BadgeTone> = {
  SNP:'blue', SNV:'blue', LINE1:'blue', 'LINE-1':'blue',
  INS:'teal', INSERTION:'teal', DUP:'teal', AMPLIFICATION:'teal', ALU:'teal',
  DEL:'orange', DELETION:'orange', SVA:'orange',
  MNP:'amber', INDEL:'amber', COMPLEX:'amber',
  NORMAL:'green',
};

export function VariantTypeBadge({value, children}: {value: string;children:React.ReactNode}) {
  return <ClinicalSignificanceBadge tone={tones[value.toUpperCase()] ?? 'neutral'}>{children}</ClinicalSignificanceBadge>;
}
