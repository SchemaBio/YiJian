'use client';
import { HoverHint } from '@/components/shared/HoverHint';

import {ResourcePager} from '@/components/shared/ResourcePager';
import {useAuth} from '@/components/providers/AuthProvider';

import * as React from 'react';
import { PageContent } from '@/components/layout';
import {
  Button,
  Input,
  Select,
  DataTable,
  Tag,
  FormItem,
  TextArea,
  type Column,
} from '@schema/ui-kit';
import { Plus, Search, Pencil, Trash2, FileText, Link, CheckCircle, XCircle, Loader2, AlertTriangle, Power, PowerOff, Braces } from 'lucide-react';
import { api } from '@/lib/api';
import { AppModal, EmptyState } from '@/components/shared';
import { ReportEndpointExamples } from './ReportEndpointExamples';

type TemplateStatus = 'active' | 'inactive';

interface ReportTemplate {
 revision:number;scope:string;canMaintain:boolean;contractVersion:string;
  id: string;
  name: string;
  description: string;
  apiEndpoint: string;
  hasApiKey: boolean;
  status: TemplateStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

const statusConfig: Record<TemplateStatus, { label: string; variant: 'success' | 'neutral' }> = {
  active: { label: '启用', variant: 'success' },
  inactive: { label: '停用', variant: 'neutral' },
};

type MaybeList<T> = T[] | { items?: T[]; data?: T[] | { items?: T[] } };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function unwrapList<T>(value: MaybeList<T>): T[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.items)) return value.items;
  if (Array.isArray(value.data)) return value.data;
  if (value.data && !Array.isArray(value.data) && Array.isArray(value.data.items)) return value.data.items;
  return [];
}

function normalizeTemplate(value: unknown): ReportTemplate {
  const raw = asRecord(value);
  const isActive = raw.isActive ?? raw.is_active;
  return {
    id: String(raw.id ?? ''),revision:Number(raw.revision??1),scope:String(raw.scope??'personal'),canMaintain:raw.canMaintain===true,contractVersion:String(raw.contractVersion??'legacy-v1'),
    name: typeof raw.name === 'string' ? raw.name : '',
    description: typeof raw.description === 'string' ? raw.description : '',
    // The owner can read the endpoint and key-presence flag, but never the key itself.
    apiEndpoint: typeof raw.apiEndpoint === 'string' ? raw.apiEndpoint : '',
    hasApiKey: raw.hasApiKey === true,
    status: isActive === false ? 'inactive' : 'active',
    createdBy: typeof raw.createdBy === 'string' ? raw.createdBy : '',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : typeof raw.created_at === 'string' ? raw.created_at : '',
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : typeof raw.updated_at === 'string' ? raw.updated_at : '',
  };
}

function isValidReportEndpoint(value: string): boolean {
  value = value.trim();
  if (/[\u0000-\u001f]/.test(value)) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const isPrivateIPv4 = /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host);
    const isLocalHost = host === 'localhost' || host.endsWith('.localhost') || host === '[::1]' || host === '::1';
    return url.protocol === 'https:'
      && !url.username
      && !url.password
      && !url.hash
      && !isLocalHost
      && !isPrivateIPv4;
  } catch {
    return false;
  }
}

async function fetchReportTemplates(signal?:AbortSignal): Promise<ReportTemplate[]> {
  const response = await api.get<MaybeList<unknown>>('/v1/report-templates', {
    params: { include_inactive: 'true' },signal,
  });
  return unwrapList(response).map(normalizeTemplate).filter(template => template.id && template.name);
}

async function createReportTemplate(data: FormData): Promise<ReportTemplate> {
  const response = await api.post<unknown>('/v1/report-templates', {
    name: data.name.trim(),
    description: data.description.trim(),
    apiEndpoint: data.apiEndpoint.trim(),contractVersion:data.contractVersion,
    ...(data.apiKey.trim() ? { apiKey: data.apiKey.trim() } : {}),
  });
  return normalizeTemplate(response);
}

async function updateReportTemplate(id: string, data: FormData,expectedRevision:number): Promise<ReportTemplate> {
  const response = await api.put<unknown>(`/v1/report-templates/${encodeURIComponent(id)}`, {
    name: data.name.trim(),expectedRevision,
    description: data.description.trim(),
    apiEndpoint: data.apiEndpoint.trim(),contractVersion:data.contractVersion,
    ...(data.apiKey.trim() ? { apiKey: data.apiKey.trim() } : {}),
  });
  return normalizeTemplate(response);
}

async function setReportTemplateActive(id: string, isActive: boolean): Promise<ReportTemplate> {
  const response = await api.put<unknown>(`/v1/report-templates/${encodeURIComponent(id)}/status`, { isActive });
  return normalizeTemplate(response);
}

async function deleteReportTemplate(id: string): Promise<void> {
  await api.delete<void>(`/v1/report-templates/${encodeURIComponent(id)}`);
}

interface FormData {
 contractVersion:string;
  name: string;
  description: string;
  apiEndpoint: string;
  apiKey: string;
}

const initialFormData: FormData = {
 contractVersion:'report-snapshot-v2',
  name: '',
  description: '',
  apiEndpoint: '',
  apiKey: '',
};

function ReportTemplatesPageContent() {
 const [page,setPage]=React.useState(1);
  const [templates, setTemplates] = React.useState<ReportTemplate[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
 React.useEffect(()=>setPage(1),[searchQuery]);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState<FormData>(initialFormData);
  const [testingApi, setTestingApi] = React.useState(false);
  const [apiTestResult, setApiTestResult] = React.useState<'success' | 'error' | null>(null);
  const [apiTestMessage, setApiTestMessage] = React.useState('');
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<ReportTemplate | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadController=React.useRef<AbortController|null>(null);
 const refreshTemplates = React.useCallback(async () => {
 loadController.current?.abort();const controller=new AbortController();loadController.current=controller;
    setLoading(true);
    setError(null);
    try {
      const rows=await fetchReportTemplates(controller.signal);if(!controller.signal.aborted)setTemplates(rows);
    } catch (err) {
      if(controller.signal.aborted)return;console.error('加载报告服务失败', err);
      setTemplates([]);
      setError('加载报告服务失败，请稍后重试');
    } finally {
      if(!controller.signal.aborted)setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refreshTemplates();return()=>loadController.current?.abort();
  }, [refreshTemplates]);

  const filteredTemplates = React.useMemo(() => {
    if (!searchQuery) return templates;
    const query = searchQuery.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.id.toLowerCase().includes(query)
    );
  }, [templates, searchQuery]);

  // 检查名称是否唯一
  const validateName = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('请输入服务名称');
      return false;
    }
    const exists = templates.some(
      (t) => t.name.toLowerCase() === trimmed.toLowerCase() && t.id !== editingId
    );
    if (exists) {
      setNameError('服务名称已存在');
      return false;
    }
    setNameError(null);
    return true;
  };

  const handleAdd = () => {
    setEditingId(null);
    setFormData(initialFormData);
    setApiTestResult(null);
    setNameError(null);
    setIsModalOpen(true);
  };

  const handleEdit = (template: ReportTemplate) => {
    setEditingId(template.id);
    setFormData({
      name: template.name,
      description: template.description,
      apiEndpoint: template.apiEndpoint,contractVersion:template.contractVersion,
      apiKey: '',
    });
    setApiTestResult(null);
    setNameError(null);
    setError(null);
    setIsModalOpen(true);
  };

  const handleDelete = (template: ReportTemplate) => {
    setDeleteTarget(template);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setLoading(true);
    setError(null);
    try {
      await deleteReportTemplate(deleteTarget.id);
      setTemplates((prev) => prev.filter((template) => template.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error('删除报告服务失败', err);
      setError(err instanceof Error ? err.message : '删除报告服务失败');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (template: ReportTemplate) => {
    setLoading(true);
    setError(null);
    try {
      const updated = await setReportTemplateActive(template.id, template.status !== 'active');
      setTemplates((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      console.error('更新报告服务状态失败', err);
      setError(err instanceof Error ? err.message : '更新报告服务状态失败');
    } finally {
      setLoading(false);
    }
  };

  const handleTestApi = async () => {
    const endpoint = formData.apiEndpoint.trim();
    if (!endpoint) return;

    setTestingApi(true);
    setApiTestResult(null);
    setApiTestMessage('');

    try {
      if (!isValidReportEndpoint(endpoint)) {
        throw new Error('请输入不含访问凭据或片段标识的 HTTPS 报告服务地址');
      }
      const result = await api.post<{ reachable: boolean; status_code: number;authenticated:boolean;protocol_verified:boolean;head_supported:boolean }>('/v1/report-templates/validate-endpoint', {
        apiEndpoint: endpoint,
        ...(editingId ? { templateId: editingId } : {}),
        ...(formData.apiKey.trim() ? { apiKey: formData.apiKey.trim() } : {}),
      });
      setApiTestResult(result.authenticated?'success':'error');
 setApiTestMessage(result.head_supported?`端点可达，认证通过（HTTP ${result.status_code}）；生成协议需通过实际报告验证。`:'端点可达，但不支持 HEAD；认证和生成协议尚未验证。');
    } catch (err) {
      setApiTestResult('error');
      setApiTestMessage(err instanceof Error ? err.message : '端点连接失败');
    } finally {
      setTestingApi(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateName(formData.name)) return;
    if (!isValidReportEndpoint(formData.apiEndpoint)) {
      setApiTestResult('error');
      setError('请输入不含访问凭据或片段标识的 HTTPS 报告服务地址。');
      return;
    }
    if (!editingId && !formData.apiKey.trim()) {
      setError('认证 Key 为必填项，用于报告服务认证。');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (editingId) {
        const updated = await updateReportTemplate(editingId, formData,templates.find(x=>x.id===editingId)?.revision??0);
        setTemplates((prev) => prev.map((template) => (template.id === updated.id ? updated : template)));
      } else {
        const newTemplate = await createReportTemplate(formData);
        setTemplates((prev) => [newTemplate, ...prev]);
      }
      setIsModalOpen(false);
      setEditingId(null);
      setFormData(initialFormData);
    } catch (err) {
      console.error('保存报告服务失败', err);
      setError(err instanceof Error ? err.message : '保存报告服务失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const columns: Column<ReportTemplate>[] = [

    {
      id: 'name',
      header: '服务名称',
      accessor: (row: ReportTemplate) => (
        <div className="flex items-center justify-center gap-2">
          <FileText className="w-4 h-4 text-fg-muted" />
          <span className="font-medium text-fg-default">{row.name}</span>
        </div>
      ),
      width: 180,
      align: 'center',
    },
 {id:'contract',header:'报告协议',width:140,align:'center',accessor:row=><div><Tag variant={row.contractVersion==='report-snapshot-v2'?'info':'warning'}>{row.contractVersion==='report-snapshot-v2'?'回报快照 v2':'旧版契约'}</Tag>{row.scope==='personal'&&row.canMaintain&&<button type="button" className="mt-1 block w-full text-xs text-accent-fg" onClick={async()=>{try{await api.post(`/v1/report-templates/${row.id}/publish`,{expectedRevision:row.revision});await refreshTemplates()}catch(e){setError(e instanceof Error?e.message:'共享失败')}}}>共享到当前组织</button>}</div>},
    {
      id: 'description',
      header: '描述',
      accessor: (row) => (
        <span className="text-fg-muted text-sm">{row.description || '-'}</span>
      ),
      width: 180,
      align: 'center',
    },
    {
      id: 'apiEndpoint',
      header: '服务地址',
      accessor: (row) => (
        <HoverHint content={row.apiEndpoint}><span className="text-sm text-fg-muted font-mono truncate block max-w-[250px]" >
          {row.apiEndpoint || '-'}
        </span></HoverHint>
      ),
      width: 180,
      align: 'center',
    },
    {
      id: 'credential',
      header: '访问凭据',
      accessor: (row) => (
        <Tag variant={row.hasApiKey ? 'success' : 'neutral'}>
          {row.hasApiKey ? '已配置' : '未配置'}
        </Tag>
      ),
      width: 90,
      align: 'center',
    },
    {
      id: 'status',
      header: '状态',
      accessor: (row) => {
        const config = statusConfig[row.status];
        return <Tag variant={config.variant}>{config.label}</Tag>;
      },
      width: 70,
      align: 'center',
    },
    {
      id: 'updatedAt',
      header: '更新时间',
      accessor: (row) => { const date = new Date(row.updatedAt); return !row.updatedAt ? '—' : Number.isNaN(date.getTime()) ? row.updatedAt : date.toLocaleString('zh-CN', { hour12: false }); },
      width: 140,
      align: 'center',
    },
    {
      id: 'actions',
      header: '操作',
      accessor: (row: ReportTemplate) => (
        <div className="flex items-center justify-center gap-1">
          <HoverHint content="编辑"><button
            className="p-1.5 rounded hover:bg-canvas-subtle text-fg-muted hover:text-accent-fg transition-colors"

            disabled={!row.canMaintain} onClick={() => handleEdit(row)}
          >
            <Pencil className="w-4 h-4" />
          </button></HoverHint>
          <HoverHint content="删除"><button
            className="p-1.5 rounded hover:bg-danger-subtle text-fg-muted hover:text-danger-fg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"

            onClick={() => handleDelete(row)}
            disabled={!row.canMaintain || row.status === 'active'}
          >
            <Trash2 className="w-4 h-4" />
          </button></HoverHint>
          <HoverHint content={row.status === 'active' ? '停用' : '启用'}><button
            className={`p-1.5 rounded transition-colors ${
              row.status === 'active'
                ? 'hover:bg-canvas-subtle text-fg-muted hover:text-warning-fg'
                : 'hover:bg-canvas-subtle text-fg-muted hover:text-success-fg'
            }`}

            disabled={!row.canMaintain} onClick={() => handleToggleStatus(row)}
          >
            {row.status === 'active' ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
          </button></HoverHint>
        </div>
      ),
      width: 100,
      align: 'center' as const,
    },
  ];

  const isFormValid = formData.name.trim()
    && formData.apiEndpoint.trim()
    && (editingId !== null || formData.apiKey.trim())
    && !nameError;

  return (
    <PageContent className="yj-page-shell">
      <div className="yj-page-header">
        <div>
          <h2 className="yj-page-title">报告服务</h2>
          <p className="yj-page-subtitle">配置报告服务，使用任务结果生成报告。</p>
        </div>
      </div>

      <div className="yj-toolbar-panel">
        <div className="w-full sm:w-64">
          <Input
            placeholder="搜索报告服务..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftElement={<Search className="w-4 h-4" />}
          />
        </div>
        <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />} onClick={handleAdd}>
          添加报告服务
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-danger-muted bg-danger-subtle px-3 py-2 text-sm text-danger-fg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-64 items-center justify-center text-sm text-fg-muted">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载报告服务...
        </div>
      ) : filteredTemplates.length > 0 ? (
        <div className="[&_table]:min-w-[1080px]"><DataTable
          data={filteredTemplates.slice((page-1)*20,page*20)}
          columns={columns}
          rowKey="id"
          density="default"
          striped
        /></div>
      ) : (
        <EmptyState
          className="yj-panel"
          icon={<FileText />}
          title="尚未配置报告服务"
          description="添加一个带 Bearer Key 认证的 服务地址，即可在任务报告页调用。"
        />
      )}

      {filteredTemplates.length > 0 && <ResourcePager page={page} total={filteredTemplates.length} onChange={setPage} />}
      {/* 新建/编辑弹窗 */}
      <AppModal
        open={isModalOpen}
        onOpenChange={(open) => !loading && setIsModalOpen(open)}
        title={editingId ? '编辑报告服务' : '添加报告服务'}
        size="large"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={loading}>
              取消
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!isFormValid || loading}
              leftIcon={loading ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
            >
              {loading ? (editingId ? '保存中...' : '创建中...') : (editingId ? '保存' : '创建')}
            </Button>
          </>
        }
      >
          <div className="space-y-5">
            {error && <p role="alert" className="text-sm text-danger-fg">{error}</p>}
            <section>
              <div className="space-y-4">
            <FormItem
              label="服务名称"
              required
              error={nameError || undefined}
            >
              <Input
                aria-label="服务名称"
                value={formData.name}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, name: e.target.value }));
                  if (nameError) validateName(e.target.value);
                }}
                onBlur={() => validateName(formData.name)}
                placeholder="如 wes-germline-report"
                error={!!nameError}
              />
            </FormItem>

            <FormItem label="描述">
              <TextArea
                aria-label="描述"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="输入报告服务用途说明"
                rows={2}
              />
            </FormItem>

              </div>
            </section>

            <section className="border-t border-[var(--yj-border-subtle)] pt-5">
              <h3 className="mb-3 text-sm font-medium text-fg-default">服务连接</h3>
              <div className="space-y-4">

            <FormItem label="服务地址" required hint="平台将从服务端向此 HTTPS 地址发起 POST 请求">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  aria-label="服务地址"
                  value={formData.apiEndpoint}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, apiEndpoint: e.target.value }));
                    setApiTestResult(null);
                    setApiTestMessage('');
                  }}
                  placeholder="https://api.example.com/reports/generate"
                  leftElement={<Link className="w-4 h-4" />}
                  className="min-w-0 flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="medium"
                  onClick={handleTestApi}
                  disabled={testingApi || !formData.apiEndpoint || (!editingId && !formData.apiKey.trim())}
                  leftIcon={testingApi ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  className="yj-tool-button min-w-[116px] shrink-0 whitespace-nowrap"
                >
                  {testingApi ? '测试中...' : '测试连接'}
                </Button>
              </div>
              {apiTestResult && (
                <div className={`flex items-center gap-1 text-sm mt-1 ${apiTestResult === 'success' ? 'text-success-fg' : 'text-danger-fg'}`}>
                  {apiTestResult === 'success' ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>{apiTestMessage}</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      <span>{apiTestMessage}</span>
                    </>
                  )}
                </div>
              )}
            </FormItem>

            <FormItem
              label="认证 Key"
              required={!editingId}
              hint={editingId ? '留空表示继续使用已保存的 Key；填写则轮换。Key 不会回显。' : '必填；以 Authorization: Bearer <key> 发送，保存后不会回显。'}
            >
              <Input
                type="password"
                aria-label="认证 Key"
                value={formData.apiKey}
                onChange={(e) => setFormData((prev) => ({ ...prev, apiKey: e.target.value }))}
                placeholder={editingId ? '留空以保留现有 Key' : '输入报告服务认证 Key'}
                autoComplete="off"
              />
            </FormItem>

              </div>
            </section>

            <div className="rounded-md border border-border-default bg-canvas-subtle p-3 text-xs text-fg-muted">
              <p className="mb-2 flex items-center gap-1.5 font-medium text-fg-default"><Braces className="h-3.5 w-3.5" />接口约定</p>
              <ul className="list-disc list-inside space-y-1">
                <li>请求方法：POST；Content-Type：application/json</li>
                <li>认证方式：Authorization: Bearer &lt;你的 Key&gt;</li>
                <li>任务结果标识位于请求体字段 task_result_uuid</li>
                <li>端点应直接返回 PDF、DOCX、XLSX 等报告文件</li>
              </ul>
            </div>

            <FormItem label="报告协议"><Select value={formData.contractVersion} options={[{value:'report-snapshot-v2',label:'回报快照 v2（含最新判读）'},{value:'legacy-v1',label:'旧版契约（原始结果包）'}]} onChange={v=>setFormData({...formData,contractVersion:Array.isArray(v)?v[0]:v})}/></FormItem><ReportEndpointExamples />
          </div>
      </AppModal>

      {/* 删除确认弹窗 */}
      <AppModal open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)} size="small" title="删除确认" footer={<>
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
            取消
          </Button>
          <Button variant="danger" onClick={confirmDelete}>
            确认删除
          </Button>
         </>}>
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-12 h-12 rounded-full bg-danger-subtle flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-danger-fg" />
            </div>
            <p className="text-fg-default mb-2">确定要删除此报告服务吗？</p>
            {deleteTarget && (
              <p className="text-sm text-fg-muted font-mono bg-canvas-subtle px-2 py-1 rounded">
                {deleteTarget.name}
              </p>
            )}
            <p className="text-xs text-fg-muted mt-3">此操作不可撤销</p>
          </div>
         </AppModal>
    </PageContent>
  );
}

export default function ReportTemplatesPage(){const {user,currentOrg}=useAuth();return <ReportTemplatesPageContent key={`${user?.id??""}:${currentOrg?.id??""}`} />;}
