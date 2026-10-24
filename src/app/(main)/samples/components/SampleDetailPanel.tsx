'use client';
import {SampleParentFields,ParentSampleStatus} from '@/components/shared/SampleParentFields';
import { useResearchExpiry } from '@/lib/research-retention';
import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';
import { translateUI } from '@/i18n/text';

import { ActionButton as Button, ActionButton } from '@/components/shared/ActionButton';

import { getSampleQualityDisplay, getSamplePriorityLabel, getFamilyHistoryLabel, formatTurnaroundDays } from '@/lib/sample-display';

import * as React from 'react';
import { Input } from '@schema/ui-kit';
import { Tag } from '@/components/shared/Tag';
import { User, Stethoscope, FileText, FolderKanban, Users, Activity, Search } from 'lucide-react';
import { AIDiagnosisField } from '@/components/shared/AIDiagnosisField';
import { api } from '@/lib/api';
import { searchHpoTerms, useHpoTerms } from '@/lib/hpo-terms';
import { getSampleDetail, normalizeSampleDetail, sampleDetailPayload } from '@/lib/samples';
import type { SampleDetail } from '../types';
import { GENDER_CONFIG } from '../types';

interface SampleDetailPanelProps {
  sampleId: string;
  onClose?: () => void;
}

type TabType = 'basic' | 'clinical' | 'submission' | 'project' | 'family' | 'analysis';

const TAB_CONFIGS: { id: TabType; label: string; icon: React.ReactNode }[] = [
  { id: 'basic', label: '基本信息', icon: <User className="w-4 h-4" /> },
  { id: 'clinical', label: '临床诊断', icon: <Stethoscope className="w-4 h-4" /> },
  { id: 'submission', label: '送检信息', icon: <FileText className="w-4 h-4" /> },
  { id: 'project', label: '项目信息', icon: <FolderKanban className="w-4 h-4" /> },
  { id: 'family', label: '家族史', icon: <Users className="w-4 h-4" /> },
  { id: 'analysis', label: '分析任务', icon: <Activity className="w-4 h-4" /> },
];

// 信息项组件（支持编辑模式）
function InfoItem({
  label,
  value,
  className,
  isEditing,
  editValue,
  onEditChange,
  type = 'text'
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
  isEditing?: boolean;
  editValue?: string;
  onEditChange?: (value: string) => void;
  type?: 'text' | 'date' | 'select';
}) {
  if (isEditing && onEditChange) {
    return (
      <div className={`flex flex-col gap-1 ${className || ''}`}>
        <span className="text-xs text-fg-muted">{label}</span>
        <Input
          value={editValue || ''}
          onChange={(e) => onEditChange(e.target.value)}
          type={type === 'date' ? 'date' : 'text'}
          className="text-sm"
        />
      </div>
    );
  }
  return (
    <div className={`flex flex-col gap-1 ${className || ''}`}>
      <span className="text-xs text-fg-muted">{label}</span>
      <span className="text-sm text-fg-default">{value || '-'}</span>
    </div>
  );
}

// 信息卡片组件
function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-canvas-subtle rounded-lg p-4">
      <h4 className="text-sm font-medium text-fg-default mb-3">{title}</h4>
      {children}
    </div>
  );
}

// HPO术语输入组件
function HpoTermInput({ onAdd }: { onAdd: (term: { id: string; name: string }) => void }) {
  const t = useText();
  const hpoTerms = useHpoTerms();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showDropdown, setShowDropdown] = React.useState(false);

  const filteredTerms = React.useMemo(() => {
    return searchHpoTerms(hpoTerms, searchQuery);
  }, [hpoTerms, searchQuery]);

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            placeholder={t("samples.searchHpoTermsEGHpOr746be4")}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            leftElement={<Search className="w-4 h-4" />}
          />
          {showDropdown && filteredTerms.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-48 overflow-auto">
              {filteredTerms.map((term) => (
                <button
                  key={term.id}
                  className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                  onClick={() => {
                    onAdd({ id: term.id, name: term.name });
                    setSearchQuery('');
                    setShowDropdown(false);
                  }}
                >
                  <span className="font-mono text-xs text-blue-500">{term.id}</span>
                  <span className="text-sm">{term.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {showDropdown && (
        <div className="fixed inset-0 z-0" onClick={() => setShowDropdown(false)} />
      )}
    </div>
  );
}

export function SampleDetailPanel({ sampleId, onClose }: SampleDetailPanelProps) {
  const t = useText();
  const [sample, setSample] = React.useState<SampleDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<TabType>('basic');
  const [isEditing, setIsEditing] = React.useState(false);
  const [editData, setEditData] = React.useState<Partial<SampleDetail>>({});
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    async function loadSample() {
      setLoading(true);
      try {
        const data = await getSampleDetail(sampleId);
        setSample(data);
        if (data) {
          setEditData(data);
        }
        setError('');
      } catch (err) {
        setSample(null);
        setError(err instanceof Error ? errorText(err, t) : t("interface.failedToLoadSample0c1b77"));
      } finally {
        setLoading(false);
      }
    }
    loadSample();
  }, [sampleId]);

  useResearchExpiry(sample?.expiresAt,()=>{setSample(null);setEditData({});setIsEditing(false);onClose?.();});
  const handleSave = async () => {
    if (editData) {
      try {
        const updated = await api.put<unknown>(`/v1/samples/${encodeURIComponent(sampleId)}`, sampleDetailPayload(editData));
        const updatedFields = updated && typeof updated === 'object' && !Array.isArray(updated)
          ? updated as Record<string, unknown>
          : {};
        const next = normalizeSampleDetail({ ...editData, ...updatedFields });
        setSample(next);
        setEditData(next);
        setIsEditing(false);
        setError('');
      } catch (err) {
        setError(err instanceof Error ? errorText(err, t) : t("interface.failedToSaveSample5561da"));
      }
    }
  };

  const handleCancelEdit = () => {
    if (sample) {
      setEditData(sample);
    }
    setIsEditing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent-emphasis" />
      </div>
    );
  }

  if (!sample) {
    return (
      <div className="flex items-center justify-center py-16 text-fg-muted">
        {error || t("samples.sampleNotFound73e415")}
      </div>
    );
  }

  const isMatched = sample.matchedPair !== null;
  const genderInfo = GENDER_CONFIG[sample.gender];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'basic':
        return (
          <div className="space-y-4">
            <InfoCard title={t("samples.basicInformationb122f8")}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InfoItem label={t("history.sampleId6d686e")} value={<span className="font-mono text-xs">{sample.id}</span>} />
                <InfoItem label={t("data.internalIdabcc9d")} value={sample.internalId} />
                <InfoItem label={t("samples.sexfe8aa4")} value={<span className={genderInfo.color}>{translateUI(genderInfo.label, t)}</span>} />
                <InfoItem label={t("samples.sampleType686c81")} value={t(sample.sampleType)} />
                <InfoItem label={t("admin.createdAt84e380")} value={sample.createdAt} />
                <InfoItem label={t("pipeline.updatedAt093dea")} value={sample.updatedAt} />
              </div>
            </InfoCard>
            <InfoCard title={t("common.matchDatab50c4f")}>
              <div className="grid grid-cols-2 gap-4">
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
          </div>
        );

      case 'clinical':
        return (
          <div className="space-y-4">
            <InfoCard title={t("samples.diagnosticInformation0b673e")}>
              <div className="space-y-4">
                {isEditing ? <AIDiagnosisField key={sampleId} value={editData.clinicalDiagnosis?.mainDiagnosis ?? sample.clinicalDiagnosis.mainDiagnosis}
                  onChange={value => setEditData(previous => ({ ...previous, clinicalDiagnosis: { ...previous.clinicalDiagnosis, mainDiagnosis: value } } as any))}
                  onTerms={terms => { const merged = [...(sample.clinicalDiagnosis.hpoTerms ?? []), ...terms.filter(term => !sample.clinicalDiagnosis.hpoTerms?.some(old => old.id === term.id))];
                    setEditData(previous => ({ ...previous, clinicalDiagnosis: { ...previous.clinicalDiagnosis, hpoTerms: merged } } as any));
                    setSample(previous => previous ? { ...previous, clinicalDiagnosis: { ...previous.clinicalDiagnosis, hpoTerms: merged } } : null);
                  }} /> : <InfoItem
                  label={t("samples.primaryDiagnosisc93efa")}
                  value={sample.clinicalDiagnosis.mainDiagnosis}
                  isEditing={isEditing}
                  editValue={(editData.clinicalDiagnosis as any)?.mainDiagnosis}
                  onEditChange={(v) => setEditData(prev => ({
                    ...prev,
                    clinicalDiagnosis: { ...prev.clinicalDiagnosis, mainDiagnosis: v }
                  } as any))}
                />}
                <InfoItem
                  label={t("samples.clinicalSymptoms326950")}
                  value={
                    sample.clinicalDiagnosis.symptoms.length > 0
                      ? sample.clinicalDiagnosis.symptoms.map((s, i) => (
                          <Tag key={i} variant="neutral" className="mr-1 mb-1">{s}</Tag>
                        ))
                      : '-'
                  }
                />
                <InfoItem
                  label={t("samples.ageAtOnset4cce4a")}
                  value={sample.clinicalDiagnosis.onsetAge}
                  isEditing={isEditing}
                  editValue={(editData.clinicalDiagnosis as any)?.onsetAge}
                  onEditChange={(v) => setEditData(prev => ({
                    ...prev,
                    clinicalDiagnosis: { ...prev.clinicalDiagnosis, onsetAge: v }
                  } as any))}
                />
              </div>
            </InfoCard>

            <InfoCard title={t("samples.medicalHistoryff3bb9")}>
              <p className="text-sm text-fg-default whitespace-pre-wrap">
                {sample.clinicalDiagnosis.diseaseHistory || t("samples.noMedicalHistoryDescription739ef8")}
              </p>
            </InfoCard>

            {/* HPO术语 */}
            <InfoCard title={t("samples.hpoPhenotypeTermsc62e48")}>
              <div className="space-y-3">
                {sample.clinicalDiagnosis.hpoTerms && sample.clinicalDiagnosis.hpoTerms.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {sample.clinicalDiagnosis.hpoTerms.map((term) => (
                      <div
                        key={term.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-md text-sm border border-blue-200"
                      >
                        <span className="font-mono text-xs text-blue-500">{term.id}</span>
                        <span>{term.name}</span>
                        {isEditing && (
                          <ActionButton size="small" iconOnly action="close" variant="ghost"
                            onClick={() => {
                              const newTerms = sample.clinicalDiagnosis.hpoTerms?.filter(t => t.id !== term.id) || [];
                              setEditData(prev => ({
                                ...prev,
                                clinicalDiagnosis: { ...prev.clinicalDiagnosis, hpoTerms: newTerms }
                              } as any));
                              setSample(prev => prev ? {
                                ...prev,
                                clinicalDiagnosis: { ...prev.clinicalDiagnosis, hpoTerms: newTerms }
                              } : null);
                            }}
                            className="ml-1 text-blue-400 hover:text-red-500"
                           />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-fg-muted">{t("samples.noHpoTerms0cc1c0")}</p>
                )}
                {isEditing && (
                  <HpoTermInput
                    onAdd={(term) => {
                      const currentTerms = sample.clinicalDiagnosis.hpoTerms || [];
                      if (!currentTerms.find(t => t.id === term.id)) {
                        const newTerms = [...currentTerms, term];
                        setEditData(prev => ({
                          ...prev,
                          clinicalDiagnosis: { ...prev.clinicalDiagnosis, hpoTerms: newTerms }
                        } as any));
                        setSample(prev => prev ? {
                          ...prev,
                          clinicalDiagnosis: { ...prev.clinicalDiagnosis, hpoTerms: newTerms }
                        } : null);
                      }
                    }}
                  />
                )}
              </div>
            </InfoCard>
          </div>
        );

      case 'submission':
        return (
          <InfoCard title={t("samples.submissionInformation414387")}>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
            </div>
          </InfoCard>
        );

      case 'project':
        return (
          <InfoCard title={t("samples.projectInformation4166d1")}>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <InfoItem label={t("samples.projectId1bb19c")} value={sample.projectInfo.projectId} />
              <InfoItem label={t("samples.projectName3e7255")} value={sample.projectInfo.projectName} />
              <InfoItem label={t("samples.testingPanelc30b77")} value={sample.projectInfo.panel} />
              <InfoItem
                label={t("samples.test97879b")}
                value={
                  sample.projectInfo.testItems.length > 0
                    ? sample.projectInfo.testItems.map((item, i) => (
                        <Tag key={i} variant="info" className="mr-1 mb-1">{item}</Tag>
                      ))
                    : '-'
                }
              />
              <InfoItem label={t("samples.expectedTurnarounddb3366")} value={formatTurnaroundDays(sample.projectInfo.turnaroundDays, t)} />
              <InfoItem
                label={t("samples.priority7cabe7")}
                value={
                  <Tag variant={sample.projectInfo.priority === 'urgent' ? 'danger' : 'neutral'}>
                    {getSamplePriorityLabel(sample.projectInfo.priority, t)}
                  </Tag>
                }
              />
            </div>
          </InfoCard>
        );

      case 'family':
        return (
          <div className="space-y-4">
            {isEditing ? <SampleParentFields value={{...sample,...editData}} sampleId={sample.id} internalId={editData.internalId??sample.internalId} onChange={parents=>setEditData(previous=>({...previous,...parents}))}/> : <InfoCard title={t('sampleParents.title')}>
              {(['father','mother'] as const).map(role=><div key={role} className="mb-3 text-sm"><p>{t(`sampleParents.${role}Sample`)}: {(role==='father'?sample.fatherSampleInternalId:sample.motherSampleInternalId)||'—'}</p><ParentSampleStatus info={sample[role]}/><p>{t(`sampleParents.${role}Status`)}: {t(`sampleParents.${(role==='father'?sample.fatherAffectedStatus:sample.motherAffectedStatus)||'unknown'}`)}</p></div>)}
            </InfoCard>}
            <InfoCard title={t("samples.familyHistoryOverview911c3c")}>
              <InfoItem
                label={t("samples.familyHistoryPresentdd7a14")}
                value={
                  <Tag variant={sample.familyHistory.hasHistory ? 'warning' : 'neutral'}>
                    {getFamilyHistoryLabel(sample.familyHistory.hasHistory, t)}
                  </Tag>
                }
              />
            </InfoCard>
            {sample.familyHistory.hasHistory && sample.familyHistory.affectedMembers && (
              <InfoCard title={t("samples.affectedRelativesc83a79")}>
                <div className="space-y-3">
                  {sample.familyHistory.affectedMembers.map((member, index) => (
                    <div key={index} className="flex items-center gap-4 p-2 bg-canvas-default rounded">
                      <span className="text-sm font-medium text-fg-default w-16">{member.relation}</span>
                      <span className="text-sm text-fg-default flex-1">{member.condition}</span>
                      {member.onsetAge && (
                        <span className="text-xs text-fg-muted">{t("samples.ageAtOnset6e115d")}{member.onsetAge}</span>
                      )}
                    </div>
                  ))}
                </div>
              </InfoCard>
            )}
            {sample.familyHistory.pedigreeNote && (
              <InfoCard title={t("samples.pedigreeNotes9c04e4")}>
                <p className="text-sm text-fg-default">{sample.familyHistory.pedigreeNote}</p>
              </InfoCard>
            )}
          </div>
        );

      case 'analysis':
        return (
          <InfoCard title={t("samples.associatedAnalysisTasks91cb8e")}>
            {sample.analysisTasks.length > 0 ? (
              <div className="space-y-2">
                {sample.analysisTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-3 bg-canvas-default rounded hover:bg-canvas-inset transition-colors cursor-pointer">
                    <div>
                      <span className="text-sm font-medium text-fg-default">{task.name}</span>
                      <span className="text-xs text-fg-muted ml-2">{task.createdAt}</span>
                    </div>
                    <Tag variant={
                      task.status === 'completed' ? 'success' :
                      task.status === 'running' ? 'info' : 'neutral'
                    }>
                      {task.status === 'completed' ? t("admin.completede99b48") :
                       task.status === 'running' ? t("admin.running594249") : task.status}
                    </Tag>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-fg-muted">{t("samples.noAssociatedAnalysisTasks5fe531")}</p>
            )}
          </InfoCard>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-4">
      {/* 样本信息头部 */}
      <div className="mb-4 pb-3 border-b border-border-default">
        {error && (
          <div className="mb-3 rounded-md border border-danger-emphasis bg-danger-subtle px-3 py-2 text-sm text-danger-fg">
            {error}
          </div>
        )}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-medium text-fg-default">{sample.internalId}</h3>
            <span className={`text-sm ${genderInfo.color}`}>{translateUI(genderInfo.label, t)}</span>
            <Tag variant={isMatched ? 'success' : 'warning'}>{isMatched ? t("samples.matched113028") : t("samples.unmatched434b19")}</Tag>
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button variant="secondary" size="small" onClick={handleCancelEdit}>
                  {t("admin.cancel4d0b46")}</Button>
                <Button action="save" variant="primary" size="small"  onClick={handleSave}>
                  {t("data.savefadf24")}</Button>
              </>
            ) : (
              <Button action="edit" variant="secondary" size="small"  onClick={() => setIsEditing(true)}>
                {t("admin.edita7f814")}</Button>
            )}
            {onClose && (
              <ActionButton size="small" iconOnly action="close" variant="ghost"
                onClick={onClose}
                className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
               />
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-fg-muted">
          <span>{t("samples.sampleId22c40c")}<span className="font-mono">{sample.id.substring(0, 8)}...</span></span>
          <span>{t("samples.sampleTypedf9c6f")}{t(sample.sampleType)}</span>
          <span>{t("samples.matchedData79747f")}{sample.matchedPair ? t("samples.matched113028") : t("samples.none720777")}</span>
        </div>
      </div>

      {/* 标签页导航 */}
      <div className="border-b border-border-default mb-4">
        <nav className="flex gap-1" role="tablist">
          {TAB_CONFIGS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors
                  ${isActive
                    ? 'border-accent-emphasis text-accent-fg'
                    : 'border-transparent text-fg-muted hover:text-fg-default'
                  }
                `}
              >
                {tab.icon}
                {translateUI(tab.label, t)}
              </button>
            );
          })}
        </nav>
      </div>

      {/* 标签页内容 */}
      <div>{renderTabContent()}</div>
    </div>
  );
}
