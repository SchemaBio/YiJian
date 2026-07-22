'use client';

import * as React from 'react';
import { Button, Input, Modal, ModalBody, ModalFooter, ModalHeader } from '@schema/ui-kit';
import { AlertCircle, CheckCircle, Database, Link2, Link2Off, RefreshCw } from 'lucide-react';
import { bindSampleMatchedPairFromUploadJob, clearSampleMatchedPair, updateSampleMatchedPair } from '@/lib/samples';
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
  const [uploadJobId, setUploadJobId] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    setR1Path(sample.matchedPair?.r1Path ?? '');
    setR2Path(sample.matchedPair?.r2Path ?? '');
    setUploadJobId('');
    setError('');
  }, [sample.id, sample.matchedPair?.r1Path, sample.matchedPair?.r2Path]);

  const canSave = uploadJobId.trim() !== '' || (r1Path.trim() !== '' && r2Path.trim() !== '');

  const handleSaveMatch = async () => {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      const updated = uploadJobId.trim()
        ? await bindSampleMatchedPairFromUploadJob(sample.id, uploadJobId.trim())
        : await updateSampleMatchedPair(sample.id, {
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

  const handleClearMatch = async () => {
    setSaving(true);
    setError('');
    try {
      const updated = await clearSampleMatchedPair(sample.id);
      onSampleUpdated?.(updated);
      setUnmatchConfirmOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '解除测序数据匹配失败');
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
                <div className="text-xs text-fg-muted mt-1">R1 / R2 文件已就绪，可用于创建分析任务。</div>
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
                  可使用已完成的双端 FASTQ 上传任务进行绑定，也可填写已有文件路径。
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
            双端 FASTQ 上传完成后可使用上传任务 ID 绑定；解除匹配不会删除已上传文件。
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
              文件引用必须属于当前用户或机构。
            </p>
            <div className="space-y-2 rounded-md border border-border-default bg-canvas-subtle p-3">
              <label className="text-sm font-medium text-fg-default">上传任务 ID（推荐）</label>
              <Input
                value={uploadJobId}
                onChange={(e) => setUploadJobId(e.target.value)}
                placeholder="已完成的双端 FASTQ 上传任务 UUID"
              />
              <p className="text-xs text-fg-muted">
                使用双端 FASTQ 上传返回的任务 ID 绑定 R1/R2 文件。
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-fg-muted">
              <span className="h-px flex-1 bg-border-default" />
              <span>或手动填写已有文件路径</span>
              <span className="h-px flex-1 bg-border-default" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-fg-default">R1 文件路径或存储键</label>
              <Input
                value={r1Path}
                onChange={(e) => setR1Path(e.target.value)}
                placeholder="例如 uploads/.../sample_R1.fastq.gz"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-fg-default">R2 文件路径或存储键</label>
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
        <ModalHeader>确认解除测序数据匹配</ModalHeader>
        <ModalBody>
          <p className="text-sm text-fg-muted">
            将清空当前样本的 R1/R2 匹配关系。此操作不会删除已上传文件。
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setUnmatchConfirmOpen(false)} disabled={saving}>
            取消
          </Button>
          <Button
            variant="danger"
            onClick={() => void handleClearMatch()}
            disabled={saving}
            leftIcon={saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : undefined}
          >
            {saving ? '解除中...' : '确认解除'}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
