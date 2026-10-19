'use client';
import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';
import { chineseText, type TextTranslator } from '@/i18n/text';

import { ActionButton as Button } from '@/components/shared/ActionButton';


import * as React from 'react';

import { AppModal } from '@/components/shared';
import { Download, FileArchive, HardDrive, Coins, Clock3, AlertTriangle } from 'lucide-react';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';
import { api } from '@/lib/api';
import { SelfHostedResultDownloads } from './SelfHostedResultDownloads';

interface DownloadFile { id: string; filename: string; size_bytes: number; credits: number; role?: string }
interface Catalog { bam_expires_at?: string; bam_retention_days?: number; bam_status?: string; attempt_id: string; zip_status: string; zip_error?: string; zip?: DownloadFile; bams: DownloadFile[]; missing: string[] }
interface Quote { id: string; kind: string; filename: string; size_bytes: number; credits: number; charged_at?: string; expires_at?: string }
interface Issued { kind?: string; id: string; url: string; filename: string; credits_charged: number; expires_at: string; grant_expires_at: string; refresh_after: string; remaining_issues: number; traffic_limit_bps: number; ip_bound: boolean }
const gb = (size: number, t: TextTranslator = chineseText) => `${(size / 1_000_000_000).toLocaleString(t.locale, { maximumFractionDigits: 3 })} GB`;
const labels: Record<string, string> = { mt_vcf: '线粒体 VCF', snp_indel: 'SNP/InDel 注释结果', mt: '线粒体注释结果', cnv_region: 'CNV 区域', cnv_gene: 'CNV 外显子', mei: 'MEI', upd: 'UPD', roh: 'ROH', qc_result: 'QC 报告', str: 'STR' };

export function RawResultDownloads({ taskId }: { taskId: string }) {
  return getRuntimeBackendFlavor() === 'squid' ? <ChargedResultDownloads taskId={taskId}/> : <SelfHostedResultDownloads taskId={taskId}/>;
}

function ChargedResultDownloads({ taskId }: { taskId: string }) {
  const t = useText();
  const isSaaS = getRuntimeBackendFlavor() === 'squid';
  const [catalog, setCatalog] = React.useState<Catalog | null>(null);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [quote, setQuote] = React.useState<Quote | null>(null);
  const [issued, setIssued] = React.useState<Issued | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [active, setActive] = React.useState<Quote[]>([]);
  const [now, setNow] = React.useState(Date.now);
  React.useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const polling = React.useRef(false);
  const generation = React.useRef(0);
  const catalogExpiry = React.useRef<number | null>(null);
  const base = `/v1/tasks/${encodeURIComponent(taskId)}/downloads`;
  const refreshIssued = async () => {
    if (!issued || busy) return;
    const current = generation.current;
    setBusy(true); setError('');
    try {
      const next = await api.post<Issued>(`${base}/issue`, { quote_id: issued.id });
      if (current === generation.current) { setIssued({ ...next, kind: issued.kind }); setCopied(false); setNow(Date.now()); }
    } catch (cause) { if (current === generation.current) setError(cause instanceof Error ? errorText(cause, t) : t("tasks.refreshFailedRetryTheSameRequestNode82c0")); }
    finally { if (current === generation.current) setBusy(false); }
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
        if (!disposed && generation.current === current) { setCatalog(next); catalogExpiry.current = next.bam_expires_at && !['expired', 'deleted', 'cleanup_pending'].includes(next.bam_status || '') ? Date.parse(next.bam_expires_at) : null; setError(''); polling.current = next.zip_status === 'building' || ['expired', 'cleanup_pending'].includes(next.bam_status || ''); }
      } catch (cause) {
        if (!disposed && generation.current === current) setError(cause instanceof Error ? errorText(cause, t) : t("tasks.unableToReadArchivedDownloadInformation35f3f4"));
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
      if (current === generation.current) setError(cause instanceof Error ? errorText(cause, t) : t("tasks.downloadRequestFailed4cec7b"));
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
    } catch (cause) {
      // Retain the quote: retrying this exact ID is billing-idempotent.
      if (current === generation.current) setError(t("tasks.retryTheSameRequestWithoutPayingAgain7889a5", {p0: String(cause instanceof Error ? errorText(cause, t) : t("display.requestOutcomeNotYetConfirmedf12ffd"))}));
    } finally { if (current === generation.current) setBusy(false); }
  };

  const preparing = catalog?.zip_status === 'building';
  const zipReady = catalog?.zip_status === 'ready';
  const linkExpired = !!issued && Date.parse(issued.expires_at) <= now;
  const grantExpired = !!issued && Date.parse(issued.grant_expires_at) <= now;
  const refreshSeconds = issued ? Math.max(0, Math.ceil((Date.parse(issued.refresh_after) - now) / 1000)) : 0;
  return <section className="space-y-4" aria-label={t("tasks.archivedFileDownloadse08d1b")}>
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h3 className="text-base font-semibold text-fg-default">{t("tasks.downloadArchivedFiles21d22a")}</h3><p className="mt-1 text-xs text-fg-muted">{t("tasks.reviewTheCostBeforeConfirmingALinkc7e48c")}</p></div>
      <span className="inline-flex items-center gap-1 rounded-full bg-accent-subtle px-3 py-1 text-xs text-accent-fg"><Clock3 className="h-3 w-3"/>{t("tasks.requestValidUpToHoursFreeLink08bdf4")}</span>
    </div>
    <div className="grid gap-4 xl:grid-cols-2">
      <article className="flex flex-col rounded-xl border border-border-default bg-canvas-default p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3"><div className="rounded-lg bg-accent-subtle p-2.5 text-accent-fg"><FileArchive className="h-5 w-5"/></div><div><h4 className="font-semibold">{t("tasks.rawResultsZip7e2a74")}</h4><p className="mt-0.5 text-xs text-fg-muted">{t("tasks.vcfAndOriginalAnalysisReports6bb2b7")}</p></div></div>
          <div className="shrink-0 text-right"><p className="text-xl font-semibold text-accent-fg">1 <span className="text-xs font-normal">{t("pipeline.creditsb3e265")}</span></p><p className="text-[11px] text-fg-muted">{t("tasks.perNewRequestf7fbd7")}</p></div>
        </div>
        <div className="flex-1 text-sm leading-6 text-fg-muted"><p>{t("tasks.snpIndelVcfMitochondrialVcfAndIndexes18dd5a")}</p><p className="mt-2 text-xs">{t("tasks.onlyArchivedFilesFromThisExecutionExcludesb58697")}</p></div>
        {!!catalog?.missing.length && <details className="mt-3 rounded-md bg-canvas-subtle p-2.5 text-xs text-fg-muted"><summary className="cursor-pointer font-medium">{t("tasks.viewOmittedOutputs8b837d")}{catalog.missing.length} {t("tasks.items00cb6d")}</summary><ul className="mt-2 space-y-1 leading-5">{catalog.missing.map(item=><li key={item}>{item.replace(/^[a-z_]+/,key=>labels[key]||key)}</li>)}</ul></details>}
        {catalog?.zip_error&&<p role="alert" className="mt-3 text-xs text-danger-fg">{catalog.zip_error}</p>}
        <div className="mt-5 border-t border-border-subtle pt-4">
          <Button action="download" variant="primary" className="w-full shrink-0 whitespace-nowrap"  disabled={busy||!catalog||preparing} onClick={()=>void request('zip')}>
            {!catalog?t("tasks.readingDownloadInformationb590b7"):preparing?t("tasks.preparingZipeca113"):zipReady?t("tasks.downloadOriginalZipCredit11f74e"):t("tasks.prepareOriginalZipFreea89213")}
          </Button>
          <p className="mt-2 text-center text-xs text-fg-muted">{zipReady?t("tasks.confirmTheCostNextCreditIsCharged03a0cd"):t("tasks.confirmDownloadAfterPackagingFinishesPreparationIsd4568e")}</p>
        </div>
      </article>
      {catalog?.bam_status !== 'not_provided' && <article className="flex flex-col rounded-xl border border-border-default bg-canvas-default p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3"><div className="rounded-lg bg-canvas-subtle p-2.5 text-accent-fg"><HardDrive className="h-5 w-5"/></div><div><h4 className="font-semibold">{t("tasks.deduplicatedBambf8124")}</h4><p className="mt-0.5 text-xs text-fg-muted">{t("tasks.requestObjectStorageDownloadLink3c0ebb")}</p></div></div>
          <div className="shrink-0 text-right"><p className="text-xl font-semibold text-accent-fg">1 <span className="text-xs font-normal">{t("tasks.creditsGba435e1")}</span></p><p className="text-[11px] text-fg-muted">{t("tasks.roundedUp7a59c9")}</p></div>
        </div>
        <div className="mb-3 rounded-lg bg-canvas-subtle p-3 text-xs leading-5 text-fg-muted"><p className="font-medium text-fg-default">{t("tasks.costFileBytesRoundedUp72498f")}</p><p>{t("tasks.forExampleGbCostsCreditsTheServer5c5898")}</p></div>
        <div className="flex-1 space-y-3">
          {catalog?.bam_expires_at && <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">{t("tasks.bamRetentionEnds10438f")}{new Date(catalog.bam_expires_at).toLocaleString(t.locale)}{t("tasks.daysAfterTaskCompletiona94b1b")}</p>}
          {catalog?.bams.map(file=><div key={file.id} className="rounded-lg border border-border-default p-3">
            <p className="break-all text-sm font-medium">{file.role&&<span className="mr-2 rounded bg-accent-subtle px-1.5 py-0.5 text-xs text-accent-fg">{file.role}</span>}{file.filename}</p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-fg-default">{gb(file.size_bytes, t)} <span className="ml-2 font-semibold text-accent-fg">{file.credits} {t("billing.creditse6d317")}</span></p><p className="mt-0.5 text-[11px] text-fg-muted">{file.size_bytes.toLocaleString(t.locale)} {t("tasks.bytes4641f3")}</p></div><Button action="download" variant="primary" size="small" className="shrink-0 whitespace-nowrap"  disabled={busy} onClick={()=>void request('bam',file)}>{t("tasks.requestBamLink382f61")}</Button></div>
          </div>)}
          {catalog&&!catalog.bams.length&&<p className="rounded-lg bg-canvas-subtle p-4 text-sm text-fg-muted">{catalog.bam_status === 'deleted' ? t("tasks.expiredBamAndIndexFilesHaveBeen23c958") : ['expired', 'cleanup_pending'].includes(catalog.bam_status || '') ? t("tasks.bamRetentionExpiredDownloadingAndReadReview397612") : t("tasks.noDownloadableBamArchivedForThisExecution0a8b70")}</p>}
          {!catalog&&<p className="text-sm text-fg-muted">{t("tasks.readingBamFilesAndSizes7280da")}</p>}
        </div>
        <p className="mt-4 text-xs leading-5 text-fg-muted">{t("tasks.downloadDirectlyFromObjectStorageWithoutIpae48b2")}</p>
      </article>}
    </div>
    {isSaaS&&catalog?.bam_status !== 'not_provided'&&<div role="note" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/><p><strong>{t("tasks.bamRetainedForDays9f64b9")}</strong>{t("tasks.bamIsDeletedDaysAfterCompletionDisabling86a6fc")}</p></div>}
    <div className="flex items-start gap-2 rounded-lg bg-canvas-subtle px-4 py-3 text-xs leading-5 text-fg-muted"><Coins className="mt-0.5 h-4 w-4 shrink-0"/><p><strong className="text-fg-default">{t("tasks.chargeTiming232cba")}</strong>{t("tasks.confirmationChargesAndIssuesTheLinkCanceling9df320")}</p></div>
    {error&&<p role="alert" className="rounded-lg border border-danger-muted bg-danger-subtle p-3 text-sm text-danger-fg">{error}</p>}
    {issued&&<div role="status" className="rounded-xl border border-success-muted bg-success-subtle p-4">
      <p className="break-all text-sm font-medium">{t("tasks.downloadLinkReady4c818d")}{issued.filename}</p>
      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-fg-muted"><span>{t("tasks.requestCost396221")}{issued.credits_charged} {t("billing.creditse6d317")}</span><span>{t("tasks.linkExpiresf23884")}{new Date(issued.expires_at).toLocaleString(t.locale)}</span><span>{t("tasks.requestDeadline3d4137")}{new Date(issued.grant_expires_at).toLocaleString(t.locale)}</span><span>{t("tasks.perRequestRateLimit41dbdf")}{issued.traffic_limit_bps / 8 / 1024 / 1024} {t("tasks.mibSRemainingLinkIssuances846a23")}{issued.remaining_issues} {t("tasks.label793578")}</span></div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!linkExpired && !grantExpired ? <a href={issued.url} download={issued.filename} rel="noreferrer noopener" className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md bg-accent-emphasis px-3 text-sm text-fg-on-emphasis"><Download className="h-4 w-4"/>{t("tasks.downloadResume94a53a")}</a> : <span className="text-sm">{grantExpired ? t("tasks.requestExpired7b97fe") : t("tasks.linkExpiredRefreshFree826119")}</span>}
        <Button action="copy" size="small" variant="secondary" disabled={linkExpired || grantExpired} className="whitespace-nowrap"  onClick={()=>{void navigator.clipboard.writeText(issued.url).then(()=>setCopied(true)).catch(()=>setError(t("tasks.copyFailedAllowClipboardAccesscdac42")));}}>{copied?t("tasks.linkCopiedc66304"):t("tasks.copyDownloadLink79a65e")}</Button>
        <Button size="small" variant="secondary" disabled={busy || grantExpired || refreshSeconds > 0 || issued.remaining_issues <= 0} onClick={()=>void refreshIssued()}>{refreshSeconds > 0 ? t("tasks.refreshAvailableInSecondscffaf7", {p0: String(refreshSeconds)}) : t("tasks.refreshLinkFree0912d2")}</Button>
        <span className="text-xs text-fg-muted">{t("tasks.refreshDoesNotExtendRequestValidityResume92d40a")}</span>
      </div>
    </div>}
    {!!active.length&&<details className="rounded-lg border border-border-default p-3 text-sm"><summary className="cursor-pointer font-medium">{t("tasks.existingRequestRetrievingAPaidLinkIncurs83fe7c")}</summary><div className="mt-3 space-y-2">{active.map(item=><div className="flex flex-wrap items-center justify-between gap-2 rounded bg-canvas-subtle p-2.5" key={item.id}><span className="min-w-0 break-all text-xs">{item.filename}</span><Button size="small" variant="secondary" className="shrink-0 whitespace-nowrap" disabled={busy} onClick={()=>{setError('');setCopied(false);setQuote(item);}}>{item.charged_at?t("tasks.retrievePaidLink2b6fc5"):t("tasks.continueOriginalRequest6993b2")}</Button></div>)}</div></details>}
    <AppModal open={!!quote} onOpenChange={open=>{if(!open&&!busy)setQuote(null);}} title={quote?.charged_at?t("tasks.retrieveExistingDownloadLink7e9525"):t("tasks.confirmDownloadCost458ee4")} size="small" closeOnEscape={!busy} closeOnOverlayClick={!busy}
      footer={<><Button variant="secondary" disabled={busy} onClick={()=>setQuote(null)}>{t("admin.cancel4d0b46")}</Button><Button permission={null} variant="primary" className="whitespace-nowrap" loading={busy} onClick={()=>void confirm()}>{quote?.charged_at?t("tasks.retrieveDownloadLinked0404"):quote?.kind==='bam'?t("tasks.payCreditsAndGetLink7efa0c", {p0: String(quote?.credits)}):t("tasks.payCreditAndGetZipLink07d19b")}</Button></>}
    >
      <div className="space-y-4 text-sm"><p className="break-all font-medium">{quote?.filename}</p><div className="flex items-center justify-between rounded-lg bg-canvas-subtle p-4"><span>{quote&&gb(quote.size_bytes, t)}</span><strong className="text-xl text-accent-fg">{quote?.charged_at?t("tasks.noDuplicateCharge10d341"):t("pipeline.credits0193ac", {p0: String(quote?.credits)})}</strong></div>{quote?.kind==='bam'&&<p className="text-xs text-fg-muted">{t("tasks.actualSize937f87")}{quote.size_bytes.toLocaleString(t.locale)} {t("tasks.bytesCreditPerGbRoundedUpb20477")}</p>}<p className="text-xs leading-5 text-fg-muted">{quote?.charged_at?t("tasks.originalRequestAlreadyPaidRetrievalKeepsIts88513c"):t("tasks.chargeAndLinkIssuanceFollowConfirmationCanceling5ac9ae")}{t("tasks.noIpBindingLinksCanBeRefreshedc75142")}</p>{error&&<p role="alert" className="text-danger-fg">{error}{t("tasks.retryingThisRequestIncursNoDuplicateChargee75379")}</p>}</div>
    </AppModal>
  </section>;
}
