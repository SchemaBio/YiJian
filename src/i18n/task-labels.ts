import type { TextTranslator } from './text';

const statuses: Record<string, string> = {
  waiting_for_data: 'tasks.awaitingData85354f', queued: 'admin.queued4dcbbc',
  pending: 'tasks.waitingbd3488', running: 'admin.running594249',
  completed: 'admin.completede99b48', succeeded: 'admin.completede99b48', success: 'admin.completede99b48',
  failed: 'admin.failed3e3c80', error: 'admin.failed3e3c80', cancelled: 'admin.canceleda5ffdc',
  canceled: 'admin.canceleda5ffdc', skipped: 'tasks.skipped9f38af', pending_interpretation: 'tasks.awaitingInterpretation0b7bdd',
};
export function taskStatusText(status: string | undefined, t: TextTranslator) {
  return status ? (statuses[status] ? t(statuses[status]) : status) : '—';
}

const stages: Record<string, string> = {
  preparation: 'preparation', alignment: 'alignment', quality_control: 'qualityControl',
  small_variants: 'smallVariants', secondary_analysis: 'secondaryAnalysis', family_variants: 'familyVariants',
  preprocessing: 'preprocessing', coverage: 'coverage', new_reference: 'newReference', reference_merge: 'referenceMerge',
};
export function taskStageText(stage: {code: string; label: string}, profile: string | undefined, template: string | undefined, t: TextTranslator) {
  // Only this versioned backend profile has known stage semantics. Custom
  // workflow labels are business content and stay original.
  if (profile !== 'germline-v2-progress-1' || !stages[stage.code]) return stage.label;
  const overrides: Record<string, Record<string, string>> = {
    germline_trio: {alignment: 'trioAlignment', quality_control: 'trioQualityControl', secondary_analysis: 'trioSecondaryAnalysis'},
    germline_baseline_fix: {preparation: 'inputPreparation', alignment: 'baselineAlignment'},
  };
  return t(`runtime.${overrides[template ?? '']?.[stage.code] ?? stages[stage.code]}`);
}

const reportErrors: Record<string, string> = {
  REPORT_SERVICE_FAILED: 'reportServiceFailed', REPORT_FILE_INVALID: 'reportFileInvalid',
  REPORT_STORAGE_FAILED: 'reportStorageFailed', REPORT_PROCESS_INTERRUPTED: 'reportInterrupted',
};
export function reportErrorText(code: string, t: TextTranslator) {
  return reportErrors[code] ? t(`runtime.${reportErrors[code]}`) : code;
}
