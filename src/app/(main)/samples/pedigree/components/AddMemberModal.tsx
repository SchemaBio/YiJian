'use client';

import * as React from 'react';
import { Button, Input, Select } from '@schema/ui-kit';
import { X } from 'lucide-react';
import { AppModal } from '@/components/shared';
import type { RelationType, AffectedStatus, PedigreeMember } from '../types';
import type { Gender } from '../../types';
import { RELATION_CONFIG, AFFECTED_STATUS_CONFIG } from '../types';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (member: Omit<PedigreeMember, 'id' | 'generation' | 'position'>) => void | Promise<void>;
  existingMembers: PedigreeMember[];
  // 预填充提示（从上下文菜单传入）
  defaultFatherId?: string;
  defaultMotherId?: string;
  defaultRelation?: RelationType;
  defaultSpouseId?: string;
}

const genderOptions = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
  { value: 'unknown', label: '未知' },
];

const relationOptions = Object.entries(RELATION_CONFIG)
  .filter(([key]) => key !== 'proband')
  .map(([value, config]) => ({ value, label: config.label }));

const affectedOptions = Object.entries(AFFECTED_STATUS_CONFIG)
  .map(([value, config]) => ({ value, label: config.label }));

// 用于表示"无/未知"的特殊值（Radix Select 不允许空字符串作为 value）
const NONE_VALUE = '__none__';

export function AddMemberModal({ isOpen, onClose, onSubmit, existingMembers, defaultFatherId, defaultMotherId, defaultRelation, defaultSpouseId }: AddMemberModalProps) {
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState('');
  const [formData, setFormData] = React.useState({
    name: '',
    gender: 'unknown' as Gender,
    birthYear: '',
    relation: 'sibling' as RelationType,
    affectedStatus: 'unknown' as AffectedStatus,
    fatherId: NONE_VALUE,
    motherId: NONE_VALUE,
    phenotypes: '',
  });

  // 从预填充提示初始化表单
  React.useEffect(() => {
    if (isOpen) {
      setSubmitError('');
      setFormData({
        name: '',
        gender: 'unknown',
        birthYear: '',
        relation: defaultRelation || 'sibling',
        affectedStatus: 'unknown',
        fatherId: defaultFatherId || NONE_VALUE,
        motherId: defaultMotherId || NONE_VALUE,
        phenotypes: '',
      });
    }
  }, [isOpen, defaultFatherId, defaultMotherId, defaultRelation]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await onSubmit({
        name: formData.name,
        gender: formData.gender,
        birthYear: formData.birthYear ? parseInt(formData.birthYear) : undefined,
        relation: formData.relation,
        affectedStatus: formData.affectedStatus,
        fatherId: formData.fatherId === NONE_VALUE ? undefined : formData.fatherId,
        motherId: formData.motherId === NONE_VALUE ? undefined : formData.motherId,
        phenotypes: formData.phenotypes ? formData.phenotypes.split(',').map(s => s.trim()) : undefined,
        spouseIds: defaultSpouseId ? [defaultSpouseId] : undefined,
      });
      onClose();
      setFormData({
        name: '',
        gender: 'unknown',
        birthYear: '',
        relation: 'sibling',
        affectedStatus: 'unknown',
        fatherId: NONE_VALUE,
        motherId: NONE_VALUE,
        phenotypes: '',
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to add pedigree member');
    } finally {
      setSubmitting(false);
    }
  };

  const maleMembers = existingMembers.filter(m => m.gender === 'male');
  const femaleMembers = existingMembers.filter(m => m.gender === 'female');

  const fatherOptions = [
    { value: NONE_VALUE, label: '无/未知' },
    ...maleMembers.map(m => ({ value: m.id, label: m.name })),
  ];

  const motherOptions = [
    { value: NONE_VALUE, label: '无/未知' },
    ...femaleMembers.map(m => ({ value: m.id, label: m.name })),
  ];

  if (!isOpen) return null;

  return (
    <AppModal
      open={isOpen}
      onOpenChange={(open) => !open && !submitting && onClose()}
      title="添加家系成员"
      size="small"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>取消</Button>
          <Button variant="primary" onClick={(e: React.MouseEvent) => handleSubmit(e)} disabled={submitting}>添加成员</Button>
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
          <label className="block text-xs text-fg-muted mb-1">表型描述</label>
          <Input value={formData.phenotypes} onChange={(e) => handleChange('phenotypes', e.target.value)} placeholder="多个表型用逗号分隔" />
        </div>
      </form>
    </AppModal>
  );
}
