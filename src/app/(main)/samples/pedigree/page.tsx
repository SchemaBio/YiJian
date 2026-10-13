'use client';
import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';
import { localizeDisplay } from '@/i18n/text';

import { ActionButton as Button, ActionButton, IconActionButton } from '@/components/shared/ActionButton';


import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Input, DataTable, Tag } from '@schema/ui-kit';
import type { Column } from '@schema/ui-kit';
import { Search, List, UserPlus, GitBranch, Trash2, Pencil } from 'lucide-react';
import { PedigreeTree, MemberDetailPanel, AddMemberModal, LinkSampleModal, NewPedigreeModal, EditPedigreeModal, ConfirmDialog, EditMemberModal, ContextMenu } from './components';
import type { ContextMenuItem } from './components';
import type { NewPedigreeFormData } from './components/NewPedigreeModal';
import type { EditPedigreeFormData } from './components/EditPedigreeModal';
import type { PedigreeListItem, Pedigree, PedigreeMember, RelationType } from './types';
import { listSamples } from '@/lib/samples';
import {
  createPedigree,
  createPedigreeMember,
  deletePedigree,
  deletePedigreeMember,
  getPedigree,
  listPedigrees,
  setPedigreeProband,
  updatePedigree,
  updatePedigreeMember,
} from '@/lib/pedigrees';

interface OpenTab {
  id: string;
  pedigreeId: string;
  name: string;  // 显示名称（使用 internalId）
}

// 格式化日期工具函数
function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export default function PedigreePage() {
  const t = useText();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [openTabs, setOpenTabs] = React.useState<OpenTab[]>([]);
  const [activeTabId, setActiveTabId] = React.useState<string | null>(null);

  // 当前查看的家系详情
  const [currentPedigree, setCurrentPedigree] = React.useState<Pedigree | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [pedigrees, setPedigrees] = React.useState<PedigreeListItem[]>([]);
  const [listLoading, setListLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // 选中的成员
  const [selectedMember, setSelectedMember] = React.useState<PedigreeMember | null>(null);

  // 添加成员弹窗
  const [isAddMemberOpen, setIsAddMemberOpen] = React.useState(false);

  // 编辑模式
  const [isEditMode, setIsEditMode] = React.useState(false);

  // 关联样本弹窗
  const [isLinkSampleOpen, setIsLinkSampleOpen] = React.useState(false);
  const [linkingMemberId, setLinkingMemberId] = React.useState<string | null>(null);

  // 新建家系弹窗
  const [isNewPedigreeOpen, setIsNewPedigreeOpen] = React.useState(false);

  // 编辑家系弹窗
  const [isEditPedigreeOpen, setIsEditPedigreeOpen] = React.useState(false);
  const [editingPedigree, setEditingPedigree] = React.useState<PedigreeListItem | null>(null);

  // 删除家系确认弹窗
  const [isDeletePedigreeOpen, setIsDeletePedigreeOpen] = React.useState(false);
  const [deletingPedigreeId, setDeletingPedigreeId] = React.useState<string | null>(null);

  // 删除成员确认弹窗
  const [isDeleteMemberOpen, setIsDeleteMemberOpen] = React.useState(false);
  const [deletingMemberId, setDeletingMemberId] = React.useState<string | null>(null);

  // 编辑成员弹窗
  const [isEditMemberOpen, setIsEditMemberOpen] = React.useState(false);
  const [editingMember, setEditingMember] = React.useState<PedigreeMember | null>(null);

  // 上下文菜单
  const [contextMenu, setContextMenu] = React.useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    member: PedigreeMember | null;
  }>({ isOpen: false, position: { x: 0, y: 0 }, member: null });

  // 添加成员预填充提示
  const [addMemberHint, setAddMemberHint] = React.useState<{
    defaultFatherId?: string;
    defaultMotherId?: string;
    defaultRelation?: RelationType;
    defaultSpouseId?: string;
  } | null>(null);

  // 防止重复打开家系
  const processedPedigreeId = React.useRef<string | null>(null);

  const refreshPedigrees = React.useCallback(async () => {
    setListLoading(true);
    setError(null);
    try {
      setPedigrees(await listPedigrees());
    } catch (err) {
      console.error('加载家系列表失败', err);
      setPedigrees([]);
      setError(t("samples.unableToLoadPedigreesRetryLater7f2627"));
    } finally {
      setListLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    refreshPedigrees();
  }, [refreshPedigrees]);

  const refreshCurrentPedigree = React.useCallback(async (pedigreeId: string) => {
    setLoading(true);
    setError(null);
    try {
      const detail = await getPedigree(pedigreeId);
      setCurrentPedigree(detail);
      return detail;
    } catch (err) {
      console.error('加载家系详情失败', err);
      setCurrentPedigree(null);
      setError(t("samples.unableToLoadPedigreeDetailsRetryLater21aae1"));
      return null;
    } finally {
      setLoading(false);
    }
  }, [t]);

  // 处理 URL 参数，自动打开对应家系或关闭所有标签
  React.useEffect(() => {
    const pedigreeId = searchParams.get('id');
    const reset = searchParams.get('reset');

    // 如果有 reset 参数，关闭所有标签返回列表视图
    if (reset === '1') {
      setOpenTabs([]);
      setActiveTabId(null);
      setCurrentPedigree(null);
      setSelectedMember(null);
      processedPedigreeId.current = null;
      return;
    }

    // 否则处理打开家系
    if (pedigreeId && pedigreeId !== processedPedigreeId.current) {
      const pedigree = pedigrees.find(p => p.id === pedigreeId);
      if (pedigree) {
        processedPedigreeId.current = pedigreeId;
        handleOpenTabById(pedigreeId, pedigree.internalId);
      }
    }
  }, [searchParams, pedigrees]);

  // 通过 ID 打开家系标签
  const handleOpenTabById = async (pedigreeId: string, name: string) => {
    const existingTab = openTabs.find(t => t.pedigreeId === pedigreeId);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      await refreshCurrentPedigree(pedigreeId);
      return;
    }

    const newTab: OpenTab = {
      id: `tab-${Date.now()}`,
      pedigreeId,
      name,
    };
    setOpenTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);

    await refreshCurrentPedigree(pedigreeId);
    setSelectedMember(null);
  };

  // 打开家系详情标签
  const handleOpenTab = React.useCallback(async (pedigree: PedigreeListItem) => {
    const existingTab = openTabs.find(t => t.pedigreeId === pedigree.id);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      // 加载详情
      await refreshCurrentPedigree(pedigree.id);
      return;
    }

    const newTab: OpenTab = {
      id: `tab-${Date.now()}`,
      pedigreeId: pedigree.id,
      name: pedigree.internalId,
    };
    setOpenTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);

    // 加载详情
    await refreshCurrentPedigree(pedigree.id);
    setSelectedMember(null);
  }, [openTabs, refreshCurrentPedigree, t]);

  // 切换标签
  const handleSwitchTab = React.useCallback(async (tabId: string) => {
    setActiveTabId(tabId);
    const tab = openTabs.find(t => t.id === tabId);
    if (tab) {
      await refreshCurrentPedigree(tab.pedigreeId);
      setSelectedMember(null);
    }
  }, [openTabs, refreshCurrentPedigree, t]);

  // 关闭标签
  const handleCloseTab = React.useCallback((tabId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setOpenTabs(prev => {
      const newTabs = prev.filter(t => t.id !== tabId);
      if (activeTabId === tabId && newTabs.length > 0) {
        const lastTab = newTabs[newTabs.length - 1];
        setActiveTabId(lastTab.id);
        refreshCurrentPedigree(lastTab.pedigreeId);
      } else if (newTabs.length === 0) {
        setActiveTabId(null);
        setCurrentPedigree(null);
      }
      return newTabs;
    });
    setSelectedMember(null);
  }, [activeTabId, refreshCurrentPedigree, t]);

  // 添加成员
  const handleAddMember = async (memberData: Omit<PedigreeMember, 'id' | 'generation' | 'position'>) => {
    if (!currentPedigree) return;

    // 计算 generation
    let generation = 0;
    if (memberData.fatherId || memberData.motherId) {
      const parentGen = Math.max(
        memberData.fatherId ? (currentPedigree.members.find(m => m.id === memberData.fatherId)?.generation ?? 0) : -Infinity,
        memberData.motherId ? (currentPedigree.members.find(m => m.id === memberData.motherId)?.generation ?? 0) : -Infinity
      );
      generation = parentGen + 1;
    }

    const position = currentPedigree.members.filter(m => m.generation === generation).length;

    try {
      const newMember = await createPedigreeMember(currentPedigree.id, {
        ...memberData,
        generation,
        position,
      });

      setCurrentPedigree(prev => {
        if (!prev) return null;

        let updatedMembers = [...prev.members, { ...newMember, spouseIds: memberData.spouseIds }];

        // 处理配偶双向关联（前端展示字段，后端当前无 spouse_ids 字段）
        if (memberData.spouseIds && memberData.spouseIds.length > 0) {
          updatedMembers = updatedMembers.map(m => {
            if (memberData.spouseIds!.includes(m.id)) {
              return { ...m, spouseIds: [...(m.spouseIds || []), newMember.id] };
            }
            return m;
          });
        }

        return {
          ...prev,
          members: updatedMembers,
        };
      });
      refreshPedigrees();
      setAddMemberHint(null);
    } catch (err) {
      console.error('Failed to add pedigree member', err);
      const message = err instanceof Error ? errorText(err, t) : t("interface.failedToAddPedigreeMember72dac0");
      setError(message);
      throw new Error(message);
    }
  };

  // 打开关联样本弹窗
  const handleOpenLinkSample = (memberId: string) => {
    setLinkingMemberId(memberId);
    setIsLinkSampleOpen(true);
  };

  // 关联样本到成员
  const handleLinkSample = async (sampleId: string) => {
    if (!currentPedigree || !linkingMemberId) return;
    const member = currentPedigree.members.find(m => m.id === linkingMemberId);
    if (!member) return;

    try {
      const updated = await updatePedigreeMember(currentPedigree.id, linkingMemberId, { ...member, sampleId });

      setCurrentPedigree(prev => prev ? {
        ...prev,
        members: prev.members.map(m =>
          m.id === linkingMemberId ? { ...m, ...updated } : m
        ),
      } : null);

      if (selectedMember?.id === linkingMemberId) {
        setSelectedMember(prev => prev ? { ...prev, ...updated } : null);
      }
      refreshPedigrees();
      setLinkingMemberId(null);
    } catch (err) {
      console.error('Failed to link sample', err);
      const message = err instanceof Error ? errorText(err, t) : t("interface.failedToLinkSampleb2877a");
      setError(message);
      throw new Error(message);
    }
  };

  const handleCreatePedigree = async (data: NewPedigreeFormData) => {
    setError(null);
    try {
      const samples = await listSamples();
      const probandSample = samples.find(s => s.id === data.probandSampleId);
      if (!probandSample) {
        const message = t("samples.probandSampleNotFoundeee120");
        setError(message);
        throw new Error(message);
      }

      const created = await createPedigree({
        internalId: data.internalId,
        clinicalDiagnosis: data.clinicalDiagnosis,
        remark: data.remark,
      });
      const probandMember = await createPedigreeMember(created.id, {
        sampleId: data.probandSampleId,
        name: probandSample.internalId || t("samples.probandc8c1fa"),
        gender: probandSample.gender,
        relation: 'proband',
        affectedStatus: 'affected',
        generation: 0,
        position: 0,
      });
      const newPedigree = await setPedigreeProband(created.id, probandMember.id);

      // 打开新创建的家系
      const newTab: OpenTab = {
        id: `tab-${Date.now()}`,
        pedigreeId: created.id,
        name: data.internalId,
      };
      setOpenTabs(prev => [...prev, newTab]);
      setActiveTabId(newTab.id);
      setCurrentPedigree(newPedigree);
      setSelectedMember(null);
      setIsEditMode(true); // 自动进入编辑模式
      refreshPedigrees();
    } catch (err) {
      console.error('创建家系失败', err);
      const message = err instanceof Error ? errorText(err, t) : t("samples.unableToCreatePedigreeRetryLaterf46831");
      setError(message);
      throw new Error(message);
    }
  };

  // 打开编辑家系弹窗
  const handleOpenEditPedigree = (pedigree: PedigreeListItem) => {
    setEditingPedigree(pedigree);
    setIsEditPedigreeOpen(true);
  };

  // 编辑家系
  const handleEditPedigree = async (id: string, data: EditPedigreeFormData) => {
    try {
      await updatePedigree(id, {
        internalId: data.internalId,
        clinicalDiagnosis: data.clinicalDiagnosis,
        remark: data.remark,
      });

      // 1. 更新 currentPedigree（如果匹配）
      if (currentPedigree?.id === id) {
        await refreshCurrentPedigree(id);
      }

      // 2. 更新 tab 名称（如果 internalId 变化）
      setOpenTabs(prev => prev.map(tab =>
        tab.pedigreeId === id ? { ...tab, name: data.internalId } : tab
      ));

      refreshPedigrees();
      setIsEditPedigreeOpen(false);
      setEditingPedigree(null);
    } catch (err) {
      console.error('Failed to update pedigree', err);
      const message = err instanceof Error ? errorText(err, t) : t("interface.failedToUpdatePedigree805c6a");
      setError(message);
      throw new Error(message);
    }
  };

  // 删除家系
  const handleDeletePedigree = async () => {
    if (!deletingPedigreeId) return;

    try {
      await deletePedigree(deletingPedigreeId);

      const tabToClose = openTabs.find(t => t.pedigreeId === deletingPedigreeId);
      if (tabToClose) {
        handleCloseTab(tabToClose.id);
      }

      refreshPedigrees();
      setIsDeletePedigreeOpen(false);
      setDeletingPedigreeId(null);
    } catch (err) {
      console.error('Failed to delete pedigree', err);
      const message = err instanceof Error ? errorText(err, t) : t("interface.failedToDeletePedigree36d271");
      setError(message);
      throw new Error(message);
    }
  };

  const handleOpenDeletePedigree = (pedigreeId: string) => {
    setDeletingPedigreeId(pedigreeId);
    setIsDeletePedigreeOpen(true);
  };

  // 删除成员（含孤儿引用清理）
  const handleConfirmDeleteMember = async () => {
    if (!currentPedigree || !deletingMemberId) return;

    const memberToDelete = currentPedigree.members.find(m => m.id === deletingMemberId);
    if (memberToDelete?.relation === 'proband') {
      const message = 'Cannot delete the proband; set another member as proband first.';
      setError(message);
      throw new Error(message);
    }

    try {
      await deletePedigreeMember(currentPedigree.id, deletingMemberId);

      setCurrentPedigree(prev => {
        if (!prev) return null;

        const updatedMembers = prev.members
          .filter(m => m.id !== deletingMemberId)
          .map(m => ({
            ...m,
            fatherId: m.fatherId === deletingMemberId ? undefined : m.fatherId,
            motherId: m.motherId === deletingMemberId ? undefined : m.motherId,
            spouseIds: m.spouseIds?.filter(id => id !== deletingMemberId),
          }));

        return {
          ...prev,
          members: updatedMembers,
        };
      });
      refreshPedigrees();

      if (selectedMember?.id === deletingMemberId) {
        setSelectedMember(null);
      }

      setIsDeleteMemberOpen(false);
      setDeletingMemberId(null);
    } catch (err) {
      console.error('Failed to delete pedigree member', err);
      const message = err instanceof Error ? errorText(err, t) : t("interface.failedToDeletePedigreeMember1b79d8");
      setError(message);
      throw new Error(message);
    }
  };

  const handleEditMember = async (memberId: string, updates: Partial<PedigreeMember>) => {
    if (!currentPedigree) return;
    const oldMember = currentPedigree.members.find(m => m.id === memberId);
    if (!oldMember) return;

    try {
      const updatedMember = await updatePedigreeMember(currentPedigree.id, memberId, { ...oldMember, ...updates });

      setCurrentPedigree(prev => {
        if (!prev) return null;

        let updatedMembers = prev.members.map(m =>
          m.id === memberId ? { ...m, ...updatedMember, spouseIds: updates.spouseIds } : m
        );

        // 处理配偶双向同步（前端展示字段，后端当前无 spouse_ids 字段）
        if (updates.spouseIds && oldMember) {
          const removedSpouses = (oldMember.spouseIds || []).filter(
            id => !(updates.spouseIds || []).includes(id)
          );
          const addedSpouses = (updates.spouseIds || []).filter(
            id => !(oldMember.spouseIds || []).includes(id)
          );

          updatedMembers = updatedMembers.map(m => {
            if (removedSpouses.includes(m.id)) {
              return { ...m, spouseIds: (m.spouseIds || []).filter(id => id !== memberId) };
            }
            if (addedSpouses.includes(m.id)) {
              return { ...m, spouseIds: [...(m.spouseIds || []), memberId] };
            }
            return m;
          });
        }

        return { ...prev, members: updatedMembers, updatedAt: formatDate(new Date()) };
      });

      // 同步选中成员
      if (selectedMember?.id === memberId) {
        setSelectedMember(prev => prev ? { ...prev, ...updatedMember, spouseIds: updates.spouseIds } : null);
      }
      refreshPedigrees();
    } catch (err) {
      console.error('Failed to update pedigree member', err);
      const message = err instanceof Error ? errorText(err, t) : t("interface.failedToUpdatePedigreeMemberd62176");
      setError(message);
      throw new Error(message);
    }
  };

  // 上下文菜单处理
  const handleContextMenu = (member: PedigreeMember, position: { x: number; y: number }) => {
    setContextMenu({ isOpen: true, position, member });
    setSelectedMember(member);
  };

  // 双击编辑
  const handleDoubleClick = (member: PedigreeMember) => {
    if (!isEditMode) return;
    setEditingMember(member);
    setIsEditMemberOpen(true);
  };

  // 设为先证者
  const handleSetProband = async (memberId: string) => {
    if (!currentPedigree) return;
    try {
      const updated = await setPedigreeProband(currentPedigree.id, memberId);
      setCurrentPedigree(updated);
      refreshPedigrees();
    } catch (err) {
      console.error('设置先证者失败', err);
      setError(t("samples.unableToSetProbandRetryLater7b1559"));
    }
  };

  // 上下文菜单项
  const contextMenuItems: ContextMenuItem[] = React.useMemo(() => {
    if (!contextMenu.member || !isEditMode) return [];
    const member = contextMenu.member;
    return [
      {
        label: t("samples.editMemberab5fcb"),
        icon: <Pencil className="w-4 h-4" />,
        onClick: () => {
          setEditingMember(member);
          setIsEditMemberOpen(true);
        },
      },
      { separator: true },
      {
        label: t("samples.addChildd34103"),
        icon: <UserPlus className="w-4 h-4" />,
        onClick: () => {
          setAddMemberHint({
            defaultFatherId: member.gender === 'male' ? member.id : member.spouseIds?.[0],
            defaultMotherId: member.gender === 'female' ? member.id : member.spouseIds?.[0],
            defaultRelation: 'child' as RelationType,
          });
          setIsAddMemberOpen(true);
        },
      },
      {
        label: t("samples.addSibling0add2e"),
        icon: <UserPlus className="w-4 h-4" />,
        onClick: () => {
          setAddMemberHint({
            defaultFatherId: member.fatherId,
            defaultMotherId: member.motherId,
            defaultRelation: 'sibling' as RelationType,
          });
          setIsAddMemberOpen(true);
        },
      },
      {
        label: t("samples.addSpouse5e8688"),
        icon: <UserPlus className="w-4 h-4" />,
        onClick: () => {
          setAddMemberHint({
            defaultRelation: 'spouse' as RelationType,
            defaultSpouseId: member.id,
          });
          setIsAddMemberOpen(true);
        },
      },
      { separator: true },
      {
        label: t("samples.setAsProband5e864f"),
        icon: <GitBranch className="w-4 h-4" />,
        onClick: () => handleSetProband(member.id),
        disabled: member.id === currentPedigree?.probandId,
      },
      { separator: true },
      {
        label: t("samples.deleteMembera045fb"),
        icon: <Trash2 className="w-4 h-4" />,
        onClick: () => {
          setDeletingMemberId(member.id);
          setIsDeleteMemberOpen(true);
        },
        danger: true,
        disabled: member.relation === 'proband',
      },
    ];
  }, [contextMenu.member, isEditMode, currentPedigree, t]);

  // 筛选家系
  const filteredPedigrees = React.useMemo(() => {
    if (!searchQuery) return pedigrees;
    const query = searchQuery.toLowerCase();
    return pedigrees.filter(
      (p) => p.id.toLowerCase().includes(query) ||
             p.internalId.toLowerCase().includes(query) ||
             p.sampleInternalIds.some(id => id.toLowerCase().includes(query))
    );
  }, [pedigrees, searchQuery]);

  // 下载模板
  const handleDownloadTemplate = () => {
    const templateContent = t("samples.pedigreeInternalIdBatchSampleInternalIda7394e");
    const blob = new Blob(['\ufeff' + templateContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = t("samples.pedigreeImportTemplateCsvd709c6");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 表格列定义
  const columns: Column<PedigreeListItem>[] = [
    {
      id: 'id',
      header: t("samples.pedigreeIdec299d"),
      accessor: (row) => (
        <button
          type="button"
          className="text-sm text-accent-fg hover:underline"
          onClick={(e) => { e.stopPropagation(); handleOpenTab(row); }}
        >
          {row.internalId}
        </button>
      ),
      width: 100,
      align: 'center',
    },
    {
      id: 'internalId',
      header: t("samples.systemId17b196"),
      accessor: (row) => <span className="font-mono text-xs">{row.id.substring(0, 8)}</span>,
      width: 90,
      align: 'center',
    },
    {
      id: 'batch',
      header: t("samples.batch6b2cf2"),
      accessor: (row) => row.batch || '-',
      width: 120,
      align: 'center',
    },
    {
      id: 'sampleIds',
      header: t("history.sampleId6d686e"),
      accessor: (row) => (
        <div className="text-sm space-y-0.5">
          {row.sampleIds.length > 0 ? (
            row.sampleIds.map((id, index) => (
              <div
                key={id}
                className={`font-mono text-xs ${id === row.probandSampleId ? 'text-accent-fg font-semibold' : 'text-fg-default'}`}
              >
                {id.substring(0, 8)}
              </div>
            ))
          ) : (
            <span className="text-fg-muted">-</span>
          )}
        </div>
      ),
      width: 120,
      align: 'center',
    },
    {
      id: 'sampleInternalIds',
      header: t("samples.sampleInternalIdf3c5b6"),
      accessor: (row) => (
        <div className="text-sm space-y-0.5">
          {row.sampleInternalIds.length > 0 ? (
            row.sampleInternalIds.map((id, index) => (
              <div
                key={id}
                className={`text-xs ${row.sampleIds[index] === row.probandSampleId ? 'text-accent-fg font-semibold' : 'text-fg-default'}`}
              >
                {id}
              </div>
            ))
          ) : (
            <span className="text-fg-muted">-</span>
          )}
        </div>
      ),
      width: 100,
      align: 'center',
    },
    {
      id: 'clinicalDiagnosis',
      header: t("samples.clinicalDiagnosis654a81"),
      accessor: (row) => row.clinicalDiagnosis || '-',
      width: 140,
    },
    {
      id: 'remark',
      header: t("admin.notese03614"),
      accessor: (row) => (
        <span className={row.remark ? 'text-fg-default truncate block max-w-[100px]' : 'text-fg-muted'}>
          {row.remark || '-'}
        </span>
      ),
      width: 100,
    },
    { id: 'updatedAt', header: t("pipeline.updatedAt093dea"), accessor: (row) => row.updatedAt && Number.isFinite(Date.parse(row.updatedAt)) ? new Date(row.updatedAt).toLocaleString(t.locale, { hour12: false }) : '-', width: 150 },
    {
      id: 'actions',
      header: t("admin.actionsf3ea6d"),
      accessor: (row) => (
        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
          <IconActionButton label={t("admin.edita7f814")} action="edit" variant="ghost"
            className="p-1.5 rounded text-fg-muted hover:text-accent-fg hover:bg-accent-subtle transition-colors"
            onClick={() => handleOpenEditPedigree(row)}

           />
          <IconActionButton label={t("data.delete3755f5")} action="delete" variant="ghost"
            className="p-1.5 rounded text-fg-muted hover:text-danger-fg hover:bg-danger-subtle transition-colors"
            onClick={() => handleOpenDeletePedigree(row.id)}

           />
        </div>
      ),
      width: 70,
      align: 'center',
    },
  ];

  const activeTab = openTabs.find(t => t.id === activeTabId);
  const hasOpenTabs = openTabs.length > 0;

  return (
    <div className="relative flex h-[calc(100dvh-3.5rem)] min-w-0 md:h-full">
      {/* 左侧家系列表 */}
      {hasOpenTabs ? (
        <div className="hidden md:flex w-56 flex-shrink-0 border-r border-border-default bg-canvas-subtle flex-col">
            <div className="px-3 py-2 border-b border-border-default flex items-center gap-2">
              <List className="w-4 h-4 text-fg-muted" />
              <span className="text-sm font-medium text-fg-default">{t("samples.pedigreeList4e74d4")}</span>
            </div>
            <div className="p-2 border-b border-border-default">
              <Input placeholder={t("history.search16ad6d")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} leftElement={<Search className="w-3.5 h-3.5" />} className="text-xs" />
            </div>
            <div className="flex-1 overflow-auto">
              {filteredPedigrees.map((pedigree) => {
                const isOpen = openTabs.some(t => t.pedigreeId === pedigree.id);
                const isActive = activeTab?.pedigreeId === pedigree.id;
                return (
                  <div key={pedigree.id} onClick={() => handleOpenTab(pedigree)} className={`px-3 py-2 cursor-pointer border-b border-border-muted transition-colors ${isActive ? 'bg-accent-subtle border-l-2 border-l-accent-emphasis' : isOpen ? 'bg-canvas-inset' : 'hover:bg-canvas-inset'}`}>
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-3 h-3 text-fg-muted" />
                      <span className={`truncate text-sm ${isActive ? 'text-accent-fg font-medium' : 'text-fg-default'}`}>{pedigree.internalId}</span>
                    </div>
                    <div className="text-xs text-fg-muted ml-5 truncate">{pedigree.sampleIds.length} {t("samples.samples2782fc")}</div>
                  </div>
                );
              })}
            </div>
          </div>
      ) : (
        <div className="flex-1 min-w-0">
          <div className="p-4 md:p-6 h-full overflow-auto yj-page-shell">
            <div className="yj-page-header">
              <h2 className="yj-page-title">{t("samples.pedigreeManagementb08123")}</h2>
            </div>
            <div className="yj-toolbar-panel">
              <div className="w-full sm:w-72">
                <Input placeholder={t("samples.searchPedigreeIdInternalIdOrSample09da28")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} leftElement={<Search className="w-4 h-4" />} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button action="download" variant="secondary"  onClick={handleDownloadTemplate}>{t("samples.downloadTemplatea3afb2")}</Button>
                <Button action="add" variant="primary"  onClick={() => setIsNewPedigreeOpen(true)}>{t("samples.newPedigreeb7e3c2")}</Button>
              </div>
            </div>
            {error && (
              <div role="alert" className="mb-3 rounded-md border border-danger-muted bg-danger-subtle px-3 py-2 text-sm text-danger-fg">
                {error}<ActionButton action="retry" variant="ghost" type="button" className="yj-tool-button ml-3" disabled={listLoading} onClick={() => void refreshPedigrees()}>{t("billing.retryLoading7b4939")}</ActionButton>
              </div>
            )}
            {listLoading && (
              <div className="mb-3 text-sm text-fg-muted">{t("samples.loadingPedigrees3443cb")}</div>
            )}
            {!listLoading && !(error && pedigrees.length === 0) && <div className="overflow-x-auto [&_table]:min-w-[990px]"><DataTable data={filteredPedigrees} columns={localizeDisplay(columns, t)} rowKey="id" striped density="compact" /></div>}
          </div>
        </div>
      )}

      {/* 中间家系树区域 */}
      {hasOpenTabs && (
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          <div className="md:hidden border-b border-border-default p-3">
            <label htmlFor="pedigree-switch" className="sr-only">{t("samples.switchPedigreedad53f")}</label>
            <select id="pedigree-switch" className="w-full rounded-md border border-border-default bg-canvas-default p-2 text-sm text-fg-default" value={activeTab?.pedigreeId || ''} onChange={(event) => {
              const pedigree = pedigrees.find(item => item.id === event.target.value);
              if (pedigree) handleOpenTab(pedigree);
            }}>
              {pedigrees.map(item => <option key={item.id} value={item.id}>{item.internalId}</option>)}
            </select>
          </div>
          {/* 标签栏 */}
          <div className="flex items-center border-b border-border-default bg-canvas-subtle flex-shrink-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] overflow-x-auto">
            {openTabs.map((tab) => (
              <div key={tab.id} onClick={() => handleSwitchTab(tab.id)} className={`flex items-center gap-2 px-4 py-2 cursor-pointer border-r border-border-muted text-sm whitespace-nowrap transition-colors ${activeTabId === tab.id ? 'bg-canvas-default text-fg-default border-b-2 border-b-accent-emphasis -mb-px' : 'text-fg-muted hover:bg-canvas-inset hover:text-fg-default'}`}>
                <span>{tab.name}</span>
                <IconActionButton label={t("samples.closeTab118f00")} action="close" variant="ghost" onClick={(e) => handleCloseTab(tab.id, e)} className="p-0.5 rounded hover:bg-canvas-inset"  />
              </div>
            ))}
          </div>

          {/* 工具栏 */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-border-default bg-canvas-subtle">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {currentPedigree && (
                <>
                  <span className="text-sm text-fg-default font-medium">{currentPedigree.internalId}</span>
                  {currentPedigree.clinicalDiagnosis && (
                    <Tag variant="info">{currentPedigree.clinicalDiagnosis}</Tag>
                  )}
                  <span className="text-xs text-fg-muted">{currentPedigree.members.length} {t("samples.membersd22661")}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isEditMode ? (
                <>
                  <Button action="add" variant="secondary" size="small"  onClick={() => setIsAddMemberOpen(true)}>
                    {t("samples.addMemberbd09d5")}</Button>
                  <Button action="edit" variant="primary" size="small"  onClick={() => setIsEditMode(false)}>
                    {t("samples.finishEditingb96ee1")}</Button>
                </>
              ) : (
                <Button action="edit" variant="secondary" size="small"  onClick={() => setIsEditMode(true)}>
                  {t("admin.edita7f814")}</Button>
              )}
            </div>
          </div>

          {/* 家系树 */}
          <div className="flex-1 min-h-0 overflow-hidden relative">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent-emphasis" />
              </div>
            ) : error && !currentPedigree ? (
              <div role="alert" className="m-4 rounded-md border border-danger-muted bg-danger-subtle px-4 py-3 text-sm text-danger-fg">{error}{activeTab && <ActionButton action="retry" variant="ghost" type="button" className="yj-tool-button ml-3" onClick={() => void refreshCurrentPedigree(activeTab.pedigreeId)}>{t("billing.retryLoading7b4939")}</ActionButton>}</div>
            ) : currentPedigree ? (
              <PedigreeTree
                members={currentPedigree.members}
                probandId={currentPedigree.probandId}
                selectedMemberId={selectedMember?.id}
                isEditMode={isEditMode}
                onSelectMember={setSelectedMember}
                onContextMenu={handleContextMenu}
                onDoubleClick={handleDoubleClick}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-fg-muted">
                {t("samples.selectAPedigreeToViewDetails1831aa")}</div>
            )}
          </div>
        </div>
      )}

      {/* 右侧成员详情面板 */}
      {selectedMember && (
        <MemberDetailPanel
          member={selectedMember}
          isEditMode={isEditMode}
          onClose={() => setSelectedMember(null)}
          onEditMember={(member) => {
            setEditingMember(member);
            setIsEditMemberOpen(true);
          }}
          onLinkSample={handleOpenLinkSample}
          onRemoveMember={(memberId) => {
            setDeletingMemberId(memberId);
            setIsDeleteMemberOpen(true);
          }}
        />
      )}

      {/* 添加成员弹窗 */}
      <AddMemberModal
        isOpen={isAddMemberOpen}
        onClose={() => {
          setIsAddMemberOpen(false);
          setAddMemberHint(null);
        }}
        onSubmit={handleAddMember}
        existingMembers={currentPedigree?.members || []}
        defaultFatherId={addMemberHint?.defaultFatherId}
        defaultMotherId={addMemberHint?.defaultMotherId}
        defaultRelation={addMemberHint?.defaultRelation}
        defaultSpouseId={addMemberHint?.defaultSpouseId}
      />

      {/* 关联样本弹窗 */}
      <LinkSampleModal
        isOpen={isLinkSampleOpen}
        onClose={() => {
          setIsLinkSampleOpen(false);
          setLinkingMemberId(null);
        }}
        onSelect={handleLinkSample}
        memberName={currentPedigree?.members.find(m => m.id === linkingMemberId)?.name || ''}
      />

      {/* 新建家系弹窗 */}
      <NewPedigreeModal
        isOpen={isNewPedigreeOpen}
        onClose={() => setIsNewPedigreeOpen(false)}
        onSubmit={handleCreatePedigree}
      />

      {/* 编辑家系弹窗 */}
      <EditPedigreeModal
        isOpen={isEditPedigreeOpen}
        onClose={() => {
          setIsEditPedigreeOpen(false);
          setEditingPedigree(null);
        }}
        onSubmit={handleEditPedigree}
        pedigree={editingPedigree}
      />

      {/* 删除家系确认弹窗 */}
      <ConfirmDialog
        isOpen={isDeletePedigreeOpen}
        onClose={() => {
          setIsDeletePedigreeOpen(false);
          setDeletingPedigreeId(null);
        }}
        onConfirm={handleDeletePedigree}
        title={t("samples.deletePedigreecde175")}
        message={t("samples.deletePedigreeThisCannotBeUndonef6d818", {p0: String(deletingPedigreeId ? pedigrees.find(p => p.id === deletingPedigreeId)?.internalId || deletingPedigreeId.substring(0, 8) : '')})}
        confirmLabel={t("data.delete3755f5")}
        confirmVariant="danger"
      />

      {/* 删除成员确认弹窗 */}
      <ConfirmDialog
        isOpen={isDeleteMemberOpen}
        onClose={() => {
          setIsDeleteMemberOpen(false);
          setDeletingMemberId(null);
        }}
        onConfirm={handleConfirmDeleteMember}
        title={t("samples.deleteMembera045fb")}
        message={t("samples.deleteMemberAssociatedFamilyRelationshipReferencesWill8b4b27", {p0: String(currentPedigree?.members.find(m => m.id === deletingMemberId)?.name || '')})}
        confirmLabel={t("data.delete3755f5")}
        confirmVariant="danger"
      />

      {/* 编辑成员弹窗 */}
      <EditMemberModal
        isOpen={isEditMemberOpen}
        onClose={() => {
          setIsEditMemberOpen(false);
          setEditingMember(null);
        }}
        onSubmit={handleEditMember}
        member={editingMember}
        existingMembers={currentPedigree?.members || []}
      />

      {/* 上下文菜单 */}
      <ContextMenu
        isOpen={contextMenu.isOpen && isEditMode}
        onClose={() => setContextMenu(prev => ({ ...prev, isOpen: false }))}
        position={contextMenu.position}
        items={localizeDisplay(contextMenuItems, t)}
      />
    </div>
  );
}
