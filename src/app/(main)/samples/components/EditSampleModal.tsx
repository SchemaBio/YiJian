'use client';
import {SampleParentFields} from '@/components/shared/SampleParentFields';
import type {SampleParentValues} from '@/lib/sample-parents';
import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';
import { localizeDisplay } from '@/i18n/text';

import { ActionButton as Button, ActionButton } from '@/components/shared/ActionButton';


import * as React from 'react';
import { Input, Select, TextArea } from '@schema/ui-kit';
import { FileText, Search, Stethoscope, UserRound } from 'lucide-react';
import { AIDiagnosisField } from '@/components/shared/AIDiagnosisField';
import { AppModal, ModalSectionHeading } from '@/components/shared';
import { getHpoTermName, searchHpoTerms, useHpoTerms, type HpoTerm } from '@/lib/hpo-terms';
import type { Gender, SampleType, Sample } from '../types';

interface EditSampleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (id: string, data: EditSampleFormData) => void | Promise<void>;
  sample: Sample | null;
}

export interface EditSampleFormData extends SampleParentValues {
  internalId: string;
  gender: Gender;
  age?: number;
  sampleType: SampleType;
  batch: string;
  clinicalDiagnosis: string;
  hpoTerms: { id: string; name: string }[];
  remark: string;
}

const genderOptions = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
  { value: 'unknown', label: '未知' },
];

const sampleTypeOptions = [
  { value: '全血', label: '全血' },
  { value: '唾液', label: '唾液' },
  { value: 'DNA', label: 'DNA' },
  { value: '组织', label: '组织' },
  { value: '其他', label: '其他' },
];

export function EditSampleModal({ isOpen, onClose, onSubmit, sample }: EditSampleModalProps) {
  const t = useText();
  const hpoTerms = useHpoTerms(isOpen);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState('');
  const [formData, setFormData] = React.useState<EditSampleFormData>({
    fatherSampleInternalId:'',motherSampleInternalId:'',fatherAffectedStatus:'',motherAffectedStatus:'',
    internalId: '',
    gender: 'unknown',
    age: undefined,
    sampleType: '全血',
    batch: '',
    clinicalDiagnosis: '',
    hpoTerms: [],
    remark: '',
  });

  const [hpoSearchQuery, setHpoSearchQuery] = React.useState('');
  const [showHpoDropdown, setShowHpoDropdown] = React.useState(false);

  // 当 sample 变化时更新表单数据
  React.useEffect(() => {
    if (sample) {
      setSubmitError('');
      setHpoSearchQuery('');
      setShowHpoDropdown(false);
      setFormData({
        fatherSampleInternalId:sample.fatherSampleInternalId||'',motherSampleInternalId:sample.motherSampleInternalId||'',fatherAffectedStatus:sample.fatherAffectedStatus||'',motherAffectedStatus:sample.motherAffectedStatus||'',
        internalId: sample.internalId,
        gender: sample.gender,
        age: sample.age,
        sampleType: sample.sampleType,
        batch: sample.batch,
        clinicalDiagnosis: sample.clinicalDiagnosis,
        hpoTerms: sample.hpoTerms || [],
        remark: sample.remark,
      });
    }
  }, [sample]);

  const filteredHpoTerms = React.useMemo(() => {
    return searchHpoTerms(hpoTerms, hpoSearchQuery);
  }, [hpoSearchQuery, hpoTerms]);

  const handleChange = (field: keyof EditSampleFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addHpoTerm = (term: HpoTerm) => {
    if (!formData.hpoTerms.find(t => t.id === term.id)) {
      setFormData(prev => ({
        ...prev,
        hpoTerms: [...prev.hpoTerms, { id: term.id, name: getHpoTermName(term, t.locale, hpoTerms) }],
      }));
    }
    setHpoSearchQuery('');
    setShowHpoDropdown(false);
  };

  const removeHpoTerm = (termId: string) => {
    setFormData(prev => ({
      ...prev,
      hpoTerms: prev.hpoTerms.filter(t => t.id !== termId)
    }));
  };

  const handleSubmit = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!sample || submitting) return;
    setSubmitError('');
    if (!formData.internalId.trim()) {
      setSubmitError(t("samples.enterInternalIdbb323e"));
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(sample.id, { ...formData, internalId: formData.internalId.trim() });
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? errorText(err, t) : t("samples.unableToUpdateSampleRetryLater9e31e0"));
    } finally {
      setSubmitting(false);
    }
  };

  if (!sample) return null;

  return (
    <AppModal
      open={isOpen}
      onOpenChange={(open) => !open && !submitting && onClose()}
      title={t("samples.editSample15f424")}
      size="large"
      className="!fixed !left-1/2 !right-auto !top-1/2 !bottom-auto !m-0 !max-h-[calc(100vh-2rem)] !w-[min(920px,calc(100vw-2rem))] !max-w-[920px] !-translate-x-1/2 !-translate-y-1/2"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {t("admin.cancel4d0b46")}</Button>
          <Button loading={submitting} loadingLabel={t("admin.savingd70d42")} action="save"
            variant="primary"
            onClick={(e: React.MouseEvent) => handleSubmit(e)}
            disabled={submitting}

          >
            {t("samples.saveChanges60b4ae")}</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {submitError && (
          <div className="rounded-md border border-danger-muted bg-danger-subtle px-3 py-2 text-sm text-danger-fg">
            {submitError}
          </div>
        )}
        <section>
          <ModalSectionHeading
            icon={<UserRound className="h-4 w-4" />}
            title={t("samples.basicInformationb122f8")}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-fg-muted">{t("samples.sampleUuid6e9e1c")}</label>
              <Input value={sample.id} disabled className="bg-canvas-subtle font-mono text-fg-muted" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-fg-muted">{t("samples.internalIdadcd0f")}</label>
              <Input value={formData.internalId} onChange={(e) => handleChange('internalId', e.target.value)} placeholder={t("samples.forExampleInt00b6e2")} required />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-fg-muted">{t("samples.batch6b2cf2")}</label>
              <Input value={formData.batch} onChange={(e) => handleChange('batch', e.target.value)} placeholder={t("samples.forExampleBatch5e3179")} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-fg-muted">{t("samples.sampleType74e156")}</label>
              <Select value={formData.sampleType} onChange={(value) => handleChange('sampleType', Array.isArray(value) ? value[0] : value)} options={localizeDisplay(sampleTypeOptions, t)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-fg-muted">{t("samples.sexfe8aa4")}</label>
              <Select value={formData.gender} onChange={(value) => handleChange('gender', Array.isArray(value) ? value[0] : value)} options={localizeDisplay(genderOptions, t)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-fg-muted">{t("samples.age28c02e")}</label>
              <Input
                type="number"
                min="0"
                max="150"
                value={formData.age ?? ''}
                onChange={(e) => setFormData(prev => ({ ...prev, age: e.target.value ? parseInt(e.target.value, 10) : undefined }))}
                placeholder={t("samples.forExamplec25a84")}
              />
            </div>
          </div>
        </section>

        <section className="border-t border-[var(--yj-border-subtle)] pt-5">
          <ModalSectionHeading
            icon={<Stethoscope className="h-4 w-4" />}
            title={t("samples.clinicalInformation88e3af")}
          />
          <div className="space-y-4">
            <AIDiagnosisField key={`${sample?.id}-${isOpen}`} value={formData.clinicalDiagnosis}
              disabled={submitting} onChange={value => handleChange('clinicalDiagnosis', value)}
              onTerms={terms => setFormData(previous => ({ ...previous, hpoTerms: [...previous.hpoTerms, ...terms.filter(term => !previous.hpoTerms.some(old => old.id === term.id))] }))} />
            <div>
              <label className="mb-1.5 block text-xs font-medium text-fg-muted">{t("samples.hpoPhenotypeTermsc1115e")}</label>
              {formData.hpoTerms.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {formData.hpoTerms.map((term) => (
                    <div key={term.id} className="inline-flex items-center gap-1.5 rounded-md border border-accent-muted bg-accent-subtle px-2.5 py-1.5 text-sm text-accent-fg">
                      <span className="font-mono text-xs text-accent-fg">{term.id}</span>
                      <span>{getHpoTermName(term, t.locale, hpoTerms)}</span>
                      <ActionButton size="small" iconOnly action="close" variant="ghost" type="button" onClick={() => removeHpoTerm(term.id)} className="ml-1 text-accent-fg hover:text-danger-fg" aria-label={t("samples.remove40a0d2", {p0: String(getHpoTermName(term, t.locale, hpoTerms))})} />
                    </div>
                  ))}
                </div>
              )}
              <div className="relative">
                <Input
                  placeholder={t("samples.searchHpoTermsEGHpOr746be4")}
                  value={hpoSearchQuery}
                  onChange={(e) => { setHpoSearchQuery(e.target.value); setShowHpoDropdown(true); }}
                  onFocus={() => setShowHpoDropdown(true)}
                  leftElement={<Search className="h-4 w-4" />}
                />
                {showHpoDropdown && filteredHpoTerms.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-40 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
                    {filteredHpoTerms.map((term) => (
                      <button key={term.id} type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-canvas-subtle" onClick={() => addHpoTerm(term)}>
                        <span className="font-mono text-xs text-accent-fg">{term.id}</span>
                        <span className="text-sm">{getHpoTermName(term, t.locale, hpoTerms)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-[var(--yj-border-subtle)] pt-5">
          <ModalSectionHeading
            icon={<FileText className="h-4 w-4" />}
            title={t("admin.notese03614")}
          />
          <TextArea value={formData.remark} onChange={(e) => handleChange('remark', e.target.value)} placeholder={t("samples.enterNotesacc063")} rows={2} />
        </section>
      <SampleParentFields value={formData} onChange={parents=>setFormData(previous=>({...previous,...parents}))} internalId={formData.internalId} sampleId={sample?.id} disabled={submitting}/>
      </form>
    </AppModal>
  );
}
