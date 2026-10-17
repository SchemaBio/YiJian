'use client';
import { SelfHostedOnly } from '@/components/shared/ResearchPolicy';
import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';
import { translateUI, localizeDisplay } from '@/i18n/text';

import { ActionButton as Button, ActionButton } from '@/components/shared/ActionButton';
import { TableActions, TableAction } from '@/components/shared/TableActions';

import { HoverHint } from '@/components/shared/HoverHint';

import {ResourcePager} from '@/components/shared/ResourcePager';
import {useAuth} from '@/components/providers/AuthProvider';

import * as React from 'react';
import { PageContent } from '@/components/layout';
import { Input, DataTable, FormItem, TextArea, type Column } from '@schema/ui-kit';
import { Tag } from '@/components/shared/Tag';
import { Search, FileText, Link, CheckCircle, XCircle, Loader2, AlertTriangle, Power, PowerOff, Braces } from 'lucide-react';
import { api } from '@/lib/api';
import { AppModal, EmptyState } from '@/components/shared';
import { ReportEndpointExamples } from './ReportEndpointExamples';

type TemplateStatus = 'active' | 'inactive';

interface ReportTemplate {
 revision:number;scope:string;canMaintain:boolean;
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
    id: String(raw.id ?? ''),revision:Number(raw.revision??1),scope:String(raw.scope??'personal'),canMaintain:raw.canMaintain===true,
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
    apiEndpoint: data.apiEndpoint.trim(),contractVersion:'report-snapshot-v2',
    ...(data.apiKey.trim() ? { apiKey: data.apiKey.trim() } : {}),
  });
  return normalizeTemplate(response);
}

async function updateReportTemplate(id: string, data: FormData,expectedRevision:number): Promise<ReportTemplate> {
  const response = await api.put<unknown>(`/v1/report-templates/${encodeURIComponent(id)}`, {
    name: data.name.trim(),expectedRevision,
    description: data.description.trim(),
    apiEndpoint: data.apiEndpoint.trim(),contractVersion:'report-snapshot-v2',
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

function ReportTemplatesPageContent() {
  const t = useText();
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
  const [statusUpdatingId, setStatusUpdatingId] = React.useState<string | null>(null);
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
      setError(t("pipeline.unableToLoadReportServicesRetryLaterbbab26"));
    } finally {
      if(!controller.signal.aborted)setLoading(false);
    }
  }, [t]);

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
  }, [templates, searchQuery, t]);

  // 检查名称是否唯一
  const validateName = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError(t("pipeline.enterServiceNameee1fd0"));
      return false;
    }
    const exists = templates.some(
      (t) => t.name.toLowerCase() === trimmed.toLowerCase() && t.id !== editingId
    );
    if (exists) {
      setNameError(t("pipeline.serviceNameAlreadyExists37a043"));
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
      console.error('删除报告服务失败', err);
      setError(err instanceof Error ? errorText(err, t) : t("pipeline.unableToDeleteReportServicec9c524"));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (template: ReportTemplate) => {
    if (statusUpdatingId) return;
    setStatusUpdatingId(template.id);
    setError(null);
    try {
      const updated = await setReportTemplateActive(template.id, template.status !== 'active');
      setTemplates((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      console.error('更新报告服务状态失败', err);
      setError(err instanceof Error ? errorText(err, t) : t("pipeline.unableToUpdateReportServiceStatus5c5023"));
    } finally {
      setStatusUpdatingId(null);
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
        throw new Error(t("pipeline.enterAnHttpsReportUrlWithoutCredentials3c0722"));
      }
      const result = await api.post<{ reachable: boolean; status_code: number;authenticated:boolean;protocol_verified:boolean;head_supported:boolean }>('/v1/report-templates/validate-endpoint', {
        apiEndpoint: endpoint,
        ...(editingId ? { templateId: editingId } : {}),
        ...(formData.apiKey.trim() ? { apiKey: formData.apiKey.trim() } : {}),
      });
      setApiTestResult(result.authenticated?'success':'error');
 setApiTestMessage(result.head_supported?t("pipeline.endpointReachableAuthenticationPassedHttpVerifyGeneration0a121c", {p0: String(result.status_code)}):t("pipeline.endpointReachableButHeadUnsupportedAuthenticationAndcb4347"));
    } catch (err) {
      setApiTestResult('error');
      setApiTestMessage(err instanceof Error ? errorText(err, t) : t("pipeline.endpointConnectionFailedd43e56"));
    } finally {
      setTestingApi(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateName(formData.name)) return;
    if (!isValidReportEndpoint(formData.apiEndpoint)) {
      setApiTestResult('error');
      setError(t("pipeline.enterAnHttpsReportUrlWithoutCredentialsa80c1c"));
      return;
    }
    if (!editingId && !formData.apiKey.trim()) {
      setError(t("pipeline.anAuthenticationKeyIsRequiredForThe073e58"));
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
      setError(err instanceof Error ? errorText(err, t) : t("pipeline.unableToSaveReportServiceRetryLaterf1c2e8"));
    } finally {
      setLoading(false);
    }
  };

  const columns: Column<ReportTemplate>[] = [

    {
      id: 'name',
      header: t("pipeline.serviceNamed82acb"),
      accessor: (row: ReportTemplate) => (
        <div className="flex items-center justify-center gap-2">
          <FileText className="w-4 h-4 text-fg-muted" />
          <span className="font-medium text-fg-default">{row.name}</span>
        </div>
      ),
      width: 180,
      align: 'center',
    },
    {
      id: 'description',
      header: t("admin.description412f54"),
      accessor: (row) => (
        <span className="text-fg-muted text-sm">{row.description || '-'}</span>
      ),
      width: 180,
      align: 'center',
    },
    {
      id: 'apiEndpoint',
      header: t("pipeline.serviceUrl86e118"),
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
      header: t("pipeline.credentialsa39c57"),
      accessor: (row) => (
        <Tag variant={row.hasApiKey ? 'success' : 'neutral'}>
          {row.hasApiKey ? t("pipeline.configureddc7cd2") : t("pipeline.notConfigured63595e")}
        </Tag>
      ),
      width: 90,
      align: 'center',
    },
    {
      id: 'status',
      header: t("admin.status62e951"),
      accessor: (row) => {
        const config = statusConfig[row.status];
        return <Tag variant={config.variant}>{translateUI(config.label, t)}</Tag>;
      },
      width: 70,
      align: 'center',
    },
    {
      id: 'updatedAt',
      header: t("pipeline.updatedAt093dea"),
      accessor: (row) => { const date = new Date(row.updatedAt); return !row.updatedAt ? '—' : Number.isNaN(date.getTime()) ? row.updatedAt : date.toLocaleString(t.locale, { hour12: false }); },
      width: 140,
      align: 'center',
    },
    {
      id: 'actions',
      header: t("admin.actionsf3ea6d"),
      accessor: (row: ReportTemplate) => (
        <TableActions>
          <TableAction label={t("admin.edita7f814")} action="edit" disabled={!row.canMaintain || statusUpdatingId !== null} onClick={() => handleEdit(row)} />
          <TableAction permission="report_services.manage" label={row.status === 'active' ? t("admin.disabledd989e5") : t("admin.enabledd4e9ca")} leftIcon={row.status === 'active' ? <PowerOff /> : <Power />}
            loading={statusUpdatingId === row.id} disabled={!row.canMaintain || statusUpdatingId !== null} onClick={() => void handleToggleStatus(row)} />
          <TableAction label={t("data.delete3755f5")} action="delete" tone="danger" hint={row.status === 'active' ? t("pipeline.disableBeforeDeletingfb1c7e") : t("pipeline.deleteReportServicea5699c")}
            disabled={!row.canMaintain || row.status === 'active' || statusUpdatingId !== null} onClick={() => handleDelete(row)} />
        </TableActions>
      ),
      width: 188,
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
          <h2 className="yj-page-title">{t("pipeline.reportServicea3ff41")}</h2>
          <p className="yj-page-subtitle">{t("pipeline.configureServicesToGenerateReportsFromTask6aac9b")}</p>
        </div>
      </div>

      <div className="yj-toolbar-panel">
        <div className="w-full sm:w-64">
          <Input
            placeholder={t("pipeline.searchReportServicesce3464")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftElement={<Search className="w-4 h-4" />}
          />
        </div>
        <Button action="add" variant="primary"  onClick={handleAdd}>
          {t("pipeline.addReportServicea50cb6")}</Button>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-danger-muted bg-danger-subtle px-3 py-2 text-sm text-danger-fg">
          {error}<ActionButton permission={null} action="retry" variant="ghost" type="button" className="yj-tool-button ml-3" disabled={loading} onClick={() => void refreshTemplates()}>{t("billing.retryLoading7b4939")}</ActionButton>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-64 items-center justify-center text-sm text-fg-muted">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t("pipeline.loadingReportServices67b6c7")}</div>
      ) : filteredTemplates.length > 0 ? (
        <DataTable
          data={filteredTemplates.slice((page-1)*20,page*20)}
          columns={localizeDisplay(columns, t)}
          rowKey="id"
          density="default"
          className="yj-data-table right-pinned-actions-table report-center-table"
        />
      ) : error ? null : (
        <EmptyState
          className="yj-panel"
          icon={<FileText />}
          title={searchQuery.trim() ? t("pipeline.noMatchingReportServicesd126bf") : t("pipeline.noReportServicesConfiguredbfcc2e")}
          description={searchQuery.trim() ? t("pipeline.adjustYourSearchAndRetryf591c7") : t("pipeline.addAServiceUrlWithBearerKey83660d")}
        />
      )}

      {filteredTemplates.length > 0 && <ResourcePager page={page} total={filteredTemplates.length} onChange={setPage} />}
      {/* 新建/编辑弹窗 */}
      <AppModal
        open={isModalOpen}
        onOpenChange={(open) => !loading && setIsModalOpen(open)}
        title={editingId ? t("pipeline.editReportService5ecd35") : t("pipeline.addReportServicea50cb6")}
        size="large"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={loading}>
              {t("admin.cancel4d0b46")}</Button>
            <Button loading={loading} action="save"
              variant="primary"
              onClick={handleSubmit}
              disabled={!isFormValid || loading}

            >
              {loading ? (editingId ? t("admin.savingd70d42") : t("pipeline.creating8c6348")) : (editingId ? t("data.savefadf24") : t("pipeline.createfcbd09"))}
            </Button>
          </>
        }
      >
          <div className="space-y-5">
            {error && <p role="alert" className="text-sm text-danger-fg">{error}</p>}
            <section>
              <div className="space-y-4">
            <FormItem
              label={t("pipeline.serviceNamed82acb")}
              required
              error={nameError || undefined}
            >
              <Input
                aria-label={t("pipeline.serviceNamed82acb")}
                value={formData.name}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, name: e.target.value }));
                  if (nameError) validateName(e.target.value);
                }}
                onBlur={() => validateName(formData.name)}
                placeholder={t("pipeline.forExampleWesGermlineReport004a0a")}
                error={!!nameError}
              />
            </FormItem>

            <FormItem label={t("admin.description412f54")}>
              <TextArea
                aria-label={t("admin.description412f54")}
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder={t("pipeline.describeTheReportServicePurpose7b6472")}
                rows={2}
              />
            </FormItem>

              </div>
            </section>

            <section className="border-t border-[var(--yj-border-subtle)] pt-5">
              <h3 className="mb-3 text-sm font-medium text-fg-default">{t("pipeline.serviceConnection71203e")}</h3>
              <div className="space-y-4">

            <FormItem label={t("pipeline.serviceUrl86e118")} required hint={t("pipeline.youMaySaveAnHttpsUrlBefore37e548")}>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  aria-label={t("pipeline.serviceUrl86e118")}
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
                <Button permission="report_services.manage" loading={testingApi} loadingLabel={t("pipeline.testingf43705")}
                  type="button"
                  variant="secondary"
                  size="medium"
                  onClick={handleTestApi}
                  disabled={testingApi || !formData.apiEndpoint || (!editingId && !formData.apiKey.trim())}
                  leftIcon={<CheckCircle className="h-4 w-4" />}
                  className="yj-tool-button min-w-[116px] shrink-0 whitespace-nowrap"
                >
                  {t("pipeline.testConnection10b7d8")}</Button>
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
              label={t("pipeline.authenticationKey0d400f")}
              required={!editingId}
              hint={editingId ? t("pipeline.leaveBlankToKeepTheSavedKey379a61") : t("pipeline.requiredSentAsAuthorizationBearerKeyIt694927")}
            >
              <Input
                type="password"
                aria-label={t("pipeline.authenticationKey0d400f")}
                value={formData.apiKey}
                onChange={(e) => setFormData((prev) => ({ ...prev, apiKey: e.target.value }))}
                placeholder={editingId ? t("pipeline.leaveBlankToKeepExistingKey22d09f") : t("pipeline.enterReportServiceKeyedfa5f")}
                autoComplete="off"
              />
            </FormItem>

              </div>
            </section>

            <div className="rounded-md border border-border-default bg-canvas-subtle p-3 text-xs text-fg-muted">
              <p className="mb-2 flex items-center gap-1.5 font-medium text-fg-default"><Braces className="h-3.5 w-3.5" />{t("pipeline.apiContract59c284")}</p>
              <ul className="list-disc list-inside space-y-1">
                <li>{t("pipeline.methodPostContentTypeApplicationJsona3bfc9")}</li>
                <li>{t("pipeline.authenticationAuthorizationBearerYourKey2957f8")}</li>
                <li>{t("pipeline.taskResultIdIsInTheTask03cc2f")}</li>
                <li>{t("pipeline.returnReportFilesSuchAsPdfDocx2e6be6")}</li>
              </ul>
            </div>

            <ReportEndpointExamples />
          </div>
      </AppModal>

      {/* 删除确认弹窗 */}
      <AppModal open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)} size="small" title={t("pipeline.confirmDeletion726b6e")} footer={<>
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
            {t("admin.cancel4d0b46")}</Button>
          <Button action="delete" variant="danger" onClick={confirmDelete}>
            {t("data.confirmDeletion3c06ab")}</Button>
         </>}>
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-12 h-12 rounded-full bg-danger-subtle flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-danger-fg" />
            </div>
            <p className="text-fg-default mb-2">{t("pipeline.deleteThisReportServicefa34e4")}</p>
            {deleteTarget && (
              <p className="text-sm text-fg-muted font-mono bg-canvas-subtle px-2 py-1 rounded">
                {deleteTarget.name}
              </p>
            )}
            <p className="text-xs text-fg-muted mt-3">{t("pipeline.thisCannotBeUndone7da32f")}</p>
          </div>
         </AppModal>
    </PageContent>
  );
}

export default function ReportTemplatesPage(){const {user,currentOrg}=useAuth();return <SelfHostedOnly><ReportTemplatesPageContent key={`${user?.id??""}:${currentOrg?.id??""}`} /></SelfHostedOnly>;}
