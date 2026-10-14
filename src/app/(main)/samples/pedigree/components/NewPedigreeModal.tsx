'use client';
import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';
import { translateUI } from '@/i18n/text';

import { ActionButton as Button } from '@/components/shared/ActionButton';


import * as React from 'react';
import { Input, TextArea } from '@schema/ui-kit';
import { Tag } from '@/components/shared/Tag';
import { Search, Check, Users, UserRound, FileText, Loader2 } from 'lucide-react';
import { AppModal, ModalSectionHeading } from '@/components/shared';
import { listSamples } from '@/lib/samples';

interface Sample {
  id: string;
  internalId: string;
  gender: 'male' | 'female' | 'unknown';
}

interface NewPedigreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: NewPedigreeFormData) => void | Promise<void>;
}

export interface NewPedigreeFormData {
  internalId: string;          // 家系内部编号
  clinicalDiagnosis: string;   // 临床诊断
  batch: string;
  probandSampleId: string;     // 先证者样本UUID
  remark: string;
}

export function NewPedigreeModal({ isOpen, onClose, onSubmit }: NewPedigreeModalProps) {
  const t = useText();
  const [formData, setFormData] = React.useState<NewPedigreeFormData>({
    internalId: '',
    clinicalDiagnosis: '',
    batch: '',
    probandSampleId: '',
    remark: '',
  });

  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState('');
  const [samples, setSamples] = React.useState<Sample[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [loading, setLoading] = React.useState(false);

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

  const handleChange = (field: keyof NewPedigreeFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSelectSample = (sampleId: string) => {
    setFormData(prev => ({
      ...prev,
      probandSampleId: prev.probandSampleId === sampleId ? '' : sampleId,
    }));
  };

  const handleSubmit = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!formData.probandSampleId || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await onSubmit(formData);
      onClose();
      // Reset form only after all pedigree creation API steps succeed.
      setFormData({
        internalId: '',
        clinicalDiagnosis: '',
        batch: '',
        probandSampleId: '',
        remark: '',
      });
      setSearchQuery('');
    } catch (err) {
      setSubmitError(err instanceof Error ? errorText(err, t) : t("interface.failedToCreatePedigree3cd41b"));
    } finally {
      setSubmitting(false);
    }
  };

  const selectedSample = samples.find(s => s.id === formData.probandSampleId);

  const genderLabels = {
    male: t("samples.male51625d"),
    female: t("samples.female26bc84"),
    unknown: t("samples.unknownd9c32a"),
  };

  return (
    <AppModal
      open={isOpen}
      onOpenChange={(open) => !open && !submitting && onClose()}
      title={t("samples.newPedigreeb7e3c2")}
      size="large"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {t("admin.cancel4d0b46")}</Button>
          <Button action="add" loading={submitting} loadingLabel={t("pipeline.creating8c6348")}
            variant="primary"
            onClick={(e: React.MouseEvent) => handleSubmit(e)}
            disabled={!formData.probandSampleId || submitting}

          >
            {t("samples.createPedigreec15037")}</Button>
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
            icon={<Users className="h-4 w-4" />}
            title={t("samples.pedigreeInformatione42ffe")}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-fg-muted">{t("samples.internalIdadcd0f")}</label>
              <Input
                value={formData.internalId}
                onChange={(e) => handleChange('internalId', e.target.value)}
                placeholder={t("samples.forExampleFam899d92")}
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-fg-muted">{t("samples.batch6b2cf2")}</label>
              <Input
                value={formData.batch}
                onChange={(e) => handleChange('batch', e.target.value)}
                placeholder={t("samples.forExampleBatch7b91d9")}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-fg-muted">{t("samples.clinicalDiagnosis654a81")}</label>
              <Input
                value={formData.clinicalDiagnosis}
                onChange={(e) => handleChange('clinicalDiagnosis', e.target.value)}
                placeholder={t("samples.forExampleSuspectedHereditaryCardiomyopathybeebec")}
              />
            </div>
          </div>
        </section>

        <section className="border-t border-[var(--yj-border-subtle)] pt-5">
          <ModalSectionHeading
            icon={<UserRound className="h-4 w-4" />}
            title={t("samples.probandSample30fd56")}
            description={t("samples.selectAProbandFromCurrentOrganizationSamplese48deb")}
          />
          {selectedSample && (
            <div className="mb-3 text-xs font-medium text-success-fg">{t("samples.selected9c5605")}{selectedSample.internalId}</div>
          )}
          <div className="mb-3">
            <Input
              placeholder={t("samples.searchSampleOrInternalId2cb968")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftElement={<Search className="w-4 h-4" />}
            />
          </div>
          <div className="max-h-64 overflow-y-auto rounded-md border border-border-default">
            {loading ? (
              <div className="flex items-center justify-center gap-2 p-8 text-center text-fg-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("samples.loadingSampleListf00bfb")}</div>
            ) : filteredSamples.length > 0 ? (
              <div className="divide-y divide-border-default">
                {filteredSamples.map((sample) => {
                  const isSelected = formData.probandSampleId === sample.id;
                  return (
                    <div
                      key={sample.id}
                      onClick={() => handleSelectSample(sample.id)}
                      className={`px-4 py-3 cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-l-2 border-l-accent-emphasis bg-accent-subtle'
                          : 'hover:bg-canvas-subtle'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? 'border-accent-emphasis bg-accent-emphasis' : 'border-border-emphasis'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm text-fg-default">
                                {sample.id.substring(0, 8)}
                              </span>
                              <span className="text-sm text-fg-muted">
                                ({sample.internalId})
                              </span>
                              <Tag variant={sample.gender === 'male' ? 'info' : sample.gender === 'female' ? 'warning' : 'neutral'}>
                                {translateUI(genderLabels[sample.gender], t)}
                              </Tag>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-fg-muted">
                {t("samples.noMatchingSamplesc0d84a")}</div>
            )}
          </div>
          <p className="mt-2 text-xs text-fg-muted">
            {t("samples.theProbandSampleMustAlreadyExistIn02b7fe")}</p>
        </section>

        <section className="border-t border-[var(--yj-border-subtle)] pt-5">
          <ModalSectionHeading
            icon={<FileText className="h-4 w-4" />}
            title={t("admin.notese03614")}
          />
          <label className="mb-1.5 block text-xs font-medium text-fg-muted">{t("samples.notes11abee")}</label>
          <TextArea
            value={formData.remark}
            onChange={(e) => handleChange('remark', e.target.value)}
            placeholder={t("samples.enterPedigreeNotes11f6bb")}
            rows={3}
          />
        </section>
      </form>
    </AppModal>
  );
}
