'use client';

import { PageContent } from '@/components/layout';
import { Button, Input, Tag } from '@schema/ui-kit';
import { Plus, Search, Pencil, Trash2, ChevronDown, ChevronRight, ListTree, BookOpen, Dna, Loader2 } from 'lucide-react';
import * as React from 'react';
import { AppModal, ConfirmDialog, EmptyState, ModalSectionHeading } from '@/components/shared';
import { createGeneList, deleteGeneList, listGeneLists, updateGeneList, type GeneList } from '@/lib/gene-lists';

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
  return (
    <ConfirmDialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title="删除基因列表"
      message={`确定要删除 "${listName}" 吗？此操作无法撤销。`}
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
    if (!formData.name || !formData.disease || !formData.genes || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await onSubmit(formData);
      handleClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save gene list');
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
      title={mode === 'add' ? '添加基因列表' : '编辑基因列表'}
      size="medium"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>取消</Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!formData.name || !formData.disease || !formData.genes || submitting}
            leftIcon={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
          >
            {submitting ? (mode === 'add' ? '添加中...' : '保存中...') : (mode === 'add' ? '添加' : '保存')}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {submitError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {submitError}
          </div>
        )}
        <section>
          <ModalSectionHeading
            icon={<BookOpen className="h-4 w-4" />}
            title="列表信息"
            description="设置基因列表的名称、关联疾病和用途"
          />
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-fg-muted">列表名称 *</label>
                <Input value={formData.name} onChange={(e) => handleChange('name', e.target.value)} placeholder="如：心血管疾病 Panel" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-fg-muted">关联疾病 *</label>
                <Input value={formData.disease} onChange={(e) => handleChange('disease', e.target.value)} placeholder="如：遗传性心肌病" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-fg-muted">描述</label>
              <Input value={formData.description} onChange={(e) => handleChange('description', e.target.value)} placeholder="列表用途说明" />
            </div>
          </div>
        </section>
        <section className="border-t border-[var(--yj-border-subtle)] pt-5">
          <ModalSectionHeading
            icon={<Dna className="h-4 w-4" />}
            title="基因内容"
            description="粘贴或输入标准基因符号，系统会自动识别分隔符"
          />
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-medium text-fg-muted">基因列表 *</label>
            {geneCount > 0 && <span className="text-xs text-fg-muted">已识别 {geneCount} 个基因</span>}
          </div>
          <textarea
            value={formData.genes}
            onChange={(e) => handleChange('genes', e.target.value)}
            placeholder={"每行一个基因名，或用逗号/空格分隔\n例如：\nMYH7\nMYBPC3\nTNNT2"}
            rows={8}
            className="w-full px-3 py-2 rounded-md border border-border-default bg-canvas-default text-fg-default text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
          />
          <p className="text-xs text-fg-muted mt-1">支持每行一个基因，或用逗号、空格、Tab 分隔</p>
        </div>
        </section>
      </div>
    </AppModal>
  );
}

export default function GeneListPage() {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [geneLists, setGeneLists] = React.useState<GeneList[]>([]);
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [modalMode, setModalMode] = React.useState<'add' | 'edit'>('add');
  const [editingList, setEditingList] = React.useState<GeneList | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<GeneList | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refreshGeneLists = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setGeneLists(await listGeneLists());
    } catch (err) {
      console.error('加载基因列表失败', err);
      setGeneLists([]);
      setError('加载基因列表失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refreshGeneLists();
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
          description: data.description || `${data.name} 基因列表`,
          genes,
        });
        setGeneLists((prev) => [newList, ...prev]);
      } else if (editingList) {
        const updated = await updateGeneList(editingList.id, {
          name: data.name,
          disease: data.disease,
          description: data.description || editingList.description,
          genes,
          category: editingList.category,
        });
        setGeneLists((prev) =>
          prev.map((list) => list.id === editingList.id ? updated : list)
        );
      }
    } catch (err) {
      console.error('保存基因列表失败', err);
      const message = err instanceof Error ? err.message : '保存基因列表失败，请稍后重试';
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
      const message = err instanceof Error ? err.message : 'Failed to delete gene list';
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
        <h2 className="yj-page-title">基因列表管理</h2>
      </div>

      <div className="yj-toolbar-panel">
        <div className="w-64">
          <Input
            placeholder="搜索基因列表..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftElement={<Search className="w-4 h-4" />}
          />
        </div>
        <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />} onClick={handleOpenAddModal}>
          添加基因列表
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-sm text-fg-muted">加载基因列表...</div>
      )}

      {/* 列表展示 */}
      <div className="yj-list-panel">
        <div className="divide-y divide-border">
          {filteredLists.map((list) => {
            const isExpanded = expandedIds.has(list.id);
            return (
              <div key={list.id}>
                {/* 主行 */}
                <div
                  className="yj-list-row px-4 py-3 flex items-center justify-between cursor-pointer"
                  onClick={() => toggleExpand(list.id)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button className="p-0.5 text-fg-muted">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-fg-default">{list.name}</span>
                        <Tag variant="info">{list.disease}</Tag>
                        <span className="text-xs text-fg-muted">{list.genes.length} 个基因</span>
                      </div>
                      <p className="text-xs text-fg-muted truncate">{list.description}</p>
                    </div>
                    <div className="text-xs text-fg-muted shrink-0">
                      <span>更新: {list.updatedAt}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-4 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors"
                      title="编辑"
                      onClick={() => handleOpenEditModal(list)}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                      title="删除"
                      onClick={() => setDeleteTarget(list)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
                        title="暂无基因"
                        description="编辑该列表后可添加基因。"
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!loading && filteredLists.length === 0 && (
          <EmptyState
            className="min-h-[220px]"
            icon={<ListTree />}
            title="暂无基因列表"
            description="调整搜索条件，或添加一个新的基因列表。"
          />
        )}
      </div>

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
