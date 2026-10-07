'use client';

import * as React from 'react';
import { Button, Modal, ModalHeader, ModalBody, ModalFooter } from '@schema/ui-kit';
import { Download, FileArchive, Loader2, HardDrive, Coins, Clock3, Copy, AlertTriangle } from 'lucide-react';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';
import { api } from '@/lib/api';

interface DownloadFile { id: string; filename: string; size_bytes: number; credits: number; role?: string }
interface Catalog { bam_expires_at?: string; bam_retention_days?: number; bam_status?: string; attempt_id: string; zip_status: string; zip_error?: string; zip?: DownloadFile; bams: DownloadFile[]; missing: string[] }
interface Quote { id: string; kind: string; filename: string; size_bytes: number; credits: number; charged_at?: string; expires_at?: string }
interface Issued { kind?: string; id: string; url: string; filename: string; credits_charged: number; expires_at: string; ip_bound: boolean }
const gb = (size: number) => `${(size / 1_000_000_000).toLocaleString('zh-CN', { maximumFractionDigits: 3 })} GB`;
const labels: Record<string, string> = { mt_vcf: '线粒体 VCF', snp_indel: 'SNP/InDel 报告', mt: '线粒体报告', cnv_region: 'CNV 区域', cnv_gene: 'CNV 外显子', mei: 'MEI', upd: 'UPD', roh: 'ROH', qc_result: 'QC 报告', str: 'STR' };

export function RawResultDownloads({ taskId }: { taskId: string }) {
  const isSaaS = getRuntimeBackendFlavor() === 'squid';
  const [catalog, setCatalog] = React.useState<Catalog | null>(null);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [quote, setQuote] = React.useState<Quote | null>(null);
  const [issued, setIssued] = React.useState<Issued | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [active, setActive] = React.useState<Quote[]>([]);
  const polling = React.useRef(false);
  const generation = React.useRef(0);
  const catalogExpiry = React.useRef<number | null>(null);
  const base = `/v1/tasks/${encodeURIComponent(taskId)}/downloads`;
  const downloadZIP = async (grant: Issued) => {
    // Use the application's authenticated transport, including session refresh.
    // Only this task's paid grant can be used; no external response URL is fetched.
    const result = await api.download(`${base}/${encodeURIComponent(grant.id)}/file`, undefined, { method: 'GET', fallbackFilename: grant.filename });
    const url = URL.createObjectURL(result.blob);
    const link = document.createElement('a');
    link.href = url; link.download = grant.filename;
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
  const retryZIP = async () => {
    if (!issued || busy) return;
    setBusy(true); setError('');
    try { await downloadZIP(issued); }
    catch (cause) { setError(`${cause instanceof Error ? cause.message : 'ZIP 下载失败'}。请重试本申请，不要重新支付。`); }
    finally { setBusy(false); }
  };
  React.useEffect(() => {
    const current = ++generation.current;
    let disposed = false;
    let pending = false;
    setCatalog(null); setQuote(null); setIssued(null); setActive([]); setError(''); setBusy(false); polling.current = false; catalogExpiry.current = null;
    const load = async () => {
      if (pending) return; pending = true;
      try {
        const next = await api.get<Catalog>(base);
        if (!disposed && generation.current === current) { setCatalog(next); setIssued(previous => previous?.kind === 'bam' && Date.parse(previous.expires_at) <= Date.now() ? null : previous); catalogExpiry.current = next.bam_expires_at && !['expired', 'deleted', 'cleanup_pending'].includes(next.bam_status || '') ? Date.parse(next.bam_expires_at) : null; setError(''); polling.current = next.zip_status === 'building' || ['expired', 'cleanup_pending'].includes(next.bam_status || ''); }
      } catch (cause) {
        if (!disposed && generation.current === current) setError(cause instanceof Error ? cause.message : '无法读取归档下载信息');
      } finally { pending = false; }
    };
    void load();
    void api.get<Quote[]>(`${base}/active`).then(rows => { if (!disposed) setActive(rows); }).catch(() => {});
    const timer = window.setInterval(() => { if (!disposed && (polling.current || (catalogExpiry.current !== null && Date.now() >= catalogExpiry.current))) void load(); }, 5000);
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
      setIssued({...next, kind: quote.kind}); setQuote(null);
      void api.get<Quote[]>(`${base}/active`).then(rows => {if(current === generation.current)setActive(rows);}).catch(() => {});
      if (quote.kind === 'zip') {
        await downloadZIP(next);
      }
    } catch (cause) {
      // Retain the quote: retrying this exact ID is billing-idempotent.
      if (current === generation.current) setError(`${cause instanceof Error ? cause.message : '申请结果暂未确认'}。请重试同一申请，不要重新支付。`);
    } finally { if (current === generation.current) setBusy(false); }
  };

  const preparing = catalog?.zip_status === 'building';
  const zipReady = catalog?.zip_status === 'ready';
  return <section className="space-y-4" aria-label="归档文件下载">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h3 className="text-base font-semibold text-fg-default">下载归档文件</h3><p className="mt-1 text-xs text-fg-muted">先查看费用，再确认领取链接。准备 ZIP 和查看文件大小均不扣费。</p></div>
      <span className="inline-flex items-center gap-1 rounded-full bg-accent-subtle px-3 py-1 text-xs text-accent-fg"><Clock3 className="h-3 w-3"/>链接最长 3 小时 · 同 IP 可续传</span>
    </div>
    <div className="grid gap-4 xl:grid-cols-2">
      <article className="flex flex-col rounded-xl border border-border-default bg-canvas-default p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3"><div className="rounded-lg bg-accent-subtle p-2.5 text-accent-fg"><FileArchive className="h-5 w-5"/></div><div><h4 className="font-semibold">原始结果 ZIP</h4><p className="mt-0.5 text-xs text-fg-muted">VCF 与原始分析报告</p></div></div>
          <div className="shrink-0 text-right"><p className="text-xl font-semibold text-accent-fg">1 <span className="text-xs font-normal">积分</span></p><p className="text-[11px] text-fg-muted">每次新申请</p></div>
        </div>
        <div className="flex-1 text-sm leading-6 text-fg-muted"><p>SNP/InDel VCF、线粒体原始 VCF 及索引，CNV Region / Exon、MEI、UPD、ROH、STR 和 QC 报告。</p><p className="mt-2 text-xs">仅包含本次执行已归档的文件，不含 BAM 或人工判读修改。</p></div>
        {!!catalog?.missing.length && <details className="mt-3 rounded-md bg-canvas-subtle p-2.5 text-xs text-fg-muted"><summary className="cursor-pointer font-medium">查看未包含的输出（{catalog.missing.length} 项）</summary><ul className="mt-2 space-y-1 leading-5">{catalog.missing.map(item=><li key={item}>{item.replace(/^[a-z_]+/,key=>labels[key]||key)}</li>)}</ul></details>}
        {catalog?.zip_error&&<p role="alert" className="mt-3 text-xs text-danger-fg">{catalog.zip_error}</p>}
        <div className="mt-5 border-t border-border-subtle pt-4">
          <Button variant="primary" className="w-full shrink-0 whitespace-nowrap" leftIcon={preparing?<Loader2 className="h-4 w-4 animate-spin"/>:<Download className="h-4 w-4"/>} disabled={busy||!catalog||preparing} onClick={()=>void request('zip')}>
            {!catalog?'读取下载信息…':preparing?'正在准备 ZIP':zipReady?'下载原始 ZIP · 1 积分':'准备原始 ZIP · 免费'}
          </Button>
          <p className="mt-2 text-center text-xs text-fg-muted">{zipReady?'下一步确认费用，确认后扣 1 积分并下载。':'打包完成后再确认下载，准备阶段不扣费。'}</p>
        </div>
      </article>
      <article className="flex flex-col rounded-xl border border-border-default bg-canvas-default p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3"><div className="rounded-lg bg-canvas-subtle p-2.5 text-accent-fg"><HardDrive className="h-5 w-5"/></div><div><h4 className="font-semibold">去重 BAM</h4><p className="mt-0.5 text-xs text-fg-muted">申请对象存储下载链接</p></div></div>
          <div className="shrink-0 text-right"><p className="text-xl font-semibold text-accent-fg">1 <span className="text-xs font-normal">积分 / GB</span></p><p className="text-[11px] text-fg-muted">向上取整</p></div>
        </div>
        <div className="mb-3 rounded-lg bg-canvas-subtle p-3 text-xs leading-5 text-fg-muted"><p className="font-medium text-fg-default">费用 = 文件字节数 ÷ 1,000,000,000，向上取整</p><p>例如 2.1 GB 收取 3 积分。确认前服务器会重新核对实际大小；每次新申请单独计费。</p></div>
        <div className="flex-1 space-y-3">
          {catalog?.bam_expires_at && <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">BAM 保留截止：{new Date(catalog.bam_expires_at).toLocaleString('zh-CN')}（任务完成后 7 天）</p>}
          {catalog?.bams.map(file=><div key={file.id} className="rounded-lg border border-border-default p-3">
            <p className="break-all text-sm font-medium">{file.role&&<span className="mr-2 rounded bg-accent-subtle px-1.5 py-0.5 text-xs text-accent-fg">{file.role}</span>}{file.filename}</p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-fg-default">{gb(file.size_bytes)} <span className="ml-2 font-semibold text-accent-fg">{file.credits} 积分</span></p><p className="mt-0.5 text-[11px] text-fg-muted">{file.size_bytes.toLocaleString('zh-CN')} 字节</p></div><Button variant="primary" size="small" className="shrink-0 whitespace-nowrap" leftIcon={<Download className="h-3.5 w-3.5"/>} disabled={busy} onClick={()=>void request('bam',file)}>申请 BAM 链接</Button></div>
          </div>)}
          {catalog&&!catalog.bams.length&&<p className="rounded-lg bg-canvas-subtle p-4 text-sm text-fg-muted">{catalog.bam_status === 'deleted' ? 'BAM 及索引已完成到期清理。' : ['expired', 'cleanup_pending'].includes(catalog.bam_status || '') ? 'BAM 保留期已到，下载与 reads 复核已关闭，存储清理正在处理中。' : '当前执行未归档可下载的 BAM。'}</p>}
          {!catalog&&<p className="text-sm text-fg-muted">正在读取 BAM 文件与大小…</p>}
        </div>
        <p className="mt-4 text-xs leading-5 text-fg-muted">链接绑定申请时的公网 IP。最长 3 小时内可续传，且不超过 BAM 保留期；更换网络或出口 IP 后无法使用该链接。</p>
      </article>
    </div>
    {isSaaS&&<div role="note" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/><p><strong>BAM 保留 7 天：</strong>任务完成 7 天后自动删除，届时无法下载 BAM，也无法使用 IGV 复核样本 reads。请及时下载并自行备份；已保存的判读记录不受影响。</p></div>}
    <div className="flex items-start gap-2 rounded-lg bg-canvas-subtle px-4 py-3 text-xs leading-5 text-fg-muted"><Coins className="mt-0.5 h-4 w-4 shrink-0"/><p><strong className="text-fg-default">扣费时点：</strong>点击确认后扣费并签发链接。取消确认不扣费；复制、续传或取回同一笔已付费申请不重复扣费；另建下载申请会再次计费。</p></div>
    {error&&<p role="alert" className="rounded-lg border border-danger-muted bg-danger-subtle p-3 text-sm text-danger-fg">{error}</p>}
    {issued&&<div role="status" className="rounded-xl border border-success-muted bg-success-subtle p-4">
      <p className="break-all text-sm font-medium">下载链接已就绪 · {issued.filename}</p>
      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-fg-muted"><span>本申请费用：{issued.credits_charged} 积分</span><span>到期：{new Date(issued.expires_at).toLocaleString('zh-CN')}</span><span>绑定申请 IP</span></div>
      <div className="mt-3 flex flex-wrap items-center gap-2">{issued.kind === 'zip' ? <Button size="small" variant="primary" className="whitespace-nowrap" loading={busy} leftIcon={<Download className="h-4 w-4"/>} onClick={()=>void retryZIP()}>下载 ZIP / 重试（不重复扣费）</Button> : <><a href={issued.url} download={issued.filename} rel="noreferrer noopener" className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md bg-accent-emphasis px-3 text-sm text-fg-on-emphasis"><Download className="h-4 w-4"/>开始下载 / 续传</a><Button size="small" variant="secondary" className="whitespace-nowrap" leftIcon={<Copy className="h-3.5 w-3.5"/>} onClick={()=>{void navigator.clipboard.writeText(issued.url).then(()=>setCopied(true)).catch(()=>setError('复制失败，请允许浏览器访问剪贴板'));}}>{copied?'已复制链接':'复制下载链接'}</Button></>}<span className="text-xs text-fg-muted">使用此链接不重复扣费。</span></div>
    </div>}
    {!!active.length&&<details className="rounded-lg border border-border-default p-3 text-sm"><summary className="cursor-pointer font-medium">已有下载申请 · 取回已付费链接不重复扣费</summary><div className="mt-3 space-y-2">{active.map(item=><div className="flex flex-wrap items-center justify-between gap-2 rounded bg-canvas-subtle p-2.5" key={item.id}><span className="min-w-0 break-all text-xs">{item.filename}</span><Button size="small" variant="secondary" className="shrink-0 whitespace-nowrap" disabled={busy} onClick={()=>{setError('');setCopied(false);setQuote(item);}}>{item.charged_at?'取回已付费链接':'继续原申请'}</Button></div>)}</div></details>}
    <Modal open={!!quote} onOpenChange={open=>{if(!open&&!busy)setQuote(null);}}>
      <ModalHeader>{quote?.charged_at?'取回已有下载链接':'确认下载费用'}</ModalHeader>
      <ModalBody><div className="space-y-4 text-sm"><p className="break-all font-medium">{quote?.filename}</p><div className="flex items-center justify-between rounded-lg bg-canvas-subtle p-4"><span>{quote&&gb(quote.size_bytes)}</span><strong className="text-xl text-accent-fg">{quote?.charged_at?'不重复扣费':`${quote?.credits} 积分`}</strong></div>{quote?.kind==='bam'&&<p className="text-xs text-fg-muted">实际大小 {quote.size_bytes.toLocaleString('zh-CN')} 字节；每 GB 1 积分，向上取整。</p>}<p className="text-xs leading-5 text-fg-muted">{quote?.charged_at?'原申请已支付，取回保留原到期时间。':'确认后才扣费并签发链接；取消不扣费。'}链接绑定当前公网 IP，3 小时内可续传，同一申请不重复扣费。</p>{error&&<p role="alert" className="text-danger-fg">{error}。重试本次申请不会重复扣费。</p>}</div></ModalBody>
      <ModalFooter><Button variant="secondary" disabled={busy} onClick={()=>setQuote(null)}>取消</Button><Button variant="primary" className="whitespace-nowrap" loading={busy} onClick={()=>void confirm()}>{quote?.charged_at?'取回下载链接':quote?.kind==='bam'?`支付 ${quote?.credits} 积分并获取链接`:'支付 1 积分并下载 ZIP'}</Button></ModalFooter>
    </Modal>
  </section>;
}
