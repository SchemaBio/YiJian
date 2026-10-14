'use client';
import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';
import { translateUI } from '@/i18n/text';

import { ActionButton as Button, ActionButton } from '@/components/shared/ActionButton';


import * as React from 'react';
import { Input, TextArea } from '@schema/ui-kit';
import { Tag } from '@/components/shared/Tag';
import { Search, Check } from 'lucide-react';
import { AppModal } from '@/components/shared';
import { listSamples } from '@/lib/samples';
import type { PedigreeListItem } from '../types';

interface Sample {
  id: string;
  internalId: string;
  gender: 'male' | 'female' | 'unknown';
}

interface EditPedigreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (id: string, data: EditPedigreeFormData) => void | Promise<void>;
  pedigree: PedigreeListItem | null;
}

export interface EditPedigreeFormData {
  internalId: string;
  clinicalDiagnosis: string;
  batch: string;
  sampleIds: string[];
  probandSampleId: string;
  remark: string;
}

export function EditPedigreeModal({ isOpen, onClose, onSubmit, pedigree }: EditPedigreeModalProps) {
  const t = useText();
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState('');
  const [formData, setFormData] = React.useState<EditPedigreeFormData>({
    internalId: '',
    clinicalDiagnosis: '',
    batch: '',
    sampleIds: [],
    probandSampleId: '',
    remark: '',
  });

  const [samples, setSamples] = React.useState<Sample[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  // 当 pedigree 变化时更新表单数据
  React.useEffect(() => {
    if (pedigree) {
      setSubmitError('');
      setFormData({
        internalId: pedigree.internalId,
        clinicalDiagnosis: pedigree.clinicalDiagnosis || '',
        batch: pedigree.batch || '',
        sampleIds: [...pedigree.sampleIds],
        probandSampleId: pedigree.probandSampleId || '',
        remark: pedigree.remark || '',
      });
    }
  }, [pedigree]);

  // 加载可用样本
  React.useEffect(() => {
    if (isOpen) {
      setLoading(true);
      listSamples()
        .then(data => setSamples(data.map(sample => ({
          id: sample.id,
          internalId: sample.internalId,
          gender: sample.gender,
        }))))
        .catch(() => setSamples([]))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  const filteredSamples = React.useMemo(() => {
    if (!searchQuery) return samples;
    const query = searchQuery.toLowerCase();
    return samples.filter(
      s => s.id.toLowerCase().includes(query) || s.internalId.toLowerCase().includes(query)
    );
  }, [samples, searchQuery]);

  const handleChange = (field: keyof EditPedigreeFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleToggleSample = (sampleId: string) => {
    setFormData(prev => {
      const isSelected = prev.sampleIds.includes(sampleId);
      let newSampleIds: string[];
      let newProbandSampleId = prev.probandSampleId;

      if (isSelected) {
        // 移除样本
        newSampleIds = prev.sampleIds.filter(id => id !== sampleId);
        // 如果移除的是先证者，清空先证者
        if (prev.probandSampleId === sampleId) {
          newProbandSampleId = newSampleIds.length > 0 ? newSampleIds[0] : '';
        }
      } else {
        // 添加样本
        newSampleIds = [...prev.sampleIds, sampleId];
        // 如果是第一个样本，自动设为先证者
        if (prev.sampleIds.length === 0) {
          newProbandSampleId = sampleId;
        }
      }

      return {
        ...prev,
        sampleIds: newSampleIds,
        probandSampleId: newProbandSampleId,
      };
    });
  };

  const handleSetProband = (sampleId: string) => {
    setFormData(prev => ({ ...prev, probandSampleId: sampleId }));
  };

  const handleRemoveSample = (sampleId: string) => {
    setFormData(prev => {
      const newSampleIds = prev.sampleIds.filter(id => id !== sampleId);
      let newProbandSampleId = prev.probandSampleId;
      if (prev.probandSampleId === sampleId) {
        newProbandSampleId = newSampleIds.length > 0 ? newSampleIds[0] : '';
      }
      return {
        ...prev,
        sampleIds: newSampleIds,
        probandSampleId: newProbandSampleId,
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!pedigree || formData.sampleIds.length === 0 || !formData.probandSampleId || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await onSubmit(pedigree.id, formData);
      onClose();
      setSearchQuery('');
    } catch (err) {
      setSubmitError(err instanceof Error ? errorText(err, t) : t("interface.failedToUpdatePedigree805c6a"));
    } finally {
      setSubmitting(false);
    }
  };

  const getSampleInfo = (sampleId: string) => {
    return samples.find(s => s.id === sampleId);
  };

  const genderLabels = {
    male: t("samples.male51625d"),
    female: t("samples.female26bc84"),
    unknown: t("samples.unknownd9c32a"),
  };

  if (!pedigree) return null;

  return (
    <AppModal
      open={isOpen}
      onOpenChange={(open) => !open && !submitting && onClose()}
      title={t("samples.editPedigree58b644")}
      size="medium"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>{t("admin.cancel4d0b46")}</Button>
          <Button action="save"
            variant="primary"
            onClick={(e: React.MouseEvent) => handleSubmit(e)}
            disabled={formData.sampleIds.length === 0 || !formData.probandSampleId || submitting}
          >
            {t("data.savefadf24")}</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {submitError && (
          <div className="rounded-md border border-danger-muted bg-danger-subtle px-3 py-2 text-sm text-danger-fg">
            {submitError}
          </div>
        )}
        <div>
          <h3 className="text-sm font-medium text-fg-default mb-3">{t("samples.pedigreeInformatione42ffe")}</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-fg-muted mb-1">{t("samples.internalIdadcd0f")}</label>
              <Input value={formData.internalId} onChange={(e) => handleChange('internalId', e.target.value)} placeholder={t("samples.forExampleFam899d92")} required />
            </div>
            <div>
              <label className="block text-xs text-fg-muted mb-1">{t("samples.batch6b2cf2")}</label>
              <Input value={formData.batch} onChange={(e) => handleChange('batch', e.target.value)} placeholder={t("samples.forExampleBatch7b91d9")} />
            </div>
            <div>
              <label className="block text-xs text-fg-muted mb-1">{t("samples.clinicalDiagnosis654a81")}</label>
              <Input value={formData.clinicalDiagnosis} onChange={(e) => handleChange('clinicalDiagnosis', e.target.value)} placeholder={t("samples.forExampleSuspectedHereditaryCardiomyopathybeebec")} />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-fg-default mb-3">{t("samples.pedigreeSamples10e660")}{formData.sampleIds.length} {t("samples.labelffaa9d")}</h3>
          {formData.sampleIds.length > 0 ? (
            <div className="space-y-2 mb-3">
              {formData.sampleIds.map((sampleId) => {
                const sample = getSampleInfo(sampleId);
                const isProband = formData.probandSampleId === sampleId;
                return (
                  <div key={sampleId} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${isProband ? 'bg-accent-subtle border-accent-muted' : 'bg-canvas-subtle border-border-default'}`}>
                    <div className="flex min-w-0 flex-wrap items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 ${isProband ? 'bg-accent-emphasis border-accent-emphasis' : 'border-border-default'}`} />
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="font-mono text-sm text-fg-default">{sampleId.substring(0, 8)}</span>
                        {sample && <span className="text-fg-muted text-sm">({sample.internalId})</span>}
                        {isProband && <Tag variant="info">{t("samples.probandc8c1fa")}</Tag>}
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      {!isProband && (
                        <button type="button" onClick={() => handleSetProband(sampleId)} className="text-xs text-accent-fg hover:underline">{t("samples.setAsProband5e864f")}</button>
                      )}
                      <ActionButton size="small" iconOnly action="delete" variant="ghost" type="button" onClick={() => handleRemoveSample(sampleId)} aria-label={t("samples.removeSample0cc467", {p0: String(sample?.internalId || sampleId)})} className="p-1 rounded text-fg-muted hover:text-danger-fg hover:bg-danger-subtle transition-colors" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-fg-muted mb-3 p-4 bg-canvas-subtle rounded-lg text-center">{t("samples.noSamplesAddOneBelow86274a")}</div>
          )}
          <div className="mb-3">
            <Input placeholder={t("samples.searchSampleOrInternalId2cb968")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} leftElement={<Search className="w-4 h-4" />} />
          </div>
          <div className="border border-border-default rounded-lg max-h-48 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-fg-muted">{t("samples.loadingSampleListf00bfb")}</div>
            ) : filteredSamples.length > 0 ? (
              <div className="divide-y divide-border-subtle">
                {filteredSamples.map((sample) => {
                  const isSelected = formData.sampleIds.includes(sample.id);
                  return (
                    <button type="button" aria-pressed={isSelected} key={sample.id} onClick={() => handleToggleSample(sample.id)} className={`block w-full px-4 py-2 text-left cursor-pointer transition-colors ${isSelected ? 'bg-accent-subtle' : 'hover:bg-canvas-subtle'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex min-w-0 flex-wrap items-center gap-3">
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${isSelected ? 'bg-accent-emphasis border-accent-emphasis' : 'border-border-default'}`}>
                            {isSelected && <Check className="w-3 h-3 text-fg-on-emphasis" />}
                          </div>
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="font-mono text-sm text-fg-default">{sample.id.substring(0, 8)}</span>
                            <span className="text-fg-muted text-sm">({sample.internalId})</span>
                            <Tag variant={sample.gender === 'male' ? 'info' : sample.gender === 'female' ? 'warning' : 'neutral'}>{translateUI(genderLabels[sample.gender], t)}</Tag>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 text-center text-fg-muted">{t("samples.noMatchingSamplesc0d84a")}</div>
            )}
          </div>
          <p className="mt-2 text-xs text-fg-muted">{t("samples.clickToAddRemoveSamplesTheFirsteae7b9")}</p>
        </div>

        <div>
          <label className="block text-xs text-fg-muted mb-1">{t("admin.notese03614")}</label>
          <TextArea value={formData.remark} onChange={(e) => handleChange('remark', e.target.value)} placeholder={t("samples.enterPedigreeNotes11f6bb")} rows={3} />
        </div>
      </form>
    </AppModal>
  );
}
