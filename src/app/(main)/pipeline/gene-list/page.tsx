'use client';
import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';


import { ActionButton as Button, ActionButton } from '@/components/shared/ActionButton';

import { HoverHint } from '@/components/shared/HoverHint';

import {ResourcePager} from '@/components/shared/ResourcePager';
import {useAuth} from '@/components/providers/AuthProvider';

import { PageContent } from '@/components/layout';
import { Input, Tag } from '@schema/ui-kit';
import { Search, ChevronDown, ChevronRight, ListTree, BookOpen, Dna } from 'lucide-react';
import * as React from 'react';
import { AppModal, ConfirmDialog, EmptyState, ModalSectionHeading } from '@/components/shared';
import { createGeneList, publishGeneList, deleteGeneList, listGeneLists, updateGeneList, type GeneList } from '@/lib/gene-lists';

// 删除确认弹窗
function DeleteConfirmModal({
  isOpen,
  listName,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  listName: string;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const t = useText();
  return (
    <ConfirmDialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title={t("pipeline.deleteGeneListb2d4a2")}
      message={t("pipeline.deleteThisCannotBeUndone8cd1e0", {p0: String(listName)})}
      variant="danger"
      onConfirm={onConfirm}
    />
  );
}

// 添加/编辑基因列表弹窗
function GeneListModal({
  isOpen,
  mode,
  initialData,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  mode: 'add' | 'edit';
  initialData?: { name: string; disease: string; description: string; genes: string };
  onClose: () => void;
  onSubmit: (data: { name: string; disease: string; description: string; genes: string }) => void | Promise<void>;
}) {
  const t = useText();
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState('');
  const [formData, setFormData] = React.useState({
    name: '',
    disease: '',
    description: '',
    genes: '',
  });

  React.useEffect(() => {
    if (isOpen && initialData) {
      setFormData(initialData);
    } else if (isOpen && !initialData) {
      setFormData({ name: '', disease: '', description: '', genes: '' });
    }
  }, [isOpen, initialData]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.genes || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await onSubmit(formData);
      handleClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? errorText(err, t) : t("pipeline.unableToSaveGeneList70d45a"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setSubmitError('');
    setFormData({ name: '', disease: '', description: '', genes: '' });
    onClose();
  };

  const geneCount = formData.genes
    ? formData.genes.split(/[\n,\s]+/).filter((g) => g.trim()).length
    : 0;

  return (
    <AppModal
      open={isOpen}
      onOpenChange={(open) => !open && handleClose()}
      title={mode === 'add' ? t("pipeline.addGeneList4dc7af") : t("pipeline.editGeneLista38c7b")}
      size="medium"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>{t("admin.cancel4d0b46")}</Button>
          <Button loading={submitting} action="save"
            variant="primary"
            onClick={handleSubmit}
            disabled={!formData.name || !formData.genes || submitting}

          >
            {submitting ? (mode === 'add' ? t("pipeline.addingfd2f5a") : t("admin.savingd70d42")) : (mode === 'add' ? t("pipeline.add94191c") : t("data.savefadf24"))}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {submitError && (
          <div role="alert" className="rounded-md border border-danger-muted bg-danger-subtle px-3 py-2 text-sm text-danger-fg">
            {submitError}
          </div>
        )}
        <section>
          <ModalSectionHeading
            icon={<BookOpen className="h-4 w-4" />}
            title={t("pipeline.listInformationace97e")}
          />
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-fg-muted">{t("pipeline.listName649bab")}</label>
                <Input aria-label={t("pipeline.listNameec6aba")} value={formData.name} onChange={(e) => handleChange('name', e.target.value)} placeholder={t("pipeline.forExampleCardiovascularDiseasePanel8fcc00")} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-fg-muted">{t("pipeline.associatedDiseaseOptional75e1de")}</label>
                <Input aria-label={t("history.associatedDiseasea79330")} value={formData.disease} onChange={(e) => handleChange('disease', e.target.value)} placeholder={t("pipeline.forExampleHereditaryCardiomyopathy008f6b")} />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-fg-muted">{t("admin.description412f54")}</label>
              <Input aria-label={t("admin.description412f54")} value={formData.description} onChange={(e) => handleChange('description', e.target.value)} placeholder={t("pipeline.describeTheListPurpose3961b4")} />
            </div>
          </div>
        </section>
        <section className="border-t border-[var(--yj-border-subtle)] pt-5">
          <ModalSectionHeading
            icon={<Dna className="h-4 w-4" />}
            title={t("pipeline.genes704a95")}
          />
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-medium text-fg-muted">{t("pipeline.geneListc7a031")}</label>
            {geneCount > 0 && <span className="text-xs text-fg-muted">{t("pipeline.identified967ac7")}{geneCount} {t("pipeline.genes23d3a3")}</span>}
          </div>
          <textarea
            aria-label={t("pipeline.geneList68a29a")}
            value={formData.genes}
            onChange={(e) => handleChange('genes', e.target.value)}
            placeholder={t("pipeline.oneGenePerLineOrSeparateWithec712e")}
            rows={8}
            className="w-full px-3 py-2 rounded-md border border-border-default bg-canvas-default text-fg-default text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
          />
          <p className="text-xs text-fg-muted mt-1">{t("pipeline.oneGenePerLineOrSeparateWith4ca7f8")}</p>
        </div>
        </section>
      </div>
    </AppModal>
  );
}

function GeneListPageContent() {
  const t = useText();
 const [page,setPage]=React.useState(1);
  const [searchQuery, setSearchQuery] = React.useState('');
 React.useEffect(()=>setPage(1),[searchQuery]);
  const [geneLists, setGeneLists] = React.useState<GeneList[]>([]);
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [modalMode, setModalMode] = React.useState<'add' | 'edit'>('add');
  const [editingList, setEditingList] = React.useState<GeneList | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<GeneList | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadController=React.useRef<AbortController|null>(null);
 const refreshGeneLists = React.useCallback(async () => {
 loadController.current?.abort();const controller=new AbortController();loadController.current=controller;
    setLoading(true);
    setError(null);
    try {
      const lists=await listGeneLists({},controller.signal);if(!controller.signal.aborted)setGeneLists(lists);
    } catch (err) {
      if(controller.signal.aborted)return;
 console.error('加载基因列表失败', err);
      setGeneLists([]);
      setError(t("pipeline.unableToLoadGeneListsRetryLaterf40993"));
    } finally {
      if(!controller.signal.aborted)setLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    refreshGeneLists();return()=>loadController.current?.abort();
  }, [refreshGeneLists]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleOpenAddModal = () => {
    setModalMode('add');
    setEditingList(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (list: GeneList) => {
    setModalMode('edit');
    setEditingList(list);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingList(null);
  };

  const handleSubmit = async (data: { name: string; disease: string; description: string; genes: string }) => {
    const genes = data.genes.split(/[\n,\s]+/).filter((g) => g.trim().toUpperCase());

    try {
      if (modalMode === 'add') {
        const newList = await createGeneList({
          name: data.name,
          disease: data.disease,
          description: data.description,
          genes,
        });
        setGeneLists((prev) => [newList, ...prev]);
      } else if (editingList) {
        const updated = await updateGeneList(editingList.id, {
          name: data.name,
          disease: data.disease,
          description: data.description,expectedRevision:editingList.revision,
          genes,
          category: editingList.category,
        });
        setGeneLists((prev) =>
          prev.map((list) => list.id === editingList.id ? updated : list)
        );
      }
    } catch (err) {
      console.error('保存基因列表失败', err);
      const message = err instanceof Error ? errorText(err, t) : t("pipeline.unableToSaveGeneListRetryLaterfc4859");
      setError(message);
      throw new Error(message);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteGeneList(deleteTarget.id);
      setGeneLists((prev) => prev.filter((l) => l.id !== deleteTarget.id));
      setDeleteTarget(null);
      setError(null);
    } catch (err) {
      console.error('Failed to delete gene list', err);
      const message = err instanceof Error ? errorText(err, t) : t("interface.failedToDeleteGeneListc06131");
      setError(message);
      throw new Error(message);
    }
  };

  const filteredLists = React.useMemo(() => {
    if (!searchQuery) return geneLists;

    const query = searchQuery.toLowerCase();
    return geneLists.filter(
      (l) =>
        l.name.toLowerCase().includes(query) ||
        l.disease.toLowerCase().includes(query) ||
        l.description.toLowerCase().includes(query) ||
        l.genes.some((g) => g.toLowerCase().includes(query))
    );
  }, [searchQuery, geneLists]);

  return (
    <PageContent className="yj-page-shell">
      <div className="yj-page-header">
        <h2 className="yj-page-title">{t("pipeline.geneListManagement58f754")}</h2>
      </div>

      <div className="yj-toolbar-panel">
        <div className="w-full sm:w-64">
          <Input
            placeholder={t("pipeline.searchGeneLists4fa7b6")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftElement={<Search className="w-4 h-4" />}
          />
        </div>
        <Button action="add" variant="primary"  onClick={handleOpenAddModal}>
          {t("pipeline.addGeneList4dc7af")}</Button>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-danger-muted bg-danger-subtle px-3 py-2 text-sm text-danger-fg">
          {error}<ActionButton action="retry" variant="ghost" type="button" className="yj-tool-button ml-3" disabled={loading} onClick={() => void refreshGeneLists()}>{t("billing.retryLoading7b4939")}</ActionButton>
        </div>
      )}

      {loading && (
        <div className="text-sm text-fg-muted">{t("pipeline.loadingGeneLists3de2c2")}</div>
      )}

      {/* 列表展示 */}
      <div className="yj-list-panel">
        <div className="divide-y divide-border">
          {filteredLists.slice((page-1)*20,page*20).map((list) => {
            const isExpanded = expandedIds.has(list.id);
            return (
              <div key={list.id}>
                {/* 主行 */}
                <div
                  className="yj-list-row grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center"
                  onClick={() => toggleExpand(list.id)}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <button type="button" aria-label={`${isExpanded ? t("pipeline.collapse5d5815") : t("pipeline.expandb0e248")}${list.name}`} aria-expanded={isExpanded} className="mt-0.5 shrink-0 p-0.5 text-fg-muted">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="min-w-0 break-words text-sm font-medium leading-5 text-fg-default">{list.name}</span>
                        {list.disease && list.disease !== list.name && <Tag variant="neutral" className="max-w-full whitespace-normal break-all">{list.disease}</Tag>}
                        <span className="shrink-0 whitespace-nowrap text-xs text-fg-muted">{list.genes.length} {t("pipeline.genes23d3a3")}</span>
                      </div>
                      {list.description && <p className="text-xs text-fg-muted truncate">{list.description}</p>}
                    </div>
                  </div>
                  <div className="col-start-1 row-start-2 min-w-0 break-words pl-7 text-xs text-fg-muted md:col-start-2 md:row-start-1 md:pl-0">
                    {t("pipeline.updated943f4e")}{Number.isNaN(Date.parse(list.updatedAt)) ? list.updatedAt : new Date(list.updatedAt).toLocaleString(t.locale, {hour12:false})}
                  </div>
                  <div className="col-start-2 row-start-1 flex shrink-0 items-center gap-1 md:col-start-3" onClick={(e) => e.stopPropagation()}>
                    {list.scope==='personal'&&list.canMaintain&&<Button size="small" variant="secondary" onClick={async()=>{try{await publishGeneList(list);await refreshGeneLists();}catch(e){setError(e instanceof Error ? errorText(e, t):t("pipeline.sharingFailed3a7680"))}}}>{t("pipeline.shareWithCurrentOrganizationa13f3c")}</Button>}
                    <HoverHint content={t("admin.edita7f814")}><ActionButton size="small" iconOnly action="edit" variant="ghost"
                      className="p-1.5 rounded hover:bg-canvas-subtle text-fg-muted hover:text-accent-fg transition-colors"

                      disabled={!list.canMaintain} onClick={() => handleOpenEditModal(list)}
                     /></HoverHint>
                    <HoverHint content={t("data.delete3755f5")}><ActionButton size="small" iconOnly action="delete" variant="ghost"
                      className="p-1.5 rounded hover:bg-danger-subtle text-fg-muted hover:text-danger-fg transition-colors"

                      disabled={!list.canMaintain} onClick={() => setDeleteTarget(list)}
                     /></HoverHint>
                  </div>
                </div>

 {/* 展开的基因列表 */}
                {isExpanded && (
                  <div className="px-4 py-3 bg-canvas-subtle border-t border-border">
                    <div className="flex flex-wrap gap-2">
                      {list.genes.map((gene) => (
                        <Tag key={gene} variant="neutral">
                          {gene}
                        </Tag>
                      ))}
                    </div>
                    {list.genes.length === 0 && (
                      <EmptyState
                        className="min-h-[120px] py-6"
                        icon={<ListTree />}
                        title={t("pipeline.noGenese90f51")}
                        description={t("pipeline.editThisListToAddGenes34850c")}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!loading && !error && filteredLists.length === 0 && (
          <EmptyState
            className="min-h-[220px]"
            icon={<ListTree />}
            title={searchQuery.trim() ? t("pipeline.noMatchingGeneLists1fc060") : t("pipeline.noGeneLists280b1e")}
            description={searchQuery.trim() ? t("pipeline.adjustYourSearchAndRetryf591c7") : t("pipeline.addAGeneListToFilterLoci574e8e")}
          />
        )}
      </div>

      <ResourcePager page={page} total={filteredLists.length} onChange={setPage} />
      <GeneListModal
        isOpen={isModalOpen}
        mode={modalMode}
        initialData={
          editingList
            ? {
                name: editingList.name,
                disease: editingList.disease,
                description: editingList.description,
                genes: editingList.genes.join('\n'),
              }
            : undefined
        }
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
      />

      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        listName={deleteTarget?.name || ''}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </PageContent>
  );
}

export default function GeneListPage(){const {user,currentOrg}=useAuth();return <GeneListPageContent key={`${user?.id??""}:${currentOrg?.id??""}`} />;}
