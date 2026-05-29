'use client';

import * as React from 'react';
import { Button, Select, FormItem, Modal, ModalHeader, ModalBody, ModalFooter } from '@schema/ui-kit';
import {
  AlertCircle,
  CheckCircle2,
  Database,
  Download,
  FileCode,
  FileSpreadsheet,
  FileText,
  Loader2,
  Play,
} from 'lucide-react';
import { reportsApi, saveDownload, type ReportTemplate } from '@/lib/reports';

interface ReportTabProps {
  taskId: string;
}

export function ReportTab({ taskId }: ReportTabProps) {
  const [templates, setTemplates] = React.useState<ReportTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedTemplate, setSelectedTemplate] = React.useState<string>('');
  const [generating, setGenerating] = React.useState(false);
  const [exportingKind, setExportingKind] = React.useState<string>('');
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
        setErrorMessage(error instanceof Error ? error.message : '报告模板加载失败，请稍后重试。');
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
    setLastDownloadedFile('');
    try {
      const download = await reportsApi.generateTaskReport(taskId, template);
      saveDownload(download);
      setLastDownloadedFile(download.filename);
      setSelectedTemplate('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : `报告 "${template.name}" 生成失败，请稍后重试。`);
      setErrorModalOpen(true);
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = async (kind: 'excel' | 'parquet' | 'vcf' | 'mt-vcf') => {
    setExportingKind(kind);
    try {
      const download = await reportsApi.exportTaskFile(taskId, kind);
      saveDownload(download);
      setLastDownloadedFile(download.filename);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Export failed. Please try again.');
      setErrorModalOpen(true);
    } finally {
      setExportingKind('');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent-emphasis" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-canvas-subtle rounded-lg p-4">
        <h4 className="text-sm font-medium text-fg-default mb-3 flex items-center gap-2">
          <Download className="w-4 h-4" />
          数据导出
        </h4>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="small" leftIcon={<FileSpreadsheet className="w-4 h-4" />} onClick={() => handleExport('excel')} loading={exportingKind === 'excel'}>
            Excel 结果表
          </Button>
          <Button variant="secondary" size="small" leftIcon={<Database className="w-4 h-4" />} onClick={() => handleExport('parquet')} loading={exportingKind === 'parquet'}>
            Parquet 文件
          </Button>
          <Button variant="secondary" size="small" leftIcon={<FileCode className="w-4 h-4" />} onClick={() => handleExport('vcf')} loading={exportingKind === 'vcf'}>
            SNP/InDel VCF
          </Button>
          <Button variant="secondary" size="small" leftIcon={<FileCode className="w-4 h-4" />} onClick={() => handleExport('mt-vcf')} loading={exportingKind === 'mt-vcf'}>
            线粒体 VCF
          </Button>
        </div>
      </div>

      <div className="bg-canvas-subtle rounded-lg p-4">
        <h4 className="text-sm font-medium text-fg-default mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          报告生成
        </h4>
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1 min-w-0">
            <FormItem label="报告模板">
              <Select
                value={selectedTemplate}
                onChange={(value) => { if (typeof value === 'string') setSelectedTemplate(value); }}
                options={templateOptions}
                placeholder="请选择报告模板..."
              />
            </FormItem>
          </div>
          <Button
            variant="primary"
            leftIcon={generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            onClick={handleGenerate}
            disabled={!selectedTemplate || generating || templates.length === 0}
          >
            {generating ? '生成中...' : '生成并下载'}
          </Button>
        </div>
        {templates.length === 0 && (
          <div className="mt-4 text-center py-6 text-sm text-fg-muted border border-border rounded-lg">暂无可用报告模板</div>
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
