'use client';

import * as React from 'react';
import { Button, Input, Modal, ModalBody, ModalFooter, ModalHeader } from '@schema/ui-kit';
import { AlertCircle, CheckCircle, Database, Link2, Link2Off, RefreshCw } from 'lucide-react';
import { updateSampleMatchedPair } from '@/lib/samples';
import type { SampleDetail } from '../../types';

interface MatchingTabProps {
  sample: SampleDetail;
  onSampleUpdated?: (sample: SampleDetail) => void;
}

function pathFileName(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  return normalized.split('/').filter(Boolean).pop() || path;
}

export function MatchingTab({ sample, onSampleUpdated }: MatchingTabProps) {
  const [matchModalOpen, setMatchModalOpen] = React.useState(false);
  const [unmatchConfirmOpen, setUnmatchConfirmOpen] = React.useState(false);
  const [r1Path, setR1Path] = React.useState(sample.matchedPair?.r1Path ?? '');
  const [r2Path, setR2Path] = React.useState(sample.matchedPair?.r2Path ?? '');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    setR1Path(sample.matchedPair?.r1Path ?? '');
    setR2Path(sample.matchedPair?.r2Path ?? '');
    setError('');
  }, [sample.id, sample.matchedPair?.r1Path, sample.matchedPair?.r2Path]);

  const canSave = r1Path.trim() !== '' && r2Path.trim() !== '';

  const handleSaveMatch = async () => {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      const updated = await updateSampleMatchedPair(sample.id, {
        r1Path: r1Path.trim(),
        r2Path: r2Path.trim(),
      });
      onSampleUpdated?.(updated);
      setMatchModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存测序数据匹配失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-canvas-subtle rounded-lg p-4">
        <h4 className="text-sm font-medium text-fg-default mb-3 flex items-center gap-2">
          <Database className="w-4 h-4" />
          数据匹配状态
        </h4>

        {sample.matchedPair ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-success-subtle rounded border border-success-muted">
              <CheckCircle className="w-5 h-5 text-success-fg" />
              <div className="flex-1">
                <div className="text-sm font-medium text-fg-default">已匹配双端测序数据</div>
                <div className="text-xs text-fg-muted mt-1">
                  数据来自 Octopus Sample.matched_pair，不再使用前端模拟测序池。
                </div>
              </div>
              <Button
                variant="secondary"
                size="small"
                leftIcon={<Link2 className="w-4 h-4" />}
                onClick={() => setMatchModalOpen(true)}
              >
                更新匹配
              </Button>
              <Button
                variant="secondary"
                size="small"
                leftIcon={<Link2Off className="w-4 h-4" />}
                onClick={() => setUnmatchConfirmOpen(true)}
              >
                解除匹配
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 p-3 bg-canvas-default rounded">
              <div>
                <span className="text-xs text-fg-muted">R1 文件</span>
                <p className="text-sm text-fg-default font-mono break-all">{sample.matchedPair.r1Path}</p>
                <p className="text-xs text-fg-muted mt-1">{pathFileName(sample.matchedPair.r1Path)}</p>
              </div>
              <div>
                <span className="text-xs text-fg-muted">R2 文件</span>
                <p className="text-sm text-fg-default font-mono break-all">{sample.matchedPair.r2Path}</p>
                <p className="text-xs text-fg-muted mt-1">{pathFileName(sample.matchedPair.r2Path)}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-warning-subtle rounded border border-warning-muted">
              <AlertCircle className="w-5 h-5 text-warning-fg" />
              <div className="flex-1">
                <div className="text-sm font-medium text-fg-default">未匹配测序数据</div>
                <div className="text-xs text-fg-muted mt-1">
                  Octopus 当前未提供“可用测序池”匹配接口；可在此写入已上传文件的 storage key 或后端允许的文件路径。
                </div>
              </div>
              <Button
                variant="primary"
                size="small"
                leftIcon={<Link2 className="w-4 h-4" />}
                onClick={() => setMatchModalOpen(true)}
              >
                写入匹配
              </Button>
            </div>
          </div>
        )}

        <div className="mt-3 flex items-start gap-2 p-3 bg-canvas-default rounded">
          <AlertCircle className="w-4 h-4 text-fg-muted mt-0.5" />
          <div className="text-xs text-fg-muted leading-5">
            `/upload/jobs` 可创建和查询上传任务，但当前 Octopus 列表响应不返回可直接写入样本的 `storage_key`。
            因此本页不再伪造“可用测序数据列表”，避免把前端本地状态误当成真实匹配关系。
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded border border-danger-muted bg-danger-subtle text-sm text-danger-fg">
          {error}
        </div>
      )}

      <Modal open={matchModalOpen} onOpenChange={setMatchModalOpen}>
        <ModalHeader>{sample.matchedPair ? '更新测序数据匹配' : '写入测序数据匹配'}</ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <p className="text-sm text-fg-muted">
              为样本 <span className="font-mono text-fg-default">{sample.internalId || sample.id}</span> 写入 R1/R2。
              后端会按当前用户/组织权限校验文件引用。
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium text-fg-default">R1 storage key / 文件路径</label>
              <Input
                value={r1Path}
                onChange={(e) => setR1Path(e.target.value)}
                placeholder="例如 uploads/.../sample_R1.fastq.gz"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-fg-default">R2 storage key / 文件路径</label>
              <Input
                value={r2Path}
                onChange={(e) => setR2Path(e.target.value)}
                placeholder="例如 uploads/.../sample_R2.fastq.gz"
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setMatchModalOpen(false)} disabled={saving}>
            取消
          </Button>
          <Button
            variant="primary"
            onClick={handleSaveMatch}
            disabled={!canSave || saving}
            leftIcon={saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : undefined}
          >
            {saving ? '保存中...' : '保存匹配'}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal open={unmatchConfirmOpen} onOpenChange={setUnmatchConfirmOpen}>
        <ModalHeader>当前后端暂不支持清空匹配</ModalHeader>
        <ModalBody>
          <p className="text-sm text-fg-muted">
            Octopus 的 `PUT /samples/:id` 只在 `r1_path` 或 `r2_path` 非空时更新 `matched_pair`，
            不能可靠表达“清空匹配”。前端不会再通过本地状态伪造解除匹配成功。
          </p>
          <p className="text-sm text-fg-muted mt-2">
            如需更换数据，请使用“更新匹配”写入新的 R1/R2；如需真正解绑，需要后端增加明确的清空字段或专用接口。
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="primary" onClick={() => setUnmatchConfirmOpen(false)}>
            我知道了
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
