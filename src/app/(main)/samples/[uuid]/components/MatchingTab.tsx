'use client';

import * as React from 'react';
import { Button } from '@schema/ui-kit';
import { AlertCircle, CheckCircle, Database, Link2, Link2Off, Loader2 } from 'lucide-react';
import { bindSampleDataAssets, clearSampleMatchedPair } from '@/lib/samples';
import { listDataAssets, type DataAsset } from '@/lib/data-assets';
import type { SampleDetail, SampleMatchStatus } from '../../types';
import { AppModal, ModalSectionHeading } from '@/components/shared';

interface MatchingTabProps { sample: SampleDetail; onSampleUpdated?: (sample: SampleDetail) => void }

const statusCopy: Record<SampleMatchStatus, { title: string; detail: string; tone: string }> = {
  unmatched: { title: '未匹配测序数据', detail: '系统尚未发现与样本编号一致的完整数据对。', tone: 'border-warning-muted bg-warning-subtle' },
  partial: { title: '仅匹配到一端数据', detail: '已发现 Read1 或 Read2，请补充另一端文件或手动选择。', tone: 'border-warning-muted bg-warning-subtle' },
  conflict: { title: '存在多个匹配候选', detail: '系统不会自动猜测，请手动选择正确的 Read1 和 Read2。', tone: 'border-danger-muted bg-danger-subtle' },
  matched: { title: '已匹配双端测序数据', detail: 'Read1 / Read2 已就绪，可用于创建分析任务。', tone: 'border-success-muted bg-success-subtle' },
  missing: { title: '已关联文件缺失', detail: '原始数据已到期或无法访问，请重新上传并关联。', tone: 'border-danger-muted bg-danger-subtle' },
};

function fileName(path: string): string { return path.replace(/\\/g, '/').split('/').filter(Boolean).pop() || path }

export function MatchingTab({ sample, onSampleUpdated }: MatchingTabProps) {
  const [matchOpen, setMatchOpen] = React.useState(false);
  const [clearOpen, setClearOpen] = React.useState(false);
  const [assets, setAssets] = React.useState<DataAsset[]>([]);
  const [read1Id, setRead1Id] = React.useState('');
  const [read2Id, setRead2Id] = React.useState('');
  const [loadingAssets, setLoadingAssets] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  const status = statusCopy[sample.matchStatus ?? (sample.matchedPair ? 'matched' : 'unmatched')];
  const read1Assets = assets.filter((asset) => asset.status === 'completed' && asset.read_type === 'read1');
  const read2Assets = assets.filter((asset) => asset.status === 'completed' && asset.read_type === 'read2');

  const openMatcher = async () => {
    setMatchOpen(true); setLoadingAssets(true); setError('');
    try { const result = await listDataAssets(); setAssets(result.items ?? []); }
    catch (err) { setError(err instanceof Error ? err.message : '加载数据资产失败'); }
    finally { setLoadingAssets(false); }
  };

  const save = async () => {
    if (!read1Id || !read2Id) return;
    setSaving(true); setError('');
    try {
      const updated = await bindSampleDataAssets(sample.id, read1Id, read2Id);
      onSampleUpdated?.(updated); setMatchOpen(false);
    } catch (err) { setError(err instanceof Error ? err.message : '保存数据关联失败'); }
    finally { setSaving(false); }
  };

  const clear = async () => {
    setSaving(true); setError('');
    try { const updated = await clearSampleMatchedPair(sample.id); onSampleUpdated?.(updated); setClearOpen(false); }
    catch (err) { setError(err instanceof Error ? err.message : '解除数据关联失败'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className={`rounded-md border p-4 ${status.tone}`}>
        <div className="flex flex-wrap items-start gap-3">
          {sample.matchStatus === 'matched' ? <CheckCircle className="mt-0.5 h-5 w-5 text-success-fg" /> : <AlertCircle className="mt-0.5 h-5 w-5 text-warning-fg" />}
          <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="text-sm font-medium text-fg-default">{status.title}</p>{sample.matchMode && <span className="rounded bg-canvas-default px-2 py-0.5 text-xs text-fg-muted">{sample.matchMode === 'manual' ? '手动关联' : '自动匹配'}</span>}</div><p className="mt-1 text-xs text-fg-muted">{status.detail}</p></div>
          <Button variant="secondary" size="small" leftIcon={<Link2 className="h-4 w-4" />} onClick={() => void openMatcher()}>{sample.matchedPair ? '更新关联' : '手动关联'}</Button>
          {sample.matchedPair && <Button variant="secondary" size="small" leftIcon={<Link2Off className="h-4 w-4" />} onClick={() => setClearOpen(true)}>解除</Button>}
        </div>
      </div>

      {sample.matchedPair && <div className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-border-default bg-border-default md:grid-cols-2"><div className="bg-canvas-default p-4"><p className="text-xs text-fg-muted">Read1</p><p className="mt-1 truncate text-sm font-medium text-fg-default" title={fileName(sample.matchedPair.r1Path)}>{fileName(sample.matchedPair.r1Path)}</p></div><div className="bg-canvas-default p-4"><p className="text-xs text-fg-muted">Read2</p><p className="mt-1 truncate text-sm font-medium text-fg-default" title={fileName(sample.matchedPair.r2Path)}>{fileName(sample.matchedPair.r2Path)}</p></div></div>}
      {error && <div className="rounded-md border border-danger-muted bg-danger-subtle p-3 text-sm text-danger-fg">{error}</div>}

      <AppModal
        open={matchOpen}
        onOpenChange={(open) => !saving && setMatchOpen(open)}
        title="关联数据资产"
        size="large"
        footer={
          <>
            <Button variant="secondary" disabled={saving} onClick={() => setMatchOpen(false)}>取消</Button>
            <Button variant="primary" disabled={saving || !read1Id || !read2Id} leftIcon={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} onClick={() => void save()}>{saving ? '保存中...' : '保存关联'}</Button>
          </>
        }
      >
        <div className="space-y-6">
          <section>
            <ModalSectionHeading
              icon={<Database className="h-4 w-4" />}
              title="选择测序数据"
              description="分别选择 Read1 和 Read2；手动关联保存后不会被自动匹配覆盖"
            />
            {loadingAssets ? (
              <div className="flex h-28 items-center justify-center gap-2 text-sm text-fg-muted"><Loader2 className="h-4 w-4 animate-spin" />加载数据资产</div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block"><span className="mb-1.5 block text-xs font-medium text-fg-muted">Read1</span><select value={read1Id} onChange={(event) => setRead1Id(event.target.value)} className="h-10 w-full rounded-md border border-border-default bg-canvas-default px-3 text-sm text-fg-default"><option value="">请选择 Read1 文件</option>{read1Assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.file_name} · {asset.id.slice(0, 8)}</option>)}</select></label>
                <label className="block"><span className="mb-1.5 block text-xs font-medium text-fg-muted">Read2</span><select value={read2Id} onChange={(event) => setRead2Id(event.target.value)} className="h-10 w-full rounded-md border border-border-default bg-canvas-default px-3 text-sm text-fg-default"><option value="">请选择 Read2 文件</option>{read2Assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.file_name} · {asset.id.slice(0, 8)}</option>)}</select></label>
              </div>
            )}
          </section>
          {!loadingAssets && (read1Assets.length === 0 || read2Assets.length === 0) && <div className="flex gap-2 rounded-md border border-warning-muted bg-warning-subtle p-3 text-xs text-warning-fg"><Database className="h-4 w-4 shrink-0" />数据中心中没有完整的可用 Read1/Read2，请先上传数据。</div>}
        </div>
      </AppModal>

      <AppModal
        open={clearOpen}
        onOpenChange={(open) => !saving && setClearOpen(open)}
        title="解除数据关联"
        size="small"
        footer={<><Button variant="secondary" disabled={saving} onClick={() => setClearOpen(false)}>取消</Button><Button variant="danger" disabled={saving} onClick={() => void clear()}>{saving ? '处理中...' : '确认解除'}</Button></>}
      >
        <p className="text-sm text-fg-muted">解除后不会删除数据中心文件，系统可在下一轮重新进行自动匹配。</p>
      </AppModal>
    </div>
  );
}
