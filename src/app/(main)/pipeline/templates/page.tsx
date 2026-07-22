'use client';

import * as React from 'react';
import { PageContent } from '@/components/layout';
import {
  Button,
  Input,
  DataTable,
  Tag,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  FormItem,
  TextArea,
  type Column,
} from '@schema/ui-kit';
import { Plus, Search, Pencil, Trash2, FileText, Link, CheckCircle, XCircle, Loader2, AlertTriangle, Power, PowerOff } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/components/providers/AuthProvider';

type TemplateStatus = 'active' | 'inactive';

interface ReportTemplate {
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
    id: String(raw.id ?? ''),
    name: typeof raw.name === 'string' ? raw.name : '',
    description: typeof raw.description === 'string' ? raw.description : '',
    // Octopus intentionally does not expose apiEndpoint/apiKey on list responses.
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

async function fetchReportTemplates(): Promise<ReportTemplate[]> {
  const response = await api.get<MaybeList<unknown>>('/v1/report-templates', {
    params: { include_inactive: 'true' },
  });
  return unwrapList(response).map(normalizeTemplate).filter(template => template.id && template.name);
}

async function createReportTemplate(data: FormData): Promise<ReportTemplate> {
  const response = await api.post<unknown>('/v1/report-templates', {
    name: data.name.trim(),
    description: data.description.trim(),
    apiEndpoint: data.apiEndpoint.trim(),
    ...(data.apiKey.trim() ? { apiKey: data.apiKey.trim() } : {}),
  });
  return normalizeTemplate(response);
}

async function updateReportTemplate(id: string, data: FormData): Promise<ReportTemplate> {
  const response = await api.put<unknown>(`/v1/report-templates/${encodeURIComponent(id)}`, {
    name: data.name.trim(),
    description: data.description.trim(),
    apiEndpoint: data.apiEndpoint.trim(),
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
  name: string;
  description: string;
  apiEndpoint: string;
  apiKey: string;
}

const initialFormData: FormData = {
  name: '',
  description: '',
  apiEndpoint: '',
  apiKey: '',
};

export default function ReportTemplatesPage() {
  const { isPlatformAdmin } = useAuth();
  const canManage = isPlatformAdmin();
  const [templates, setTemplates] = React.useState<ReportTemplate[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState<FormData>(initialFormData);
  const [testingApi, setTestingApi] = React.useState(false);
  const [apiTestResult, setApiTestResult] = React.useState<'success' | 'error' | null>(null);
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<ReportTemplate | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refreshTemplates = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTemplates(await fetchReportTemplates());
    } catch (err) {
      console.error('加载报告模板失败', err);
      setTemplates([]);
      setError('加载报告模板失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refreshTemplates();
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
      setNameError('请输入模板名称');
      return false;
    }
    const exists = templates.some(
      (t) => t.name.toLowerCase() === trimmed.toLowerCase() && t.id !== editingId
    );
    if (exists) {
      setNameError('模板名称已存在');
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
    if (!template.apiEndpoint) {
      setError('当前账号只能读取公开模板摘要，无法编辑后端未返回的 API 端点。请使用平台管理员账号。');
      return;
    }
    setEditingId(template.id);
    setFormData({
      name: template.name,
      description: template.description,
      apiEndpoint: template.apiEndpoint,
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
      console.error('删除报告模板失败', err);
      setError(err instanceof Error ? err.message : '删除报告模板失败');
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
      console.error('更新报告模板状态失败', err);
      setError(err instanceof Error ? err.message : '更新报告模板状态失败');
    } finally {
      setLoading(false);
    }
  };

  const handleTestApi = async () => {
    if (!formData.apiEndpoint) return;

    setTestingApi(true);
    setApiTestResult(null);

    try {
      setApiTestResult(isValidReportEndpoint(formData.apiEndpoint) ? 'success' : 'error');
    } catch {
      setApiTestResult('error');
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

    setLoading(true);
    setError(null);
    try {
      if (editingId) {
        const updated = await updateReportTemplate(editingId, formData);
        setTemplates((prev) => prev.map((template) => (template.id === updated.id ? updated : template)));
      } else {
        const newTemplate = await createReportTemplate(formData);
        setTemplates((prev) => [newTemplate, ...prev]);
      }
      setIsModalOpen(false);
      setEditingId(null);
      setFormData(initialFormData);
    } catch (err) {
      console.error('保存报告模板失败', err);
      setError(err instanceof Error ? err.message : '保存报告模板失败：需要管理员权限，或请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const columns: Column<ReportTemplate>[] = [
    {
      id: 'name',
      header: '模板名称',
      accessor: (row: ReportTemplate) => (
        <div className="flex items-center justify-center gap-2">
          <FileText className="w-4 h-4 text-fg-muted" />
          <span className="font-medium font-mono text-fg-default">{row.name}</span>
        </div>
      ),
      width: 200,
      align: 'center',
    },
    {
      id: 'description',
      header: '描述',
      accessor: (row) => (
        <span className="text-fg-muted text-sm">{row.description || '-'}</span>
      ),
      width: 250,
      align: 'center',
    },
    {
      id: 'apiEndpoint',
      header: 'API 端点',
      accessor: (row) => (
        <span className="text-sm text-fg-muted font-mono truncate block max-w-[250px]" title={row.apiEndpoint}>
          {row.apiEndpoint || '由后端托管（未向前端暴露）'}
        </span>
      ),
      width: 260,
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
      width: 120,
      align: 'center',
    },
    {
      id: 'status',
      header: '状态',
      accessor: (row) => {
        const config = statusConfig[row.status];
        return <Tag variant={config.variant}>{config.label}</Tag>;
      },
      width: 80,
      align: 'center',
    },
    {
      id: 'updatedAt',
      header: '更新时间',
      accessor: 'updatedAt',
      width: 160,
      align: 'center',
    },
    ...(canManage ? [{
      id: 'actions',
      header: '操作',
      accessor: (row: ReportTemplate) => (
        <div className="flex items-center justify-center gap-1">
          <button
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-blue-600 transition-colors"
            title="编辑"
            onClick={() => handleEdit(row)}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-600 dark:text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="删除"
            onClick={() => handleDelete(row)}
            disabled={row.status === 'active'}
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            className={`p-1.5 rounded transition-colors ${
              row.status === 'active'
                ? 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-orange-600'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-green-600'
            }`}
            title={row.status === 'active' ? '停用' : '启用'}
            onClick={() => handleToggleStatus(row)}
          >
            {row.status === 'active' ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
          </button>
        </div>
      ),
      width: 130,
      align: 'center' as const,
    }] : []),
  ];

  const isFormValid = formData.name.trim() && formData.apiEndpoint && !nameError;

  return (
    <PageContent className="yj-page-shell">
      <div className="yj-page-header">
        <div>
          <h2 className="yj-page-title">报告模板</h2>
          <p className="yj-page-subtitle">报告生成服务与访问凭据。</p>
        </div>
      </div>

      <div className="yj-toolbar-panel">
        <div className="w-64">
          <Input
            placeholder="搜索模板..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftElement={<Search className="w-4 h-4" />}
          />
        </div>
        {canManage && (
          <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />} onClick={handleAdd}>
            新建模板
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-sm text-fg-muted">加载报告模板...</div>
      )}

      {filteredTemplates.length > 0 ? (
        <DataTable
          data={filteredTemplates}
          columns={columns}
          rowKey="id"
          density="default"
          striped
        />
      ) : (
        <div className="yj-empty-state">
          <div>
            <span className="yj-empty-state-icon"><FileText className="h-5 w-5" /></span>
            <p className="text-sm font-medium text-fg-default">暂无报告模板</p>
            <p className="mt-1 text-xs text-fg-muted">调整搜索条件后重试。</p>
          </div>
        </div>
      )}

      {/* 新建/编辑弹窗 */}
      <Modal open={isModalOpen} onOpenChange={setIsModalOpen} size="medium">
        <ModalHeader>{editingId ? '编辑报告模板' : '新建报告模板'}</ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <FormItem
              label="模板名称"
              required
              hint="唯一标识符，建议使用英文和连字符"
              error={nameError || undefined}
            >
              <Input
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
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="输入模板描述"
                rows={2}
              />
            </FormItem>

            <FormItem label="API 端点" required hint="报告生成服务的 RESTful API 地址">
              <div className="flex gap-2">
                <Input
                  value={formData.apiEndpoint}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, apiEndpoint: e.target.value }));
                    setApiTestResult(null);
                  }}
                  placeholder="https://api.example.com/reports/generate"
                  leftElement={<Link className="w-4 h-4" />}
                  className="flex-1"
                />
                <Button
                  variant="secondary"
                  size="medium"
                  onClick={handleTestApi}
                  disabled={testingApi || !formData.apiEndpoint}
                >
                  {testingApi ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  校验
                </Button>
              </div>
              {apiTestResult && (
                <div className={`flex items-center gap-1 text-sm mt-1 ${apiTestResult === 'success' ? 'text-success-fg' : 'text-danger-fg'}`}>
                  {apiTestResult === 'success' ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>URL 格式有效（仅本地校验，未从浏览器发起连接）</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      <span>请输入有效的 HTTPS URL</span>
                    </>
                  )}
                </div>
              )}
            </FormItem>

            <FormItem label="API Key" hint="可选；仅提交给后端且不会回显。">
              <Input
                type="password"
                value={formData.apiKey}
                onChange={(e) => setFormData((prev) => ({ ...prev, apiKey: e.target.value }))}
                placeholder="报告服务访问令牌（可选）"
                autoComplete="off"
              />
            </FormItem>

            <div className="bg-canvas-subtle rounded-md p-3 text-xs text-fg-muted">
              <p className="font-medium text-fg-default mb-1">说明</p>
              <ul className="list-disc list-inside space-y-1">
                <li>模板名称必须唯一，用于系统内部标识</li>
                <li>API 端点需要实现报告生成接口规范</li>
                <li>管理员可通过 Octopus 创建、编辑、启停和删除未启用模板；API Key 只提交给后端且不会回显</li>
              </ul>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
            取消
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={!isFormValid}>
            {editingId ? '保存' : '创建'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* 删除确认弹窗 */}
      <Modal open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)} size="small">
        <ModalHeader>删除确认</ModalHeader>
        <ModalBody>
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-12 h-12 rounded-full bg-danger-subtle flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-danger-fg" />
            </div>
            <p className="text-fg-default mb-2">确定要删除此报告模板吗？</p>
            {deleteTarget && (
              <p className="text-sm text-fg-muted font-mono bg-canvas-subtle px-2 py-1 rounded">
                {deleteTarget.name}
              </p>
            )}
            <p className="text-xs text-fg-muted mt-3">此操作不可撤销</p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
            取消
          </Button>
          <Button variant="danger" onClick={confirmDelete}>
            确认删除
          </Button>
        </ModalFooter>
      </Modal>
    </PageContent>
  );
}
