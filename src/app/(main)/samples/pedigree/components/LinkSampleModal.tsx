'use client';
import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';


import { ActionButton as Button, ActionButton } from '@/components/shared/ActionButton';


import * as React from 'react';
import { Input } from '@schema/ui-kit';
import { Tag } from '@/components/shared/Tag';
import { Link2, Loader2, Search } from 'lucide-react';
import { AppModal, ModalSectionHeading } from '@/components/shared';
import { listSamples } from '@/lib/samples';
import type { Sample } from '../../types';

interface LinkSampleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (sampleId: string) => void | Promise<void>;
  memberName: string;
}

export function LinkSampleModal({ isOpen, onClose, onSelect, memberName }: LinkSampleModalProps) {
  const t = useText();
  const [retry, setRetry] = React.useState(0);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [samples, setSamples] = React.useState<Sample[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [submittingSampleId, setSubmittingSampleId] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState('');

  React.useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setLoading(true);
    setSubmitError('');
    listSamples()
      .then(value => { if (active) setSamples(value); })
      .catch((err) => {
        if (!active) return;
        setSamples([]);
        setSubmitError(err instanceof Error ? errorText(err, t) : t("samples.unableToReadSampleListcb0cfa"));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isOpen, retry]);

  const filteredSamples = React.useMemo(() => {
    if (!searchQuery) return samples;
    const query = searchQuery.toLowerCase();
    return samples.filter(
      (s) => s.id.toLowerCase().includes(query) || s.internalId.toLowerCase().includes(query)
    );
  }, [samples, searchQuery]);

  const handleSelect = async (sampleId: string) => {
    if (submittingSampleId) return;
    setSubmittingSampleId(sampleId);
    setSubmitError('');
    try {
      await onSelect(sampleId);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? errorText(err, t) : t("samples.unableToLinkSample336f6e"));
    } finally {
      setSubmittingSampleId(null);
    }
  };

  return (
    <AppModal
      open={isOpen}
      onOpenChange={(open) => !open && !submittingSampleId && onClose()}
      title={t("samples.linkSampled65534")}
      size="medium"
      footer={
        <Button variant="secondary" onClick={onClose} disabled={!!submittingSampleId} className="w-full">{t("admin.cancel4d0b46")}</Button>
      }
    >
      <div className="space-y-6">
        {submitError && (
        <div className="mb-3 rounded-md border border-danger-muted bg-danger-subtle px-3 py-2 text-sm text-danger-fg">
          {submitError}
          {!loading && samples.length === 0 && <ActionButton action="retry" variant="ghost" type="button" className="yj-tool-button ml-2" onClick={() => setRetry(value => value + 1)}>{t("pipeline.retrye2d53a")}</ActionButton>}
        </div>
      )}
      <section>
        <ModalSectionHeading
          icon={<Link2 className="h-4 w-4" />}
          title={t("samples.selectSamplef0e89f")}
          description={t("samples.selectASampleToLinkTo670464", {p0: String(memberName)})}
        />
      <div className="mb-3">
        <Input
          placeholder={t("samples.searchSampleOrInternalId2cb968")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leftElement={<Search className="w-4 h-4" />}
        />
      </div>
      <div className="max-h-[400px] overflow-y-auto rounded-md border border-border-default">
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-6 py-8 text-center text-fg-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("samples.loadingSampleListf00bfb")}</div>
        ) : filteredSamples.length > 0 ? (
          <div className="divide-y divide-border">
            {filteredSamples.map((sample) => {
              const isMatched = sample.matchedPair !== null;
              return (
                <button
                  type="button"
                  disabled={Boolean(submittingSampleId)}
                  key={sample.id}
                  className={`block w-full px-4 py-3 text-left transition-colors ${submittingSampleId ? 'cursor-wait opacity-75' : 'hover:bg-canvas-subtle cursor-pointer'}`}
                  onClick={() => handleSelect(sample.id)}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="break-all text-sm font-medium text-fg-default">{sample.internalId}</span>
                      <span className="ml-2 font-mono text-xs text-fg-muted">{sample.id.substring(0, 8)}</span>
                      <Tag variant={isMatched ? 'success' : 'warning'} className="ml-2">{isMatched ? t("samples.matched113028") : t("samples.unmatched434b19")}</Tag>
                      {submittingSampleId === sample.id && <span className="ml-2 text-xs text-fg-muted">{t("samples.linking54a479")}</span>}
                    </div>
                    <span className="text-sm text-fg-subtle">{t(sample.sampleType)}</span>
                  </div>
                  <div className="text-xs text-fg-subtle mt-1">{sample.clinicalDiagnosis}</div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="px-6 py-8 text-center text-fg-muted">{t("samples.noMatchingSamplesc0d84a")}</div>
        )}
      </div>
      </section>
      </div>
    </AppModal>
  );
}
