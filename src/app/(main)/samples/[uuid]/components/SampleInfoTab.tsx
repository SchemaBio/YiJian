'use client';
import { getSampleQualityDisplay, getSamplePriorityLabel, formatTurnaroundDays } from '@/lib/sample-display';
import { HoverHint } from '@/components/shared/HoverHint';


import * as React from 'react';
import { formatDateTime } from '@/lib/date-time';
import { Tag } from '@schema/ui-kit';
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
  const genderInfo = GENDER_CONFIG[sample.gender];

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <InfoCard title="基本信息" wide>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <InfoItem label="样本编号" value={<span className="font-mono text-xs">{sample.id}</span>} />
          <InfoItem label="内部编号" value={sample.internalId} />
          <InfoItem label="性别" value={<span className={genderInfo.color}>{genderInfo.label}</span>} />
          <InfoItem label="年龄" value={sample.age !== undefined ? `${sample.age}岁` : '-'} />
          <InfoItem label="样本类型" value={sample.sampleType} />
          <InfoItem label="批次" value={sample.batch} />
          <InfoItem label="创建时间" value={formatDateTime(sample.createdAt)} />
          <InfoItem label="更新时间" value={formatDateTime(sample.updatedAt)} />
        </div>
      </InfoCard>

      <InfoCard title="匹配数据" wide>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sample.matchedPair ? (
            <>
              <InfoItem label="R1路径" value={<span className="font-mono text-xs break-all">{sample.matchedPair.r1Path}</span>} />
              <InfoItem label="R2路径" value={<span className="font-mono text-xs break-all">{sample.matchedPair.r2Path}</span>} />
            </>
          ) : (
            <InfoItem label="匹配数据" value="暂无匹配数据" />
          )}
        </div>
      </InfoCard>

      <InfoCard title="送检信息">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sample.submissionInfo && (
            <>
              <InfoItem label="送检日期" value={sample.submissionInfo.submissionDate} />
              <InfoItem label="采样日期" value={sample.submissionInfo.sampleCollectionDate} />
              <InfoItem label="收样日期" value={sample.submissionInfo.sampleReceiveDate} />
              <InfoItem
                label="样本质量"
                value={
                  <Tag variant={getSampleQualityDisplay(sample.submissionInfo.sampleQuality).variant}>
                    {getSampleQualityDisplay(sample.submissionInfo.sampleQuality).label}
                  </Tag>
                }
              />
            </>
          )}
        </div>
      </InfoCard>

      <InfoCard title="项目信息">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sample.projectInfo && (
            <>
              <InfoItem label="项目编号" value={sample.projectInfo.projectId} />
              <InfoItem label="项目名称" value={sample.projectInfo.projectName} />
              <InfoItem label="检测Panel" value={sample.projectInfo.panel} />
              <InfoItem label="承诺周期" value={formatTurnaroundDays(sample.projectInfo.turnaroundDays)} />
              <InfoItem
                label="优先级"
                value={
                  <Tag variant={sample.projectInfo.priority === 'urgent' ? 'danger' : 'neutral'}>
                    {getSamplePriorityLabel(sample.projectInfo.priority)}
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
  return (
      <InfoCard title="临床诊断">
        <div className="space-y-3">
          {sample.clinicalDiagnosis && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoItem label="主要诊断" value={sample.clinicalDiagnosis.mainDiagnosis} />
                {sample.clinicalDiagnosis.onsetAge && (
                  <InfoItem label="发病年龄" value={sample.clinicalDiagnosis.onsetAge} />
                )}
              </div>
              {sample.clinicalDiagnosis.symptoms && sample.clinicalDiagnosis.symptoms.length > 0 && (
                <div>
                  <span className="text-xs text-fg-muted">症状</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {sample.clinicalDiagnosis.symptoms.map((s, i) => (
                      <Tag key={i} variant="neutral">{s}</Tag>
                    ))}
                  </div>
                </div>
              )}
              {sample.clinicalDiagnosis.hpoTerms && sample.clinicalDiagnosis.hpoTerms.length > 0 && (
                <div>
                  <span className="text-xs text-fg-muted">HPO术语</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {sample.clinicalDiagnosis.hpoTerms.map((hpo, i) => (
                      <HoverHint content={hpo.name} key={i}><Tag key={i} variant="info" className="font-mono" >
                        {hpo.id}
                      </Tag></HoverHint>
                    ))}
                  </div>
                </div>
              )}
              {sample.clinicalDiagnosis.diseaseHistory && (
                <div>
                  <span className="text-xs text-fg-muted">病史</span>
                  <p className="text-sm text-fg-default mt-1">{sample.clinicalDiagnosis.diseaseHistory}</p>
                </div>
              )}
            </>
          )}
        </div>
      </InfoCard>
  );
}
