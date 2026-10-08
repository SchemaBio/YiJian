'use client';
import { getSampleQualityDisplay, getSamplePriorityLabel, getFamilyHistoryLabel, formatTurnaroundDays } from '@/lib/sample-display';
import { HoverHint } from '@/components/shared/HoverHint';


import * as React from 'react';
import { ToolbarPopover } from '@/components/shared/ToolbarPopover';
import { Tag } from '@schema/ui-kit';
import { User, Calendar, FlaskConical, HeartPulse, Users } from 'lucide-react';
import type { SampleDetail } from '@/app/(main)/samples/types';
import { GENDER_CONFIG } from '@/app/(main)/samples/types';

interface SampleSummaryCardProps {
  sample: SampleDetail;
}

function InfoSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="flex items-center gap-1 text-fg-muted min-w-[100px]">
        {icon}
        <span className="text-xs">{title}</span>
      </div>
      <div className="min-w-0 flex-1 text-sm text-fg-default">{children}</div>
    </div>
  );
}

function InfoItem({ label, value, className = '' }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-xs text-fg-muted min-w-[60px]">{label}</span>
      <span className="text-sm text-fg-default">{value || '-'}</span>
    </div>
  );
}

function SampleDetails({ sample }: SampleSummaryCardProps) {
  const genderInfo = GENDER_CONFIG[sample.gender];
  const isMatched = sample.matchedPair !== null;

  return (
    <div className="space-y-4">
      {/* 第一行：基本信息 */}
      <div className="flex flex-wrap items-center gap-4 mb-3 pb-3 border-b border-border-default">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-fg-muted" />
          <span className="font-medium text-fg-default">{sample.internalId}</span>
          <span className={`text-sm ${genderInfo.color}`}>{genderInfo.label}</span>
          {sample.age !== undefined && (
            <span className="text-sm text-fg-muted">{sample.age}岁</span>
          )}
          <Tag variant={isMatched ? 'success' : 'warning'}>
            {isMatched ? '已匹配' : '未匹配'}
          </Tag>
        </div>
        <div className="flex items-center gap-1 text-xs text-fg-muted">
          <span>样本编号:</span>
          <span className="font-mono">{sample.id.substring(0, 8)}...</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-fg-muted">
          <span>样本类型:</span>
          <span>{sample.sampleType}</span>
        </div>
        {sample.projectInfo && (
          <>
            {(sample.projectInfo.panel || sample.projectInfo.projectName) && (
            <div className="flex items-center gap-1 text-xs text-fg-muted">
              <span>检测Panel:</span>
              <span>{sample.projectInfo.panel || sample.projectInfo.projectName}</span>
            </div>
            )}
            {(sample.projectInfo.priority === 'normal' || sample.projectInfo.priority === 'urgent') && (
            <Tag
              variant={sample.projectInfo.priority === 'urgent' ? 'danger' : 'neutral'}
            >
              {getSamplePriorityLabel(sample.projectInfo.priority)}
            </Tag>
            )}
          </>
        )}
      </div>

      {/* 第二行：送检信息 */}
      {sample.submissionInfo && (
        <div className="flex items-center gap-6 mb-3 pb-3 border-b border-border-default text-xs">
          <div className="flex items-center gap-1 text-fg-muted">
            <Calendar className="w-3.5 h-3.5" />
            <span>送检日期:</span>
            <span className="text-fg-default">{sample.submissionInfo.submissionDate || '—'}</span>
          </div>
          <div className="flex items-center gap-1 text-fg-muted">
            <span>采样日期:</span>
            <span className="text-fg-default">{sample.submissionInfo.sampleCollectionDate || '—'}</span>
          </div>
          <div className="flex items-center gap-1 text-fg-muted">
            <span>收样日期:</span>
            <span className="text-fg-default">{sample.submissionInfo.sampleReceiveDate || '—'}</span>
          </div>
          <div className="flex items-center gap-1 text-fg-muted">
            <span>样本质量:</span>
            <Tag
              variant={getSampleQualityDisplay(sample.submissionInfo.sampleQuality).variant}
            >
              {getSampleQualityDisplay(sample.submissionInfo.sampleQuality).label}
            </Tag>
          </div>
          {sample.projectInfo && (
            <div className="flex items-center gap-1 text-fg-muted">
              <span>承诺周期:</span>
              <span className="text-fg-default">{formatTurnaroundDays(sample.projectInfo.turnaroundDays)}</span>
            </div>
          )}
        </div>
      )}

      {/* 第三行：临床诊断 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InfoSection icon={<HeartPulse className="w-3.5 h-3.5" />} title="临床诊断">
          <div className="space-y-1">
            <InfoItem label="主要诊断" value={sample.clinicalDiagnosis?.mainDiagnosis} />
            {sample.clinicalDiagnosis?.symptoms && sample.clinicalDiagnosis.symptoms.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-fg-muted min-w-[60px]">症状</span>
                <div className="flex flex-wrap gap-1">
                  {sample.clinicalDiagnosis.symptoms.map((s, i) => (
                    <Tag key={i} variant="neutral">{s}</Tag>
                  ))}
                </div>
              </div>
            )}
            {sample.clinicalDiagnosis?.hpoTerms && sample.clinicalDiagnosis.hpoTerms.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-xs text-fg-muted min-w-[60px] pt-0.5">HPO</span>
                <div className="flex flex-wrap gap-1">
                  {sample.clinicalDiagnosis.hpoTerms.map((hpo, i) => (
                    <HoverHint content={hpo.name} key={i}><Tag
                      key={i}
                      variant="info"
                      className="font-mono"

                    >
                      {hpo.id}
                    </Tag></HoverHint>
                  ))}
                </div>
              </div>
            )}
          </div>
        </InfoSection>

        <InfoSection icon={<Users className="w-3.5 h-3.5" />} title="家族史">
          <div className="space-y-1">
            <span>{getFamilyHistoryLabel(sample.familyHistory?.hasHistory)}</span>
            {sample.familyHistory?.hasHistory && sample.familyHistory.affectedMembers && (
              <div className="flex flex-wrap gap-1">
                {sample.familyHistory.affectedMembers.map((member, i) => (
                  <Tag key={i} variant="warning">
                    {member.relation}: {member.condition}
                  </Tag>
                ))}
              </div>
            )}
          </div>
        </InfoSection>
      </div>
    </div>
  );
}
export function SampleSummaryCard({sample}: SampleSummaryCardProps) {
 const gender = GENDER_CONFIG[sample.gender];
 return <div className="mb-2 flex min-w-0 items-center gap-3 rounded-md bg-canvas-subtle px-3 py-2 text-xs">
  <User className="h-3.5 w-3.5 shrink-0 text-fg-muted"/>
  <span className="shrink-0 font-semibold text-fg-default">{sample.internalId}</span>
  <span className={`shrink-0 ${gender.color}`}>{gender.label}{sample.age !== undefined ? ` · ${sample.age}岁` : ''}</span>
  <span className="hidden shrink-0 text-fg-muted sm:inline">{sample.sampleType}</span>
  <HoverHint content={sample.clinicalDiagnosis?.mainDiagnosis}><span className="min-w-0 flex-1 truncate text-fg-muted" >诊断：{sample.clinicalDiagnosis?.mainDiagnosis || '未提供'}</span></HoverHint>
  <ToolbarPopover label="样本详情" wide><SampleDetails sample={sample}/></ToolbarPopover>
 </div>;
}
