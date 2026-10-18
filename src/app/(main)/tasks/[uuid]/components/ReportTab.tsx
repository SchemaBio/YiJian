'use client';
import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';
import { reportErrorText } from '@/i18n/task-labels';


import { ActionButton as Button, ActionButton } from '@/components/shared/ActionButton';

import { useInterpretationReadOnly } from './InterpretationLock';

import * as React from 'react';
import { Select, FormItem } from '@schema/ui-kit';
import { Tag } from '@/components/shared/Tag';
import { AppModal } from '@/components/shared';
import { CheckCircle2, FileText, Loader2 } from 'lucide-react';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';
import { RawResultDownloads } from './RawResultDownloads';
import { reportsApi, saveDownload, type ReportTemplate } from '@/lib/reports';

interface ReportTabProps {
  taskId: string;
}

export function ReportTab({ taskId }: ReportTabProps) {
  const t = useText();
  const readOnly = useInterpretationReadOnly();
  const requestIds=React.useRef<Record<string,string>>({});
 const [generations,setGenerations]=React.useState<Array<{id:string;state:string;createdAt:string;errorCode:string;contractVersion:string}>>([]);
 const [generationError, setGenerationError] = React.useState('');
 const [generationRetry, setGenerationRetry] = React.useState(0);
 React.useEffect(() => { requestIds.current = {}; setGenerations([]); }, [taskId]);
 React.useEffect(() => {
   let alive = true;
   setGenerationError('');
   reportsApi.listGenerations(taskId)
     .then(rows => { if (alive) setGenerations(rows); })
     .catch(() => { if (alive) setGenerationError(t("tasks.unableToReadReportGenerationHistoryf64368")); });
   return () => { alive = false; };
 }, [taskId, generationRetry]);
 const [templates, setTemplates] = React.useState<ReportTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [templateError, setTemplateError] = React.useState('');
  const [templateRetry, setTemplateRetry] = React.useState(0);
  const [selectedTemplate, setSelectedTemplate] = React.useState<string>('');
  const [generating, setGenerating] = React.useState(false);
  const [generationStage, setGenerationStage] = React.useState<'idle' | 'preparing' | 'calling' | 'downloading'>('idle');
  const [lastDownloadedFile, setLastDownloadedFile] = React.useState('');
  const [errorModalOpen, setErrorModalOpen] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');

  React.useEffect(() => {
    let ignore = false;

    async function loadTemplates() {
      setLoading(true);
      setTemplateError('');
      try {
        const tpls = await reportsApi.listTemplates();
        if (ignore) return;
        setTemplates(tpls);
      } catch (error) {
        if (ignore) return;
        setTemplates([]);
        setTemplateError(error instanceof Error ? errorText(error, t) : t("tasks.unableToLoadReportServicesRetryLaterfca497"));
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadTemplates();
    return () => {
      ignore = true;
    };
  }, [templateRetry]);

  const templateOptions = templates.map((template) => ({
    value: template.id,
    label: template.description ? `${template.name} - ${template.description}` : template.name,
  }));

  const handleGenerate = async () => {
    const template = templates.find((item) => item.id === selectedTemplate);
    if (!template) return;

    setGenerating(true);
    setGenerationStage('preparing');
    setLastDownloadedFile('');
    try {
 setGenerationStage('calling');
      const requestId=requestIds.current[template.id]??crypto.randomUUID();requestIds.current[template.id]=requestId;
 const download = await reportsApi.generateTaskReport(taskId, template,requestId);
 delete requestIds.current[template.id];
      setGenerationStage('downloading');
      saveDownload(download);
      setLastDownloadedFile(download.filename);
      setSelectedTemplate('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? errorText(error, t) : t("tasks.reportGenerationFailedRetryLater521edd", {p0: String(template.name)}));
      setErrorModalOpen(true);
    } finally {
      setGenerationRetry(value => value + 1);
 setGenerating(false);
      setGenerationStage('idle');
    }
  };

  return (
    <div className="grid w-full items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
      <div className="min-w-0"><RawResultDownloads taskId={taskId} /></div>
      <div className="min-w-0 space-y-5">

      <div className="rounded-xl border border-border-default bg-canvas-default p-5">
        <h4 className="text-sm font-medium text-fg-default mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          {t("tasks.generateInterpretationReportdd9bec")}</h4>
        <p className="mb-4 text-xs text-fg-muted">{t("tasks.reportSnapshotVFixesSelectedLociLatest5987ef")}</p>
        <div className="space-y-3">
          <div className="flex-1 min-w-0">
            <FormItem label={t("pipeline.reportServicea3ff41")}>
              <Select
                value={selectedTemplate}
                onChange={(value) => { if (typeof value === 'string') setSelectedTemplate(value); }}
                options={templateOptions}
                placeholder={loading ? t("tasks.loadingReportServices046fe0") : t("tasks.selectReportService345880")}
              />
            </FormItem>
          </div>
          <Button loading={generating} loadingLabel={t("tasks.generating26eab2")} action="start"
            variant="primary" className="w-full"

            onClick={handleGenerate}
            disabled={readOnly || loading || !selectedTemplate || generating || templates.length === 0}
          >
            {t("tasks.generateAndDownloadfcc355")}</Button>
        </div>
        {templateError && <div role="alert" className="mt-4 rounded-md border border-danger-muted bg-danger-subtle px-3 py-2 text-sm text-danger-fg">{templateError}<ActionButton permission={null} action="retry" variant="ghost" type="button" className="yj-tool-button ml-3" onClick={()=>setTemplateRetry(value=>value+1)}>{t("pipeline.retrye2d53a")}</ActionButton></div>}
        {generating && (
          <div className="mt-4 rounded-md border border-border bg-canvas-default px-3 py-2 text-sm text-fg-muted">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {generationStage === 'preparing' && t("tasks.preparingInterpretationSnapshot549793")}
              {generationStage === 'calling' && t("tasks.generatingReport8eed21")}
              {generationStage === 'downloading' && t("tasks.reportGeneratedDownloading430e77")}
            </div>
          </div>
        )}
        {!loading && !templateError && templates.length === 0 && (
          <div className="mt-4 text-center py-6 text-sm text-fg-muted border border-border rounded-lg">{t("tasks.noAvailableReportServicefd09e5")}</div>
        )}
        {lastDownloadedFile && (
          <div className="mt-3 flex items-center gap-2 text-sm text-success-fg">
            <CheckCircle2 className="w-4 h-4" />
            <span className="truncate">{t("tasks.downloaded24be9a")}{lastDownloadedFile}</span>
          </div>
        )}
      </div>

      {generationError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-danger-muted bg-danger-subtle px-4 py-3 text-sm text-danger-fg"><span>{generationError}</span><ActionButton permission={null} action="retry" variant="ghost" type="button" className="yj-tool-button" onClick={() => setGenerationRetry(value => value + 1)}>{t("tasks.reloadRecords5dc183")}</ActionButton></div>}
 {generations.length>0&&<div className="yj-panel p-4"><h4 className="mb-3 text-sm font-medium">{t("tasks.reportGenerationHistorye7923b")}</h4><div className="overflow-x-auto"><table className="w-full min-w-[440px] text-left text-sm"><thead className="text-xs text-fg-muted"><tr><th className="pb-2 font-medium">{t("tasks.time89b4aa")}</th><th className="pb-2 font-medium">{t("tasks.reportMethode5d5cd")}</th><th className="pb-2 font-medium">{t("admin.status62e951")}</th></tr></thead><tbody>{generations.map(g=><tr key={g.id} className="border-t border-border-subtle"><td className="py-3 pr-3 whitespace-nowrap">{new Date(g.createdAt).toLocaleString(t.locale, {hour12:false})}</td><td className="pr-3">{g.contractVersion==='report-snapshot-v2'?t("tasks.reportSnapshotca5ad0"):t("tasks.history19e0e3")}</td><td><Tag variant={g.state==='ready'?'success':g.state==='failed'?'danger':g.state==='generating'?'info':'neutral'}>{({ready:t("tasks.generated79c74f"),generating:t("tasks.generating57c08c"),failed:t("admin.failed3e3c80"),unknown:t("tasks.remoteResultNeedsVerificationb568ae"),pending:t("tasks.awaitingGeneration436346")} as Record<string,string>)[g.state]??g.state}</Tag>{g.errorCode&&<span className="ml-2 text-xs text-danger-fg">{reportErrorText(g.errorCode, t)}</span>}</td></tr>)}</tbody></table></div></div>}

      </div>

      <AppModal open={errorModalOpen} onOpenChange={setErrorModalOpen} title={t("tasks.reportGenerationFailed230636")} size="small" footer={<Button permission={null} variant="primary" onClick={() => setErrorModalOpen(false)}>{t("tasks.okf526c8")}</Button>}>
        <p role="alert" className="break-words text-sm text-danger-fg">{errorMessage}</p>
      </AppModal>
    </div>
  );
}

export function FilesTab(props: ReportTabProps) {
  const isSaaS = getRuntimeBackendFlavor() === 'squid';
  return <div className={`mx-auto w-full px-4 py-5 sm:px-6 ${isSaaS ? 'max-w-6xl' : 'max-w-7xl'}`}>{isSaaS ? <RawResultDownloads taskId={props.taskId} /> : <ReportTab {...props} />}</div>;
}
