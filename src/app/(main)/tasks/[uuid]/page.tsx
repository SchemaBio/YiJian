'use client';

import * as React from 'react';
import { InterpretationReadOnlyContext } from './components/InterpretationLock';
import { useParams, useRouter } from 'next/navigation';
import { PageContent } from '@/components/layout';
import { tasksApi } from '@/lib/tasks';
import {AssessmentStatusBar} from './components/AssessmentStatusBar';
import { useTabState } from './hooks/useTabState';
import { getResultContext } from './result-api';
import type { AnalysisTaskDetail, ResultContext, TabType } from './types';
import type { SampleDetail } from '@/app/(main)/samples/types';
import {
  TaskHeader,
  ResultTabs,
  SampleSummaryCard,
  SNVIndelTab,
  CNVSegmentTab,
  CNVExonTab,
  STRTab,
  MEITab,
  MTTab,
  UPDTab,
  ROHTab,
  ReportTab,
	ResultOverview,
	VariantTypeNav,
} from './components';

export default function AnalysisDetailPage() {
  const params = useParams();
  const router = useRouter();

  const uuid = params.uuid as string;
  const [completionSaving, setCompletionSaving] = React.useState(false);
  const [completionError, setCompletionError] = React.useState('');
  const completionRevisionRef = React.useRef(0);
  const completionPendingRef = React.useRef(false);
  const [assessmentRevision,setAssessmentRevision]=React.useState(0);
 React.useEffect(()=>{const changed=(event:Event)=>{if((event as CustomEvent).detail?.taskId===uuid)setAssessmentRevision(x=>x+1);};window.addEventListener("yijian:assessment-reloaded",changed);return()=>window.removeEventListener("yijian:assessment-reloaded",changed);},[uuid]);

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
		if (loading) return;
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
		const timer = window.setInterval(() => void refreshContext(), resultContext?.state==='ready'?30000:5000);
		return () => {
			disposed = true;
			window.clearInterval(timer);
		};
	}, [loading, resultContext?.state, uuid]);

	React.useEffect(() => {
		const controller = new AbortController();
		let refreshing=false;
		const refreshAfterAdjustment = () => {
			if(refreshing)return;refreshing=true;
			void getResultContext(uuid, controller.signal).then(next => {
				setResultContext(next);
				setResultContextError(null);
			}).catch(cause => {
				if (!controller.signal.aborted) setResultContextError(cause instanceof Error ? cause.message : '无法刷新结果统计');
			}).finally(()=>{refreshing=false;});
		};
		window.addEventListener('yijian:result-adjustment-saved', refreshAfterAdjustment);
		const onSynced=(event:Event)=>{if((event as CustomEvent).detail?.taskId===uuid)refreshAfterAdjustment();};
		window.addEventListener('yijian:result-overlays-synced',onSynced);
		return () => {
			controller.abort();
			window.removeEventListener('yijian:result-adjustment-saved', refreshAfterAdjustment);
			window.removeEventListener('yijian:result-overlays-synced',onSynced);
		};
	}, [uuid]);

	React.useEffect(() => {
		if (loading || manuallySelectedTabRef.current) return;
		if (hasExplicitTab && automaticallySelectedTabRef.current === null) return;
		const nextTab: TabType = 'overview';
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

  const setInterpretationCompleted = async () => {
    if (!task || completionSaving) return;
    completionPendingRef.current = true;
    completionRevisionRef.current += 1;
    setCompletionSaving(true); setCompletionError('');
    try {
      const next = await tasksApi.setInterpretationCompleted(uuid, !task.interpretationCompletedAt, task.attemptId || uuid);
      setTask(next);
    } catch (cause) { setCompletionError(cause instanceof Error ? cause.message : '解读状态更新失败'); }
    finally { completionPendingRef.current = false; setCompletionSaving(false); }
  };
  React.useEffect(() => {
    const controller = new AbortController();
    const refresh = () => {
      if (completionPendingRef.current) return;
      const revision = completionRevisionRef.current;
      void tasksApi.get(uuid).then(next => {
        if (!controller.signal.aborted && !completionPendingRef.current && revision === completionRevisionRef.current) setTask(next);
      }).catch(() => {});
    };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [uuid]);

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
      case 'snv-indel':
        return (
          <SNVIndelTab
            taskId={uuid}
            referenceGenome={resultContext?.reference.declaredId}
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

	 const resultContextKey = [assessmentRevision,
		uuid,
		resultContext?.executionAttemptId ?? 'no-attempt',
		resultContext?.importBatchId ?? 'no-batch',
		resultContext?.version ?? 'no-version',
	].join(':');
	const isVariantTab = ['snv-indel', 'cnv-segment', 'cnv-exon', 'str', 'mei', 'mt', 'upd', 'roh'].includes(activeTab);

  return (
    <InterpretationReadOnlyContext.Provider value={!!task.interpretationCompletedAt || completionSaving}>
    <PageContent padded={false} className="h-full min-h-0 !overflow-hidden flex flex-col">
      <div className="shrink-0 border-b border-border-subtle bg-canvas-default px-3 pt-2 md:px-4">
      {/* 任务信息头部 */}
      <TaskHeader task={task} onBack={handleBack} compact completionControl={(['completed', 'pending_interpretation'].includes(task.status) || task.interpretationCompletedAt) && <button type="button" className="yj-tool-button" disabled={completionSaving} onClick={() => void setInterpretationCompleted()}>{completionSaving ? '保存中…' : task.interpretationCompletedAt ? '取消解读完成' : '解读完成'}</button>} />
      {task.interpretationCompletedAt && <p role="status" className="mb-2 rounded bg-canvas-subtle px-3 py-2 text-xs text-fg-muted">解读已完成，当前为只读。取消解读完成后可继续编辑。</p>}
      {completionError && <p role="alert" className="mb-2 text-sm text-danger-fg">{completionError}</p>}

      {/* 样本信息汇总卡片 */}
      {sample && <SampleSummaryCard sample={sample} />}
      </div>
      <div className="min-h-0 flex-1 flex flex-col overflow-hidden px-3 pb-3 md:px-4 md:pb-4">

      {/* 标签面板和内容 */}
		<div className="flex-1 min-h-0"><ResultTabs key={resultContextKey} activeTab={activeTab} onTabChange={handleTabChange} tools={<AssessmentStatusBar taskId={uuid} table={isVariantTab?activeTab:undefined} />}>
			{isVariantTab ? (
				<div className="yj-result-workspace">
					<VariantTypeNav activeTab={activeTab} context={resultContext} onTabChange={handleTabChange} />
					<div className="yj-result-content">{renderTabContent()}</div>
				</div>
			) : <div className="h-full overflow-auto">{renderTabContent()}</div>}
		</ResultTabs></div>
      </div>
    </PageContent>
    </InterpretationReadOnlyContext.Provider>
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
