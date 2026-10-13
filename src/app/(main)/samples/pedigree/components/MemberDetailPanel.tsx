'use client';
import { useText } from '@/i18n/useText';
import { translateUI } from '@/i18n/text';

import { ActionButton as Button, IconActionButton } from '@/components/shared/ActionButton';


import * as React from 'react';
import { Tag } from '@schema/ui-kit';
import { User, Link2 } from 'lucide-react';
import type { PedigreeMember } from '../types';
import { RELATION_CONFIG, AFFECTED_STATUS_CONFIG } from '../types';
import { GENDER_CONFIG } from '../../types';

interface MemberDetailPanelProps {
  member: PedigreeMember;
  isEditMode?: boolean;
  onClose: () => void;
  onEditMember?: (member: PedigreeMember) => void;
  onLinkSample?: (memberId: string) => void;
  onRemoveMember?: (memberId: string) => void;
}

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-fg-muted">{label}</span>
      <span className="text-sm text-fg-default">{value || '-'}</span>
    </div>
  );
}

export function MemberDetailPanel({ member, isEditMode, onClose, onEditMember, onLinkSample, onRemoveMember }: MemberDetailPanelProps) {
  const t = useText();
  const genderInfo = GENDER_CONFIG[member.gender];
  const relationInfo = RELATION_CONFIG[member.relation];
  const statusInfo = AFFECTED_STATUS_CONFIG[member.affectedStatus];

  return (
    <div role="region" aria-label={t("samples.memberDetailse20da4")} className="absolute inset-y-3 right-3 z-20 w-[calc(100%-1.5rem)] max-w-80 rounded-lg border border-border-default bg-canvas-default shadow-lg flex flex-col md:static md:inset-auto md:z-auto md:w-80 md:max-w-none md:shrink-0 md:rounded-none md:border-0 md:border-l md:shadow-none md:h-full">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-fg-muted" />
          <span className="font-medium text-fg-default">{member.name}</span>
        </div>
        <IconActionButton label={t("samples.closeMemberDetailsc2ad9e")} action="close" variant="ghost"
          onClick={onClose}

          className="p-1 rounded hover:bg-canvas-inset text-fg-muted hover:text-fg-default transition-colors"
         />
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* 基本信息 */}
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-fg-muted">{t("samples.basicInformationb122f8")}</h4>
          <div className="grid grid-cols-2 gap-3">
            <InfoItem label={t("samples.namebe4c26")} value={member.name} />
            <InfoItem
              label={t("samples.sexfe8aa4")}
              value={<span className={genderInfo.color}>{translateUI(genderInfo.label, t)}</span>}
            />
            <InfoItem label={t("samples.relationshipdaf4f2")} value={relationInfo.label} />
            <InfoItem
              label={t("samples.birthYear72da00")}
              value={member.birthYear ? t("samples.label61a75e", {p0: String(member.birthYear)}) : '-'}
            />
            <InfoItem
              label={t("admin.status62e951")}
              value={
                member.isDeceased
                  ? <span className="text-fg-muted">{t("samples.deceased2c5e3f")}{member.deceasedYear ? `(${member.deceasedYear})` : ''}</span>
                  : <span className="text-success-fg">{t("samples.living89b43b")}</span>
              }
            />
          </div>
        </div>

        {/* 患病状态 */}
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-fg-muted">{t("samples.affectedStatus1c27dd")}</h4>
          <div className="space-y-2">
            <Tag
              variant={
                member.affectedStatus === 'affected' ? 'danger' :
                member.affectedStatus === 'carrier' ? 'warning' :
                member.affectedStatus === 'unaffected' ? 'success' : 'neutral'
              }
            >
              {translateUI(statusInfo.label, t)}
            </Tag>
            {member.phenotypes && member.phenotypes.length > 0 && (
              <div className="mt-2">
                <span className="text-xs text-fg-muted block mb-1">{t("samples.phenotypeDescriptionfa80fb")}</span>
                <div className="flex flex-wrap gap-1">
                  {member.phenotypes.map((p, i) => (
                    <Tag key={i} variant="neutral">{p}</Tag>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 样本关联 */}
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-fg-muted">{t("samples.sampleAssociation0d1715")}</h4>
          {member.sampleId ? (
            <div className="flex items-center gap-2 p-2 bg-success-subtle rounded">
              <div className="w-2 h-2 rounded-full bg-success-emphasis" />
              <span className="text-sm break-all text-success-fg">{t("samples.linkedSampled0fe3a")}{member.sampleId}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-2 bg-canvas-inset rounded">
              <div className="w-2 h-2 rounded-full bg-neutral-emphasis" />
              <span className="text-sm text-fg-muted">{t("samples.noLinkedSample820c47")}</span>
            </div>
          )}
        </div>
      </div>

      {/* 底部操作 */}
      <div className="p-4 border-t border-border-default space-y-2">
        {isEditMode && (
          <Button action="edit"
            variant="secondary"
            className="w-full"

            onClick={() => onEditMember?.(member)}
          >
            {t("samples.editMemberInformation399978")}</Button>
        )}
        {!member.sampleId && (
          <Button
            variant="secondary"
            className="w-full"
            leftIcon={<Link2 className="w-4 h-4" />}
            onClick={() => onLinkSample?.(member.id)}
          >
            {t("samples.linkSampled65534")}</Button>
        )}
        {member.relation !== 'proband' && (
          <Button action="delete"
            variant="ghost"
            className="w-full text-danger-fg hover:bg-danger-subtle"

            onClick={() => onRemoveMember?.(member.id)}
          >
            {t("samples.removeMember1025d8")}</Button>
        )}
      </div>
    </div>
  );
}
