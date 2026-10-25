'use client';
import { useText } from '@/i18n/useText';
import { translateUI } from '@/i18n/text';

import { getSamplePriorityLabel, getFamilyHistoryLabel } from '@/lib/sample-display';
import { HoverHint } from '@/components/shared/HoverHint';


import * as React from 'react';
import { ToolbarPopover } from '@/components/shared/ToolbarPopover';
import { Tag } from '@/components/shared/Tag';
import { User, HeartPulse, Users } from 'lucide-react';
import type { SampleDetail } from '@/app/(main)/samples/types';
import { GENDER_CONFIG } from '@/app/(main)/samples/types';
import { getSampleDetail, updateSampleHpoTerms } from '@/lib/samples';
import { errorText } from '@/i18n/errors';
import { SampleHpoTerms } from './SampleHpoTerms';

interface SampleSummaryCardProps {
  sample: SampleDetail;
  onSampleChange?: (sample: SampleDetail) => void;
}

function SampleDetails({ sample, refreshing, onHpoSave }: {
  sample: SampleDetail; refreshing: boolean; onHpoSave: (terms: {id:string;name:string}[]) => Promise<void>;
}) {
  const t = useText();
  const genderInfo = GENDER_CONFIG[sample.gender];
  const isMatched = sample.matchedPair !== null;

  return (
    <div className="space-y-4">
      {/* 第一行：基本信息 */}
      <div className="flex flex-wrap items-center gap-4 mb-3 pb-3 border-b border-border-default">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-fg-muted" />
          <span className="font-medium text-fg-default">{sample.internalId}</span>
          <span className={`text-sm ${genderInfo.color}`}>{translateUI(genderInfo.label, t)}</span>
          {sample.age !== undefined && (
            <span className="text-sm text-fg-muted">{sample.age}{t("tasks.years86f133")}</span>
          )}
          <Tag variant={isMatched ? 'success' : 'warning'}>
            {isMatched ? t("samples.matched113028") : t("samples.unmatched434b19")}
          </Tag>
        </div>
        <div className="flex items-center gap-1 text-xs text-fg-muted">
          <span>{t("tasks.sampleId5b0613")}</span>
          <span className="font-mono">{sample.id.substring(0, 8)}...</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-fg-muted">
          <span>{t("tasks.sampleType542dc8")}</span>
          <span>{t(sample.sampleType)}</span>
        </div>
        {sample.projectInfo && (
          <>
            {(sample.projectInfo.panel || sample.projectInfo.projectName) && (
            <div className="flex items-center gap-1 text-xs text-fg-muted">
              <span>{t("tasks.testingPanel0370b2")}</span>
              <span>{sample.projectInfo.panel || sample.projectInfo.projectName}</span>
            </div>
            )}
            {(sample.projectInfo.priority === 'normal' || sample.projectInfo.priority === 'urgent') && (
            <Tag
              variant={sample.projectInfo.priority === 'urgent' ? 'danger' : 'neutral'}
            >
              {getSamplePriorityLabel(sample.projectInfo.priority, t)}
            </Tag>
            )}
          </>
        )}
      </div>

      <section className="space-y-4" aria-label={t('samples.clinicalDiagnosis654a81')}>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-fg-default"><HeartPulse className="h-4 w-4 text-fg-muted" />{t('samples.clinicalDiagnosis654a81')}</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="min-w-0 space-y-3 rounded-md border border-border-default bg-canvas-default p-3">
            <h4 className="text-xs font-medium text-fg-muted">{t('samples.primaryDiagnosisc93efa')}</h4>
            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-fg-default">{sample.clinicalDiagnosis?.mainDiagnosis || t('history.notProvided071fb2')}</p>
            {!!sample.clinicalDiagnosis?.symptoms?.length && <div className="space-y-2">
              <h5 className="text-xs text-fg-muted">{t('samples.symptoms233c5d')}</h5>
              <div className="flex flex-wrap gap-1.5">{sample.clinicalDiagnosis.symptoms.map((symptom,i)=><Tag key={i} variant="neutral">{symptom}</Tag>)}</div>
            </div>}
          </div>
          <div className="min-w-0 space-y-3 rounded-md border border-border-default bg-canvas-default p-3">
            <h4 className="flex items-center gap-1.5 text-xs font-medium text-fg-muted"><Users className="h-3.5 w-3.5" />{t('samples.familyHistory35fef1')}</h4>
            <p className="text-sm leading-6 text-fg-default">{getFamilyHistoryLabel(sample.familyHistory?.hasHistory,t)}</p>
            {sample.familyHistory?.hasHistory && !!sample.familyHistory.affectedMembers?.length && <ul className="space-y-2 text-sm">
              {sample.familyHistory.affectedMembers.map((member,i)=><li key={i} className="flex flex-wrap items-start gap-x-2 gap-y-1"><span className="shrink-0 font-medium text-fg-default">{member.relation}</span><span className="min-w-0 whitespace-pre-wrap break-words text-fg-muted">{member.condition}</span></li>)}
            </ul>}
          </div>
        </div>
        <SampleHpoTerms terms={sample.clinicalDiagnosis?.hpoTerms ?? []} refreshing={refreshing} onSave={onHpoSave} />
      </section>
    </div>
  );
}
export function SampleSummaryCard({sample: providedSample, onSampleChange}: SampleSummaryCardProps) {
  const t = useText();
  const [sample, setSample] = React.useState(providedSample);
  const sampleRef = React.useRef(sample); sampleRef.current = sample;
  const [refreshing, setRefreshing] = React.useState(false);
  const [refreshError, setRefreshError] = React.useState('');
  const sequence = React.useRef(0);
  const activeId = React.useRef(providedSample.id); activeId.current = providedSample.id;
  React.useEffect(() => { setSample(providedSample); }, [providedSample]);
  React.useEffect(() => () => { sequence.current++; }, []);
  const refresh = async () => {
    const id = providedSample.id, request = ++sequence.current;
    setRefreshing(true); setRefreshError('');
    try {
      const latest = await getSampleDetail(id);
      if (sequence.current !== request || activeId.current !== id) return;
      if (!latest) throw new Error(t('samples.sampleNotFound73e415'));
      setSample(latest); onSampleChange?.(latest);
    } catch (cause) {
      if (sequence.current === request && activeId.current === id) setRefreshError(cause instanceof Error ? errorText(cause, t) : t('interface.failedToLoadSample0c1b77'));
    } finally { if (sequence.current === request && activeId.current === id) setRefreshing(false); }
  };
  const saveHpo = async (terms: {id:string;name:string}[]) => {
    const id = sample.id;
    sequence.current++; setRefreshing(false);
    const updated = await updateSampleHpoTerms(id, terms);
    if (activeId.current !== id) return;
    sequence.current++; setRefreshing(false);
    const latest = sampleRef.current;
    const next = {...latest, updatedAt:updated.updatedAt, clinicalDiagnosis:{...latest.clinicalDiagnosis, hpoTerms:updated.hpoTerms}};
    setSample(next); onSampleChange?.(next);
    setRefreshError('');
  };
 const gender = GENDER_CONFIG[sample.gender];
 return <div className="mb-2 flex min-w-0 items-center gap-3 rounded-md bg-canvas-subtle px-3 py-2 text-xs">
  <User className="h-3.5 w-3.5 shrink-0 text-fg-muted"/>
  <span className="shrink-0 font-semibold text-fg-default">{sample.internalId}</span>
  <span className={`shrink-0 ${gender.color}`}>{translateUI(gender.label, t)}{sample.age !== undefined ? t("tasks.years519b9d", {p0: String(sample.age)}) : ''}</span>
  <span className="hidden shrink-0 text-fg-muted sm:inline">{t(sample.sampleType)}</span>
  <HoverHint content={translateUI(sample.clinicalDiagnosis?.mainDiagnosis, t)}><span className="min-w-0 flex-1 truncate text-fg-muted" >{t("tasks.diagnosis48c02c")}{sample.clinicalDiagnosis?.mainDiagnosis || t("history.notProvided071fb2")}</span></HoverHint>
  <ToolbarPopover label={t("tasks.sampleDetailsb6d180")} wide onOpenChange={open => { if (open) void refresh(); }}>
    {refreshError && <p role="alert" className="mb-3 text-xs text-danger-fg">{refreshError}</p>}
    <SampleDetails key={sample.id} sample={sample} refreshing={refreshing} onHpoSave={saveHpo}/>
  </ToolbarPopover>
 </div>;
}
