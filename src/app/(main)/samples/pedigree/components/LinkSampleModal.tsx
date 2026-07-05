'use client';

import * as React from 'react';
import { Button, Input, Tag } from '@schema/ui-kit';
import { Search } from 'lucide-react';
import { AppModal } from '@/components/shared';
import { listSamples } from '@/lib/samples';
import type { Sample } from '../../types';

interface LinkSampleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (sampleId: string) => void | Promise<void>;
  memberName: string;
}

export function LinkSampleModal({ isOpen, onClose, onSelect, memberName }: LinkSampleModalProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [samples, setSamples] = React.useState<Sample[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [submittingSampleId, setSubmittingSampleId] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState('');

  React.useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setSubmitError('');
    listSamples()
      .then(setSamples)
      .catch((err) => {
        setSamples([]);
        setSubmitError(err instanceof Error ? err.message : 'Failed to load samples');
      })
      .finally(() => setLoading(false));
  }, [isOpen]);

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
      setSubmitError(err instanceof Error ? err.message : 'Failed to link sample');
    } finally {
      setSubmittingSampleId(null);
    }
  };

  return (
    <AppModal
      open={isOpen}
      onOpenChange={(open) => !open && !submittingSampleId && onClose()}
      title="关联样本"
      size="medium"
      footer={
        <Button variant="secondary" onClick={onClose} disabled={!!submittingSampleId} className="w-full">取消</Button>
      }
    >
      <div className="mb-3">
        <p className="text-sm text-fg-muted">为 {memberName} 选择关联样本</p>
      </div>
      {submitError && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {submitError}
        </div>
      )}
      <div className="mb-3">
        <Input
          placeholder="搜索样本编号、内部编号..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leftElement={<Search className="w-4 h-4" />}
        />
      </div>
      <div className="max-h-[400px] overflow-y-auto border border-border rounded-lg">
        {loading ? (
          <div className="px-6 py-8 text-center text-fg-muted">加载样本列表...</div>
        ) : filteredSamples.length > 0 ? (
          <div className="divide-y divide-border">
            {filteredSamples.map((sample) => {
              const isMatched = sample.matchedPair !== null;
              return (
                <div
                  key={sample.id}
                  className={`px-4 py-3 transition-colors ${submittingSampleId ? 'cursor-wait opacity-75' : 'hover:bg-canvas-subtle cursor-pointer'}`}
                  onClick={() => handleSelect(sample.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-sm text-fg-default">{sample.id.substring(0, 8)}</span>
                      <span className="text-fg-muted ml-2">{sample.internalId}</span>
                      <Tag variant={isMatched ? 'success' : 'warning'} className="ml-2">{isMatched ? '已匹配' : '未匹配'}</Tag>
                      {submittingSampleId === sample.id && <span className="ml-2 text-xs text-fg-muted">linking...</span>}
                    </div>
                    <span className="text-sm text-fg-subtle">{sample.sampleType}</span>
                  </div>
                  <div className="text-xs text-fg-subtle mt-1">{sample.clinicalDiagnosis}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-6 py-8 text-center text-fg-muted">未找到匹配的样本</div>
        )}
      </div>
    </AppModal>
  );
}
