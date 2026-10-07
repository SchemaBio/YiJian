'use client';

import * as React from 'react';
import { Button, Select, FormItem, Modal, ModalHeader, ModalBody, ModalFooter } from '@schema/ui-kit';
import {
  AlertCircle,
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
  const requestIds=React.useRef<Record<string,string>>({});
 const [generations,setGenerations]=React.useState<Array<{id:string;state:string;createdAt:string;errorCode:string;contractVersion:string}>>([]);
 React.useEffect(()=>{let alive=true;reportsApi.listGenerations(taskId).then(rows=>{if(alive)setGenerations(rows)}).catch(()=>{});return()=>{alive=false;requestIds.current={}}},[taskId]);
 const [templates, setTemplates] = React.useState<ReportTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);
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
      try {
        const tpls = await reportsApi.listTemplates();
        if (ignore) return;
        setTemplates(tpls);
      } catch (error) {
        if (ignore) return;
        setErrorMessage(error instanceof Error ? error.message : '报告服务加载失败，请稍后重试。');
        setErrorModalOpen(true);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadTemplates();
    return () => {
      ignore = true;
    };
  }, []);

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
 delete requestIds.current[template.id];setGenerations(await reportsApi.listGenerations(taskId));
      setGenerationStage('downloading');
      saveDownload(download);
      setLastDownloadedFile(download.filename);
      setSelectedTemplate('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : `报告 "${template.name}" 生成失败，请稍后重试。`);
      setErrorModalOpen(true);
    } finally {
      reportsApi.listGenerations(taskId).then(setGenerations).catch(()=>{});
 setGenerating(false);
      setGenerationStage('idle');
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <RawResultDownloads taskId={taskId} />
 {generations.length>0&&<div className="rounded-lg border border-border-default bg-canvas-default p-4"><h4 className="mb-2 text-sm font-medium">报告生成记录</h4><table className="w-full text-left text-xs"><thead><tr><th>时间</th><th>协议</th><th>状态</th></tr></thead><tbody>{generations.map(g=><tr key={g.id}><td className="py-2">{new Date(g.createdAt).toLocaleString()}</td><td>{g.contractVersion}</td><td>{({ready:'已生成',generating:'生成中',failed:'失败',unknown:'远端结果待核对',pending:'等待生成'} as Record<string,string>)[g.state]??g.state}{g.errorCode&&` · ${g.errorCode}`}</td></tr>)}</tbody></table></div>}

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
            disabled={loading || !selectedTemplate || generating || templates.length === 0}
          >
            {generating ? '生成中...' : '生成并下载'}
          </Button>
        </div>
        {generating && (
          <div className="mt-4 rounded-md border border-border bg-canvas-default px-3 py-2 text-sm text-fg-muted">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {generationStage === 'preparing' && '正在准备完整结果包（首次请求会生成并缓存 ZIP）...'}
              {generationStage === 'calling' && '结果包已就绪，正在调用报告服务...'}
              {generationStage === 'downloading' && '报告已生成，正在下载...'}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className={generationStage === 'preparing' ? 'font-medium text-accent-emphasis' : 'text-fg-muted'}>1. 准备结果包</span>
              <span>→</span>
              <span className={generationStage === 'calling' ? 'font-medium text-accent-emphasis' : 'text-fg-muted'}>2. 调用报告服务</span>
              <span>→</span>
              <span className={generationStage === 'downloading' ? 'font-medium text-accent-emphasis' : 'text-fg-muted'}>3. 下载报告</span>
            </div>
          </div>
        )}
        {templates.length === 0 && (
          <div className="mt-4 text-center py-6 text-sm text-fg-muted border border-border rounded-lg">暂无可用报告服务</div>
        )}
        {lastDownloadedFile && (
          <div className="mt-3 flex items-center gap-2 text-sm text-success-fg">
            <CheckCircle2 className="w-4 h-4" />
            <span className="truncate">已下载：{lastDownloadedFile}</span>
          </div>
        )}
      </div>

      <Modal open={errorModalOpen} onOpenChange={setErrorModalOpen}>
        <ModalHeader>
          <div className="flex items-center gap-2 text-danger-fg">
            <AlertCircle className="w-5 h-5" />
            操作失败
          </div>
        </ModalHeader>
        <ModalBody>
          <p className="text-sm text-fg-muted">{errorMessage}</p>
        </ModalBody>
        <ModalFooter>
          <Button variant="primary" onClick={() => setErrorModalOpen(false)}>确定</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
