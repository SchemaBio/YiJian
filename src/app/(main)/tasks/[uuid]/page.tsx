'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageContent } from '@/components/layout';
import { tasksApi } from '@/lib/tasks';
import { useTabState } from './hooks/useTabState';
import { getResultContext } from './result-api';
import type { AnalysisTaskDetail, ResultContext, TabType } from './types';
import type { SampleDetail } from '@/app/(main)/samples/types';
import {
  TaskHeader,
  ResultTabs,
  SampleSummaryCard,
  QCResultTab,
  SNVIndelTab,
  CNVSegmentTab,
  CNVExonTab,
  STRTab,
  MEITab,
  MTTab,
  UPDTab,
  ROHTab,
  ReportTab,
  TaskRuntimeTab,
	ResultOverview,
	VariantTypeNav,
} from './components';

export default function AnalysisDetailPage() {
  const params = useParams();
  const router = useRouter();

  const uuid = params.uuid as string;
  const [task, setTask] = React.useState<AnalysisTaskDetail | null>(null);
  const [sample, setSample] = React.useState<SampleDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);
	const [resultContext, setResultContext] = React.useState<ResultContext | null>(null);
	const [resultContextError, setResultContextError] = React.useState<string | null>(null);

  // 使用标签页状态管理hook，默认从质控结果开始
	const { activeTab, hasExplicitTab, setActiveTab, getFilterState, setFilterState } = useTabState(uuid);
	const manuallySelectedTabRef = React.useRef(false);
	const automaticallySelectedTabRef = React.useRef<TabType | null>(null);
	const handleTabChange = React.useCallback((tab: TabType) => {
		manuallySelectedTabRef.current = true;
		automaticallySelectedTabRef.current = null;
		setActiveTab(tab);
	}, [setActiveTab]);

  // 加载任务数据和样本数据
  React.useEffect(() => {
		const controller = new AbortController();
    async function loadData() {
      setLoading(true);
      setNotFound(false);
      try {
        const [taskData, sampleData, contextData] = await Promise.all([
          tasksApi.get(uuid),
          tasksApi.getSample(uuid).catch(() => null),
			getResultContext(uuid, controller.signal).catch(cause => {
				if (!controller.signal.aborted) setResultContextError(cause instanceof Error ? cause.message : '无法读取结果上下文');
				return null;
			}),
        ]);
		if (controller.signal.aborted) return;
        setTask(taskData);
        setSample(sampleData);
		setResultContext(contextData);
      } catch {
        setNotFound(true);
        setTask(null);
        setSample(null);
      } finally {
        setLoading(false);
      }
    }
		void loadData();
		return () => controller.abort();
  }, [uuid]);

	React.useEffect(() => {
		if (loading || resultContext?.state === 'ready' || resultContext?.state === 'import_failed') return;
		let disposed = false;
		let requestInFlight = false;
		const refreshContext = async () => {
			if (requestInFlight) return;
			requestInFlight = true;
			try {
				const next = await getResultContext(uuid);
				if (disposed) return;
				setResultContext(next);
				setResultContextError(null);
			} catch (cause) {
				if (!disposed) setResultContextError(cause instanceof Error ? cause.message : '无法读取结果上下文');
			} finally {
				requestInFlight = false;
			}
		};
		const timer = window.setInterval(() => void refreshContext(), 5000);
		return () => {
			disposed = true;
			window.clearInterval(timer);
		};
	}, [loading, resultContext?.state, uuid]);

	React.useEffect(() => {
		if (loading || manuallySelectedTabRef.current) return;
		if (hasExplicitTab && automaticallySelectedTabRef.current === null) return;
		const nextTab: TabType = resultContext?.state === 'ready' ? 'overview' : 'runtime';
		if (activeTab === nextTab) {
			automaticallySelectedTabRef.current = nextTab;
			return;
		}
		automaticallySelectedTabRef.current = nextTab;
		setActiveTab(nextTab);
	}, [activeTab, hasExplicitTab, loading, resultContext?.state, setActiveTab]);

  // 返回任务列表
  const handleBack = React.useCallback(() => {
    router.push('/tasks');
  }, [router]);

  // 404页面
  if (notFound) {
    return (
      <PageContent>
        <div className="flex flex-col items-center justify-center py-16">
          <h2 className="text-2xl font-semibold text-fg-default mb-2">404</h2>
          <p className="text-fg-muted mb-4">未找到该分析任务</p>
          <button
            onClick={handleBack}
            className="text-accent-fg hover:underline"
          >
            返回任务列表
          </button>
        </div>
      </PageContent>
    );
  }

  // 加载中
  if (loading) {
    return (
      <PageContent>
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-emphasis" />
        </div>
      </PageContent>
    );
  }

  if (!task) {
    return null;
  }

  // 渲染当前标签页内容
  const renderTabContent = () => {
    switch (activeTab) {
		case 'overview':
			return resultContext ? <ResultOverview context={resultContext} onNavigate={handleTabChange} /> : <ResultContextUnavailable message={resultContextError} />;
      case 'runtime':
        return <TaskRuntimeTab
          taskId={uuid}
          initialStatus={task.status}
          onResultImportChange={async () => {
            try {
              setResultContext(await getResultContext(uuid));
              setResultContextError(null);
            } catch (cause) {
              setResultContextError(cause instanceof Error ? cause.message : '无法读取结果上下文');
            }
          }}
        />;
		case 'qc':
			return <QCResultTab taskId={uuid} context={resultContext} />;
      case 'snv-indel':
        return (
          <SNVIndelTab
            taskId={uuid}
            filterState={getFilterState('snv-indel')}
            onFilterChange={(state) => setFilterState('snv-indel', state)}
          />
        );
      case 'cnv-segment':
        return (
          <CNVSegmentTab
            taskId={uuid}
            referenceId={resultContext?.reference.declaredId}
            filterState={getFilterState('cnv-segment')}
            onFilterChange={(state) => setFilterState('cnv-segment', state)}
          />
        );
      case 'cnv-exon':
        return (
          <CNVExonTab
            taskId={uuid}
            referenceId={resultContext?.reference.declaredId}
            filterState={getFilterState('cnv-exon')}
            onFilterChange={(state) => setFilterState('cnv-exon', state)}
          />
        );
      case 'str':
        return (
          <STRTab
            taskId={uuid}
            filterState={getFilterState('str')}
            onFilterChange={(state) => setFilterState('str', state)}
          />
        );
      case 'mei':
        return (
          <MEITab
            taskId={uuid}
            filterState={getFilterState('mei')}
            onFilterChange={(state) => setFilterState('mei', state)}
          />
        );
      case 'mt':
        return (
          <MTTab
            taskId={uuid}
            filterState={getFilterState('mt')}
            onFilterChange={(state) => setFilterState('mt', state)}
          />
        );
      case 'upd':
        return (
          <UPDTab
            taskId={uuid}
            filterState={getFilterState('upd')}
            onFilterChange={(state) => setFilterState('upd', state)}
          />
        );
      case 'roh':
        return (
          <ROHTab
            taskId={uuid}
            filterState={getFilterState('roh')}
            onFilterChange={(state) => setFilterState('roh', state)}
          />
        );
      case 'report':
        return <ReportTab taskId={uuid} />;
      default:
        return null;
    }
  };

	const isVariantTab = ['snv-indel', 'cnv-segment', 'cnv-exon', 'str', 'mei', 'mt', 'upd', 'roh'].includes(activeTab);

  return (
    <PageContent>
      {/* 任务信息头部 */}
      <TaskHeader task={task} onBack={handleBack} />

      {/* 样本信息汇总卡片 */}
      {sample && <SampleSummaryCard sample={sample} />}

      {/* 标签面板和内容 */}
		<ResultTabs activeTab={activeTab} onTabChange={handleTabChange}>
			{isVariantTab ? (
				<div className="grid gap-5 xl:grid-cols-[168px_minmax(0,1fr)]">
					<VariantTypeNav activeTab={activeTab} context={resultContext} onTabChange={handleTabChange} />
					<div className="min-w-0 rounded-xl border border-border-default bg-canvas-default p-4 shadow-sm">{renderTabContent()}</div>
				</div>
			) : renderTabContent()}
		</ResultTabs>
    </PageContent>
  );
}

function ResultContextUnavailable({ message }: { message: string | null }) {
  return (
    <div className="rounded-xl border border-border-default bg-canvas-default p-8 text-center">
      <h2 className="font-semibold text-fg-default">结果上下文尚不可用</h2>
      <p className="mt-2 text-sm text-fg-muted">{message || '任务结果尚未完成结构化导入。'}</p>
    </div>
  );
}
