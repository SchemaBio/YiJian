'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageContent } from '@/components/layout';
import { Button, Tag } from '@schema/ui-kit';
import { ArrowLeft, Database, User, FileText, Activity, Users } from 'lucide-react';
import { formatDateTime } from '@/lib/date-time';
import { getSampleDetail } from '@/lib/samples';
import { getFamilyHistoryLabel } from '@/lib/sample-display';
import { ApiError } from '@/lib/api';
import type { SampleDetail } from '../types';
import { GENDER_CONFIG } from '../types';
import { MatchingTab } from './components/MatchingTab';
import { SampleInfoTab, ClinicalInfoTab } from './components/SampleInfoTab';

type TabType = 'info' | 'matching' | 'clinical' | 'family' | 'analysis';

const TAB_CONFIGS: { id: TabType; label: string; icon: React.ReactNode }[] = [
  { id: 'info', label: '基本信息', icon: <User className="w-4 h-4" /> },
  { id: 'matching', label: '数据匹配', icon: <Database className="w-4 h-4" /> },
  { id: 'clinical', label: '临床诊断', icon: <FileText className="w-4 h-4" /> },
  { id: 'family', label: '家族史', icon: <Users className="w-4 h-4" /> },
  { id: 'analysis', label: '分析任务', icon: <Activity className="w-4 h-4" /> },
];

export default function SampleDetailPage() {
  const params = useParams();
  const router = useRouter();

  const uuid = params.uuid as string;
  const [sample, setSample] = React.useState<SampleDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);
  const [loadError, setLoadError] = React.useState(false);
  const [retryCount, setRetryCount] = React.useState(0);
  const [activeTab, setActiveTab] = React.useState<TabType>('info');

  React.useEffect(() => {
    async function loadSample() {
      setLoading(true);
      setNotFound(false);
      setLoadError(false);
      try {
        const data = await getSampleDetail(uuid);
        if (!data) {
          setSample(null);
          setNotFound(true);
        } else {
          setSample(data);
        }
      } catch (error) {
        setSample(null);
        if (error instanceof ApiError && error.status === 404) setNotFound(true);
        else setLoadError(true);
      } finally {
        setLoading(false);
      }
    }
    loadSample();
  }, [uuid, retryCount]);

  const handleBack = React.useCallback(() => {
    router.push('/samples');
  }, [router]);

  if (loadError) {
    return <PageContent className="yj-page-shell">
      <div role="alert" className="yj-panel flex flex-col items-center gap-4 p-8">
        <h2 className="text-lg font-semibold text-fg-default">加载样本失败</h2>
        <p className="text-sm text-fg-muted">暂时无法读取样本信息，请重试。</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={handleBack}>返回样本列表</Button>
          <Button variant="primary" onClick={() => setRetryCount(count => count + 1)}>重试</Button>
        </div>
      </div>
    </PageContent>;
  }

  if (notFound) {
    return (
      <PageContent className="yj-page-shell">
        <div className="flex flex-col items-center justify-center py-16">
          <h2 className="text-2xl font-semibold text-fg-default mb-2">404</h2>
          <p className="text-fg-muted mb-4">未找到该样本</p>
          <button
            onClick={handleBack}
            className="text-accent-fg hover:underline"
          >
            返回样本列表
          </button>
        </div>
      </PageContent>
    );
  }

  if (loading) {
    return (
      <PageContent className="yj-page-shell">
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-emphasis" />
        </div>
      </PageContent>
    );
  }

  if (!sample) {
    return null;
  }

  const genderInfo = GENDER_CONFIG[sample.gender];
  const isMatched = sample.matchedPair !== null;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'info':
        return <SampleInfoTab sample={sample} />;
      case 'matching':
        return <MatchingTab sample={sample} onSampleUpdated={setSample} />;
      case 'clinical':
        return <ClinicalInfoTab sample={sample} />;
      case 'family':
        return (
          <div className="yj-panel p-5">
            <h4 className="text-sm font-medium text-fg-default mb-3">家族史</h4>
            <div className="space-y-3">
              <div>
                <span className="text-xs text-fg-muted">是否有家族史</span>
                <p className="text-sm text-fg-default">{getFamilyHistoryLabel(sample.familyHistory?.hasHistory)}</p>
              </div>
              {sample.familyHistory?.hasHistory && sample.familyHistory.affectedMembers && (
                <div>
                  <span className="text-xs text-fg-muted">患病亲属</span>
                  <div className="mt-1 space-y-1">
                    {sample.familyHistory.affectedMembers.map((member, i) => (
                      <div key={i} className="text-sm text-fg-default">
                        {member.relation}: {member.condition}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      case 'analysis':
        return (
          <div className="yj-panel p-5">
            <h4 className="text-sm font-medium text-fg-default mb-3">关联分析任务</h4>
            {sample.analysisTasks?.length > 0 ? (
              <div className="space-y-2">
                {sample.analysisTasks.map((task: { id: string; name: string; status: string; createdAt: string }) => (
                  <div
                    key={task.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-3 bg-canvas-default rounded hover:bg-canvas-inset transition-colors cursor-pointer"
                    onClick={() => router.push(`/tasks/${encodeURIComponent(task.id)}`)}
                  >
                    <div>
                      <span className="text-sm font-medium text-fg-default">{task.name}</span>
                      <span className="text-xs text-fg-muted ml-2">{formatDateTime(task.createdAt)}</span>
                    </div>
                    <Tag variant={task.status === 'completed' ? 'success' : task.status === 'running' ? 'info' : 'neutral'}>
                      {task.status === 'completed' ? '已完成' : task.status === 'running' ? '运行中' : task.status}
                    </Tag>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-fg-muted">暂无关联的分析任务</p>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <PageContent className="yj-page-shell">
      {/* 样本信息头部 */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="small" leftIcon={<ArrowLeft className="w-4 h-4" />} onClick={handleBack}>
            返回
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border-default">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            <h2 className="yj-page-title break-all">{sample.internalId}</h2>
            <span className={`text-sm ${genderInfo.color}`}>{genderInfo.label}</span>
            <Tag variant={isMatched ? 'success' : 'warning'}>{isMatched ? '已匹配' : '未匹配'}</Tag>
          </div>

        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-fg-muted mt-2">
          <span>样本编号: <span className="font-mono break-all">{uuid}</span></span>
          <span>样本类型: {sample.sampleType}</span>
          <span>创建时间: {formatDateTime(sample.createdAt)}</span>
        </div>
      </div>

      {/* 标签页导航 */}
      <div className="border-b border-border-default mb-4">
        <nav className="flex gap-1 overflow-x-auto overflow-y-hidden" role="tablist" aria-label="样本详情标签页">
          {TAB_CONFIGS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex shrink-0 whitespace-nowrap items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
                  ${isActive
                    ? 'border-accent-emphasis text-accent-fg'
                    : 'border-transparent text-fg-muted hover:text-fg-default'
                  }
                `}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* 标签页内容 */}
      <div>{renderTabContent()}</div>
    </PageContent>
  );
}
