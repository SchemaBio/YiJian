'use client';
import { getHpoTermName } from '@/lib/hpo-terms';
import { useText } from '@/i18n/useText';
import { translateUI } from '@/i18n/text';

import { getSampleQualityDisplay, getSamplePriorityLabel, formatTurnaroundDays } from '@/lib/sample-display';
import { HoverHint } from '@/components/shared/HoverHint';


import * as React from 'react';
import { formatDateTime } from '@/lib/date-time';
import { Tag } from '@/components/shared/Tag';
import type { SampleDetail } from '../../types';
import { GENDER_CONFIG } from '../../types';

interface SampleInfoTabProps {
  sample: SampleDetail;
}

function InfoItem({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1 ${className || ''}`}>
      <span className="text-xs text-fg-muted">{label}</span>
      <span className="text-sm break-words text-fg-default">{value || value === 0 ? value : '—'}</span>
    </div>
  );
}

function InfoCard({ title, children, wide = false }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`yj-panel p-5 ${wide ? 'xl:col-span-2' : ''}`}>
      <h4 className="text-sm font-medium text-fg-default mb-3">{title}</h4>
      {children}
    </div>
  );
}

export function SampleInfoTab({ sample }: SampleInfoTabProps) {
  const t = useText();
  const genderInfo = GENDER_CONFIG[sample.gender];

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <InfoCard title={t("samples.basicInformationb122f8")} wide>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <InfoItem label={t("history.sampleId6d686e")} value={<span className="font-mono text-xs">{sample.id}</span>} />
          <InfoItem label={t("data.internalIdabcc9d")} value={sample.internalId} />
          <InfoItem label={t("samples.sexfe8aa4")} value={<span className={genderInfo.color}>{translateUI(genderInfo.label, t)}</span>} />
          <InfoItem label={t("samples.age28c02e")} value={sample.age !== undefined ? t("samples.yearse5133f", {p0: String(sample.age)}) : '-'} />
          <InfoItem label={t("samples.sampleType686c81")} value={t(sample.sampleType)} />
          <InfoItem label={t("samples.batch6b2cf2")} value={sample.batch} />
          <InfoItem label={t("admin.createdAt84e380")} value={formatDateTime(sample.createdAt, t.locale)} />
          <InfoItem label={t("pipeline.updatedAt093dea")} value={formatDateTime(sample.updatedAt, t.locale)} />
        </div>
      </InfoCard>

      <InfoCard title={t("common.matchDatab50c4f")} wide>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sample.matchedPair ? (
            <>
              <InfoItem label={t("samples.rPath9ad9aa")} value={<span className="font-mono text-xs break-all">{sample.matchedPair.r1Path}</span>} />
              <InfoItem label={t("samples.rPathecce33")} value={<span className="font-mono text-xs break-all">{sample.matchedPair.r2Path}</span>} />
            </>
          ) : (
            <InfoItem label={t("common.matchDatab50c4f")} value={t("暂无匹配数据")} />
          )}
        </div>
      </InfoCard>

      <InfoCard title={t("samples.submissionInformation414387")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sample.submissionInfo && (
            <>
              <InfoItem label={t("samples.submissionDatefb4db3")} value={sample.submissionInfo.submissionDate} />
              <InfoItem label={t("samples.collectionDatedee8e7")} value={sample.submissionInfo.sampleCollectionDate} />
              <InfoItem label={t("samples.receiptDate5abc5a")} value={sample.submissionInfo.sampleReceiveDate} />
              <InfoItem
                label={t("samples.sampleQualitye01f54")}
                value={
                  <Tag variant={getSampleQualityDisplay(sample.submissionInfo.sampleQuality, t).variant}>
                    {translateUI(getSampleQualityDisplay(sample.submissionInfo.sampleQuality, t).label, t)}
                  </Tag>
                }
              />
            </>
          )}
        </div>
      </InfoCard>

      <InfoCard title={t("samples.projectInformation4166d1")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sample.projectInfo && (
            <>
              <InfoItem label={t("samples.projectId1bb19c")} value={sample.projectInfo.projectId} />
              <InfoItem label={t("samples.projectName3e7255")} value={sample.projectInfo.projectName} />
              <InfoItem label={t("samples.testingPanelc30b77")} value={sample.projectInfo.panel} />
              <InfoItem label={t("samples.expectedTurnarounddb3366")} value={formatTurnaroundDays(sample.projectInfo.turnaroundDays, t)} />
              <InfoItem
                label={t("samples.priority7cabe7")}
                value={
                  <Tag variant={sample.projectInfo.priority === 'urgent' ? 'danger' : 'neutral'}>
                    {getSamplePriorityLabel(sample.projectInfo.priority, t)}
                  </Tag>
                }
              />
            </>
          )}
        </div>
      </InfoCard>


    </div>
  );
}

export function ClinicalInfoTab({ sample }: SampleInfoTabProps) {
  const t = useText();
  return (
      <InfoCard title={t("samples.clinicalDiagnosis654a81")}>
        <div className="space-y-3">
          {sample.clinicalDiagnosis && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoItem label={t("samples.primaryDiagnosisc93efa")} value={sample.clinicalDiagnosis.mainDiagnosis} />
                {sample.clinicalDiagnosis.onsetAge && (
                  <InfoItem label={t("samples.ageAtOnset4cce4a")} value={sample.clinicalDiagnosis.onsetAge} />
                )}
              </div>
              {sample.clinicalDiagnosis.symptoms && sample.clinicalDiagnosis.symptoms.length > 0 && (
                <div>
                  <span className="text-xs text-fg-muted">{t("samples.symptoms233c5d")}</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {sample.clinicalDiagnosis.symptoms.map((s, i) => (
                      <Tag key={i} variant="neutral">{s}</Tag>
                    ))}
                  </div>
                </div>
              )}
              {sample.clinicalDiagnosis.hpoTerms && sample.clinicalDiagnosis.hpoTerms.length > 0 && (
                <div>
                  <span className="text-xs text-fg-muted">{t("samples.hpoTerms294b0a")}</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {sample.clinicalDiagnosis.hpoTerms.map((hpo, i) => (
                      <HoverHint content={getHpoTermName(hpo, t.locale)} key={i}><Tag key={i} variant="info" className="font-mono" >
                        {hpo.id}
                      </Tag></HoverHint>
                    ))}
                  </div>
                </div>
              )}
              {sample.clinicalDiagnosis.diseaseHistory && (
                <div>
                  <span className="text-xs text-fg-muted">{t("samples.medicalHistoryffc833")}</span>
                  <p className="text-sm text-fg-default mt-1">{sample.clinicalDiagnosis.diseaseHistory}</p>
                </div>
              )}
            </>
          )}
        </div>
      </InfoCard>
  );
}
