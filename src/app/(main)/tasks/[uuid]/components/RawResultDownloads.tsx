'use client';

import * as React from 'react';
import { Button, Modal, ModalHeader, ModalBody, ModalFooter } from '@schema/ui-kit';
import { Download, FileArchive, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

interface DownloadFile { id: string; filename: string; size_bytes: number; credits: number; role?: string }
interface Catalog { attempt_id: string; zip_status: string; zip_error?: string; zip?: DownloadFile; bams: DownloadFile[]; missing: string[] }
interface Quote { id: string; kind: string; filename: string; size_bytes: number; credits: number; charged_at?: string; expires_at?: string }
interface Issued { id: string; url: string; filename: string; credits_charged: number; expires_at: string; ip_bound: boolean }
const gb = (size: number) => `${(size / 1_000_000_000).toLocaleString('zh-CN', { maximumFractionDigits: 3 })} GB`;
const labels: Record<string, string> = { mt_vcf: '线粒体 VCF', snp_indel: 'SNP/InDel 报告', mt: '线粒体报告', cnv_region: 'CNV 区域', cnv_gene: 'CNV 外显子', mei: 'MEI', upd: 'UPD', roh: 'ROH', qc_result: 'QC 报告', str: 'STR' };

export function RawResultDownloads({ taskId }: { taskId: string }) {
  const [catalog, setCatalog] = React.useState<Catalog | null>(null);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [quote, setQuote] = React.useState<Quote | null>(null);
  const [issued, setIssued] = React.useState<Issued | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [active, setActive] = React.useState<Quote[]>([]);
  const polling = React.useRef(false);
  const generation = React.useRef(0);
  const base = `/v1/tasks/${encodeURIComponent(taskId)}/downloads`;
  React.useEffect(() => {
    const current = ++generation.current;
    let disposed = false;
    let pending = false;
    setCatalog(null); setQuote(null); setIssued(null); setActive([]); setError(''); setBusy(false); polling.current = false;
    const load = async () => {
      if (pending) return; pending = true;
      try {
        const next = await api.get<Catalog>(base);
        if (!disposed && generation.current === current) { setCatalog(next); setError(''); polling.current = next.zip_status === 'building'; }
      } catch (cause) {
        if (!disposed && generation.current === current) setError(cause instanceof Error ? cause.message : '无法读取归档下载信息');
      } finally { pending = false; }
    };
    void load();
    void api.get<Quote[]>(`${base}/active`).then(rows => { if (!disposed) setActive(rows); }).catch(() => {});
    const timer = window.setInterval(() => { if (!disposed && polling.current) void load(); }, 5000);
    return () => { disposed = true; window.clearInterval(timer); ++generation.current; };
  }, [base]);

  const request = async (kind: 'zip' | 'bam', file?: DownloadFile) => {
    if (busy) return;
    const current = generation.current;
    setBusy(true); setError(''); setCopied(false);
    try {
      if (kind === 'zip' && catalog?.zip_status !== 'ready') {
        const next = await api.post<Catalog>(`${base}/prepare`, {});
        if (current === generation.current) { setCatalog(next); polling.current = next.zip_status === 'building'; }
      } else {
        const next = await api.post<Quote>(`${base}/quote`, { kind, file_id: file?.id });
        if (current === generation.current) setQuote(next);
      }
    } catch (cause) {
      if (current === generation.current) setError(cause instanceof Error ? cause.message : '下载申请失败');
    } finally { if (current === generation.current) setBusy(false); }
  };
  const confirm = async () => {
    if (!quote || busy) return;
    const current = generation.current;
    setBusy(true); setError('');
    try {
      const next = await api.post<Issued>(`${base}/issue`, { quote_id: quote.id });
      if (current !== generation.current) return;
      setIssued(next); setQuote(null);
      const link = document.createElement('a');
      link.href = next.url; link.download = next.filename; link.rel = 'noreferrer noopener';
      document.body.appendChild(link); link.click(); link.remove();
    } catch (cause) {
      // Retain the quote: retrying this exact ID is billing-idempotent.
      if (current === generation.current) setError(cause instanceof Error ? cause.message : '申请结果暂未确认，请重试同一申请');
    } finally { if (current === generation.current) setBusy(false); }
  };

  return <section className="rounded-lg bg-canvas-subtle p-4 space-y-3">
    <h4 className="flex items-center gap-2 text-sm font-medium"><Download className="h-4 w-4" />原始文件下载</h4>
    <p className="text-xs text-fg-muted">原始 ZIP 包含已归档的 SNP/InDel VCF、线粒体 VCF、CNV、MEI、UPD、ROH、STR 和 QC 报告，不含人工调整或 BAM。每次申请下载消耗 1 积分。</p>
    <Button size="small" variant="secondary" leftIcon={catalog?.zip_status === 'building' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />} disabled={busy || !catalog || catalog.zip_status === 'building'} onClick={() => void request('zip')}>
      {catalog?.zip_status === 'building' ? '正在打包（尚未扣费）' : catalog?.zip_status === 'ready' ? '下载原始 ZIP · 1 积分' : '准备原始 ZIP（不扣费）'}
    </Button>
    {catalog?.zip_error && <p className="text-sm text-danger-fg">{catalog.zip_error}</p>}
    {!!catalog?.missing.length && <details className="text-xs text-fg-muted"><summary className="cursor-pointer">部分输出未产生或未归档</summary><ul className="mt-2 space-y-1">{catalog.missing.map(item => <li key={item}>{item.replace(/^[a-z_]+/, key => labels[key] || key)}</li>)}</ul></details>}
    <div className="border-t border-border-default pt-3 space-y-2">
      <p className="text-sm font-medium">去重后的 BAM</p>
      <p className="text-xs text-fg-muted">按实际大小每 GB 1 积分，向上取整（1 GB = 1,000,000,000 字节）。每次申请计费；链接绑定申请时的公网 IP，3 小时内可续传，切换网络可能无法下载。</p>
      {catalog?.bams.map(file => <div key={file.id} className="flex flex-wrap items-center gap-3 text-sm">
        <span className="min-w-0 break-all">{file.role ? `${file.role} · ` : ''}{file.filename}</span><span className="text-fg-muted">{gb(file.size_bytes)}</span>
        <Button size="small" variant="secondary" className="shrink-0 whitespace-nowrap" disabled={busy} onClick={() => void request('bam', file)}>申请链接 · {file.credits} 积分</Button>
      </div>)}
      {catalog && !catalog.bams.length && <p className="text-xs text-fg-muted">当前执行未归档可下载的 BAM。</p>}
    </div>
    {error && <p role="alert" className="text-sm text-danger-fg">{error}</p>}
    {issued && <div className="rounded-md border border-border-default p-3 text-sm space-y-2">
      <p>已申请 {issued.filename}，消耗 {issued.credits_charged} 积分。有效至 {new Date(issued.expires_at).toLocaleString('zh-CN')}。</p>
      <p className="text-xs text-fg-muted">复制已有链接不重复扣费，请在同一公网 IP 下使用。</p>
      <Button size="small" variant="secondary" onClick={() => { void navigator.clipboard.writeText(issued.url).then(() => setCopied(true)).catch(() => setError('复制失败，请允许浏览器访问剪贴板')); }}>{copied ? '已复制' : '复制下载链接'}</Button>
    </div>}
    {!!active.length && <details className="text-sm"><summary className="cursor-pointer">恢复 3 小时内已有的下载申请</summary><div className="mt-2 space-y-2">{active.map(item => <div className="flex flex-wrap items-center gap-2" key={item.id}><span className="break-all">{item.filename}</span><Button size="small" variant="secondary" disabled={busy} onClick={() => setQuote(item)}>{item.charged_at ? '取回已付费链接' : '继续原申请'}</Button></div>)}</div></details>}
    <Modal open={!!quote} onOpenChange={open => { if (!open && !busy) setQuote(null); }}>
      <ModalHeader>确认下载费用</ModalHeader>
      <ModalBody><div className="space-y-2 text-sm"><p className="break-all">{quote?.filename}</p><p>{quote && gb(quote.size_bytes)} · {quote?.charged_at ? '本次取回不重复扣费，原申请已消耗' : '本次申请消耗'} <strong>{quote?.credits} 积分</strong></p><p className="text-fg-muted">链接绑定当前公网 IP，3 小时有效，期间续传不重复扣费。下载中断可使用已有链接继续。恢复原申请保留原到期时间。</p>{error && <p role="alert" className="text-danger-fg">{error}。重试本次申请不会重复扣费。</p>}</div></ModalBody>
      <ModalFooter><Button variant="secondary" disabled={busy} onClick={() => setQuote(null)}>取消</Button><Button variant="primary" loading={busy} onClick={() => void confirm()}>{quote?.charged_at ? '取回下载链接' : '确认扣费并下载'}</Button></ModalFooter>
    </Modal>
  </section>;
}
