'use client';

import * as React from 'react';
import { Button, Input, Tag } from '@schema/ui-kit';
import { X, Search } from 'lucide-react';
import { AppModal } from '@/components/shared';
import { mockSamples } from '../../mock-data';

interface LinkSampleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (sampleId: string) => void;
  memberName: string;
}

export function LinkSampleModal({ isOpen, onClose, onSelect, memberName }: LinkSampleModalProps) {
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredSamples = React.useMemo(() => {
    if (!searchQuery) return mockSamples;
    const query = searchQuery.toLowerCase();
    return mockSamples.filter(
      (s) => s.id.toLowerCase().includes(query) || s.internalId.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  return (
    <AppModal
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title="关联样本"
      size="medium"
      footer={
        <Button variant="secondary" onClick={onClose} className="w-full">取消</Button>
      }
    >
      <div className="mb-3">
        <p className="text-sm text-fg-muted">为 {memberName} 选择关联样本</p>
      </div>
      <div className="mb-3">
        <Input
          placeholder="搜索样本编号、内部编号..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leftElement={<Search className="w-4 h-4" />}
        />
      </div>
      <div className="max-h-[400px] overflow-y-auto border border-border rounded-lg">
        {filteredSamples.length > 0 ? (
          <div className="divide-y divide-border">
            {filteredSamples.map((sample) => {
              const isMatched = sample.matchedPair !== null;
              return (
                <div
                  key={sample.id}
                  className="px-4 py-3 hover:bg-canvas-subtle cursor-pointer transition-colors"
                  onClick={() => { onSelect(sample.id); onClose(); }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-sm text-fg-default">{sample.id.substring(0, 8)}</span>
                      <span className="text-fg-muted ml-2">{sample.internalId}</span>
                      <Tag variant={isMatched ? 'success' : 'warning'} className="ml-2">{isMatched ? '已匹配' : '未匹配'}</Tag>
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
