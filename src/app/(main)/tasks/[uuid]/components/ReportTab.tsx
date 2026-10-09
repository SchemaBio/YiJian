'use client';
import { useInterpretationReadOnly } from './InterpretationLock';

import * as React from 'react';
import { Button, Select, FormItem, Tag } from '@schema/ui-kit';
import { AppModal } from '@/components/shared';
import {
  CheckCircle2,
  FileText,
  Loader2,
  Play,
} from 'lucide-react';
import { RawResultDownloads } from './RawResultDownloads';
import { reportsApi, saveDownload, type ReportTemplate } from '@/lib/reports';

interface ReportTabProps {
  taskId: string;
}

export function ReportTab({ taskId }: ReportTabProps) {
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
     .catch(() => { if (alive) setGenerationError('报告生成记录读取失败'); });
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
        setTemplateError(error instanceof Error ? error.message : '报告服务加载失败，请稍后重试。');
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
      if(template.contractVersion!=='report-snapshot-v2'){
 let packageState = await reportsApi.prepareTaskResultPackage(taskId);
      const deadline = Date.now() + 5 * 60 * 1000;
      while (packageState.status !== 'ready') {
        if (packageState.status === 'failed') {
          throw new Error(packageState.error || '结果包生成失败，请重试。');
        }
        if (Date.now() >= deadline) {
          throw new Error('结果包准备超时，请稍后重试。');
        }
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
        packageState = await reportsApi.getTaskResultPackage(taskId);
      }
      }
 setGenerationStage('calling');
      const requestId=requestIds.current[template.id]??crypto.randomUUID();requestIds.current[template.id]=requestId;
 const download = await reportsApi.generateTaskReport(taskId, template,requestId);
 delete requestIds.current[template.id];
      setGenerationStage('downloading');
      saveDownload(download);
      setLastDownloadedFile(download.filename);
      setSelectedTemplate('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : `报告 "${template.name}" 生成失败，请稍后重试。`);
      setErrorModalOpen(true);
    } finally {
      setGenerationRetry(value => value + 1);
 setGenerating(false);
      setGenerationStage('idle');
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <RawResultDownloads taskId={taskId} />
      {generationError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-danger-muted bg-danger-subtle px-4 py-3 text-sm text-danger-fg"><span>{generationError}</span><button type="button" className="yj-tool-button" onClick={() => setGenerationRetry(value => value + 1)}>重试读取记录</button></div>}
 {generations.length>0&&<div className="yj-panel p-4"><h4 className="mb-3 text-sm font-medium">报告生成记录</h4><div className="overflow-x-auto"><table className="w-full min-w-[440px] text-left text-sm"><thead className="text-xs text-fg-muted"><tr><th className="pb-2 font-medium">时间</th><th className="pb-2 font-medium">报告方式</th><th className="pb-2 font-medium">状态</th></tr></thead><tbody>{generations.map(g=><tr key={g.id} className="border-t border-border-subtle"><td className="py-3 pr-3 whitespace-nowrap">{new Date(g.createdAt).toLocaleString('zh-CN', {hour12:false})}</td><td className="pr-3">{g.contractVersion==='report-snapshot-v2'?'回报快照':g.contractVersion==='legacy-v1'?'原始结果包':g.contractVersion}</td><td><Tag variant={g.state==='ready'?'success':g.state==='failed'?'danger':g.state==='generating'?'info':'neutral'}>{({ready:'已生成',generating:'生成中',failed:'失败',unknown:'远端结果待核对',pending:'等待生成'} as Record<string,string>)[g.state]??g.state}</Tag>{g.errorCode&&<span className="ml-2 text-xs text-danger-fg">{g.errorCode}</span>}</td></tr>)}</tbody></table></div></div>}

      <div className="rounded-xl border border-border-default bg-canvas-default p-5">
        <h4 className="text-sm font-medium text-fg-default mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          判读报告生成
        </h4>
        <p className="mb-4 text-xs text-fg-muted">回报快照 v2 将已选入回报的位点、最新人工判读与质控固定为本次报告版本。旧版服务仅接收原始结果包。</p>
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1 min-w-0">
            <FormItem label="报告服务">
              <Select
                value={selectedTemplate}
                onChange={(value) => { if (typeof value === 'string') setSelectedTemplate(value); }}
                options={templateOptions}
                placeholder={loading ? "正在加载报告服务..." : "请选择报告服务..."}
              />
            </FormItem>
          </div>
          <Button
            variant="primary"
            leftIcon={generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            onClick={handleGenerate}
            disabled={readOnly || loading || !selectedTemplate || generating || templates.length === 0}
          >
            {generating ? '生成中...' : '生成并下载'}
          </Button>
        </div>
        {templateError && <div role="alert" className="mt-4 rounded-md border border-danger-muted bg-danger-subtle px-3 py-2 text-sm text-danger-fg">{templateError}<button type="button" className="yj-tool-button ml-3" onClick={()=>setTemplateRetry(value=>value+1)}>重试</button></div>}
        {generating && (
          <div className="mt-4 rounded-md border border-border bg-canvas-default px-3 py-2 text-sm text-fg-muted">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {generationStage === 'preparing' && '正在准备完整结果包（首次请求会生成并缓存 ZIP）...'}
              {generationStage === 'calling' && '正在生成报告...'}
              {generationStage === 'downloading' && '报告已生成，正在下载...'}
            </div>
          </div>
        )}
        {!loading && !templateError && templates.length === 0 && (
          <div className="mt-4 text-center py-6 text-sm text-fg-muted border border-border rounded-lg">暂无可用报告服务</div>
        )}
        {lastDownloadedFile && (
          <div className="mt-3 flex items-center gap-2 text-sm text-success-fg">
            <CheckCircle2 className="w-4 h-4" />
            <span className="truncate">已下载：{lastDownloadedFile}</span>
          </div>
        )}
      </div>

      <AppModal open={errorModalOpen} onOpenChange={setErrorModalOpen} title="报告生成失败" size="small" footer={<Button variant="primary" onClick={() => setErrorModalOpen(false)}>确定</Button>}>
        <p role="alert" className="break-words text-sm text-danger-fg">{errorMessage}</p>
      </AppModal>
    </div>
  );
}
