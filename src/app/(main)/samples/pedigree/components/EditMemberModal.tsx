'use client';

import * as React from 'react';
import { Button, Input, Select, Tag } from '@schema/ui-kit';
import { X, Plus } from 'lucide-react';
import { AppModal } from '@/components/shared';
import type { RelationType, AffectedStatus, PedigreeMember, Gender } from '../types';
import { RELATION_CONFIG, AFFECTED_STATUS_CONFIG } from '../types';

interface EditMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (memberId: string, updates: Partial<PedigreeMember>) => void | Promise<void>;
  member: PedigreeMember | null;
  existingMembers: PedigreeMember[];
}

const genderOptions = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
  { value: 'unknown', label: '未知' },
];

const relationOptions = Object.entries(RELATION_CONFIG)
  .map(([value, config]) => ({ value, label: config.label }));

const affectedOptions = Object.entries(AFFECTED_STATUS_CONFIG)
  .map(([value, config]) => ({ value, label: config.label }));

// 用于表示"无/未知"的特殊值（Radix Select 不允许空字符串作为 value）
const NONE_VALUE = '__none__';

export function EditMemberModal({ isOpen, onClose, onSubmit, member, existingMembers }: EditMemberModalProps) {
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState('');
  const [formData, setFormData] = React.useState({
    name: '',
    gender: 'unknown' as Gender,
    birthYear: '',
    relation: 'other' as RelationType,
    affectedStatus: 'unknown' as AffectedStatus,
    fatherId: NONE_VALUE,
    motherId: NONE_VALUE,
    spouseIds: [] as string[],
    phenotypes: '',
    isDeceased: false,
    deceasedYear: '',
  });

  // 从 member prop 初始化表单数据
  React.useEffect(() => {
    if (member) {
      setSubmitError('');
      setFormData({
        name: member.name,
        gender: member.gender,
        birthYear: member.birthYear ? String(member.birthYear) : '',
        relation: member.relation,
        affectedStatus: member.affectedStatus,
        fatherId: member.fatherId || NONE_VALUE,
        motherId: member.motherId || NONE_VALUE,
        spouseIds: member.spouseIds || [],
        phenotypes: member.phenotypes ? member.phenotypes.join(', ') : '',
        isDeceased: member.isDeceased || false,
        deceasedYear: member.deceasedYear ? String(member.deceasedYear) : '',
      });
    }
  }, [member]);

  const handleChange = (field: string, value: string | boolean | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addSpouse = (spouseId: string) => {
    if (spouseId && spouseId !== NONE_VALUE && !formData.spouseIds.includes(spouseId)) {
      setFormData(prev => ({ ...prev, spouseIds: [...prev.spouseIds, spouseId] }));
    }
  };

  const removeSpouse = (spouseId: string) => {
    setFormData(prev => ({ ...prev, spouseIds: prev.spouseIds.filter(id => id !== spouseId) }));
  };

  const handleSubmit = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!member || submitting) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      await onSubmit(member.id, {
        name: formData.name,
        gender: formData.gender,
        birthYear: formData.birthYear ? parseInt(formData.birthYear) : undefined,
        relation: formData.relation,
        affectedStatus: formData.affectedStatus,
        fatherId: formData.fatherId === NONE_VALUE ? undefined : formData.fatherId,
        motherId: formData.motherId === NONE_VALUE ? undefined : formData.motherId,
        spouseIds: formData.spouseIds.length > 0 ? formData.spouseIds : undefined,
        phenotypes: formData.phenotypes ? formData.phenotypes.split(',').map(s => s.trim()) : undefined,
        isDeceased: formData.isDeceased,
        deceasedYear: formData.isDeceased && formData.deceasedYear ? parseInt(formData.deceasedYear) : undefined,
      });
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to update pedigree member');
    } finally {
      setSubmitting(false);
    }
  };

  const getDescendants = (memberId: string): string[] => {
    const descendants: string[] = [];
    const children = existingMembers.filter(m => m.fatherId === memberId || m.motherId === memberId);
    for (const child of children) {
      descendants.push(child.id);
      descendants.push(...getDescendants(child.id));
    }
    return descendants;
  };

  const excludeIds = member ? [member.id, ...getDescendants(member.id)] : [];

  const maleMembers = existingMembers.filter(m => m.gender === 'male' && !excludeIds.includes(m.id));
  const femaleMembers = existingMembers.filter(m => m.gender === 'female' && !excludeIds.includes(m.id));

  const fatherOptions = [
    { value: NONE_VALUE, label: '无/未知' },
    ...maleMembers.map(m => ({ value: m.id, label: m.name })),
  ];

  const motherOptions = [
    { value: NONE_VALUE, label: '无/未知' },
    ...femaleMembers.map(m => ({ value: m.id, label: m.name })),
  ];

  // 配偶候选（排除自己、现有配偶、后代）
  const spouseCandidates = existingMembers.filter(m =>
    !excludeIds.includes(m.id) &&
    !formData.spouseIds.includes(m.id)
  );

  const spouseOptions = [
    { value: NONE_VALUE, label: '选择配偶...' },
    ...spouseCandidates.map(m => ({ value: m.id, label: `${m.name} (${m.gender === 'male' ? '男' : m.gender === 'female' ? '女' : '未知'})` })),
  ];

  if (!member) return null;

  return (
    <AppModal
      open={isOpen}
      onOpenChange={(open) => !open && !submitting && onClose()}
      title="编辑成员信息"
      size="small"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>取消</Button>
          <Button variant="primary" onClick={(e: React.MouseEvent) => handleSubmit(e)} disabled={submitting}>保存修改</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {submitError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {submitError}
          </div>
        )}
        <div>
          <label className="block text-xs text-fg-muted mb-1">姓名 *</label>
          <Input value={formData.name} onChange={(e) => handleChange('name', e.target.value)} placeholder="请输入姓名" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-fg-muted mb-1">性别 *</label>
            <Select value={formData.gender} onChange={(value) => handleChange('gender', Array.isArray(value) ? value[0] : value)} options={genderOptions} />
          </div>
          <div>
            <label className="block text-xs text-fg-muted mb-1">出生年份</label>
            <Input type="number" value={formData.birthYear} onChange={(e) => handleChange('birthYear', e.target.value)} placeholder="如 1990" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-fg-muted mb-1">与先证者关系 *</label>
            <Select value={formData.relation} onChange={(value) => handleChange('relation', Array.isArray(value) ? value[0] : value)} options={relationOptions} />
          </div>
          <div>
            <label className="block text-xs text-fg-muted mb-1">患病状态 *</label>
            <Select value={formData.affectedStatus} onChange={(value) => handleChange('affectedStatus', Array.isArray(value) ? value[0] : value)} options={affectedOptions} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-fg-muted mb-1">父亲</label>
            <Select value={formData.fatherId} onChange={(value) => handleChange('fatherId', Array.isArray(value) ? value[0] : value)} options={fatherOptions} />
          </div>
          <div>
            <label className="block text-xs text-fg-muted mb-1">母亲</label>
            <Select value={formData.motherId} onChange={(value) => handleChange('motherId', Array.isArray(value) ? value[0] : value)} options={motherOptions} />
          </div>
        </div>
        <div>
          <label className="block text-xs text-fg-muted mb-1">配偶</label>
          <div className="flex flex-wrap gap-1 mb-2">
            {formData.spouseIds.map(sid => {
              const spouse = existingMembers.find(m => m.id === sid);
              return spouse ? (
                <Tag key={sid} variant="neutral" closable onClose={() => removeSpouse(sid)}>{spouse.name}</Tag>
              ) : null;
            })}
          </div>
          {spouseCandidates.length > 0 && (
            <Select value="" onChange={(value) => addSpouse(Array.isArray(value) ? value[0] : value)} options={spouseOptions} />
          )}
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={formData.isDeceased} onChange={(e) => handleChange('isDeceased', e.target.checked)} className="w-4 h-4 rounded border-border-default" />
            <span className="text-sm text-fg-default">已故</span>
          </label>
          {formData.isDeceased && (
            <div>
              <label className="block text-xs text-fg-muted mb-1">去世年份</label>
              <Input type="number" value={formData.deceasedYear} onChange={(e) => handleChange('deceasedYear', e.target.value)} placeholder="如 2020" />
            </div>
          )}
        </div>
        <div>
          <label className="block text-xs text-fg-muted mb-1">表型描述</label>
          <Input value={formData.phenotypes} onChange={(e) => handleChange('phenotypes', e.target.value)} placeholder="多个表型用逗号分隔" />
        </div>
      </form>
    </AppModal>
  );
}