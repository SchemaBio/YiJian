import React from 'react';
import {previewAssessment} from './assessment';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@schema/ui-kit';
import '../../src/app/globals.css';
import { AppShell } from '../../src/components/layout/AppShell';
import AdminPage from '../../src/app/(main)/admin/page';
import TemplatesPage from '../../src/app/(main)/pipeline/templates/page';
import { PermissionsManagement } from '../../src/app/(main)/settings/components/PermissionsManagement';
import SettingsPage from '../../src/app/(main)/settings/page';
import BaselinePage from '../../src/app/(main)/pipeline/baseline/page';
import PipelineConfigPage from '../../src/app/(main)/pipeline/config/page';
import HistoryPage from '../../src/app/(main)/history/page';
import BillingPage from '../../src/app/(main)/settings/billing/page';
import DashboardPage from '../../src/app/(main)/dashboard/page';
import TaskPage from '../../src/app/(main)/tasks/page';
import DetailPage from '../../src/app/(main)/tasks/[uuid]/page';
import { usePathname, useRouter } from './navigation';
function Preview() { const path = usePathname(); const router = useRouter(); const [dark, setDark] = React.useState(false); const [view, setView] = React.useState<'tasks' | 'variants' | 'dashboard' | 'billing' | 'history' | 'settings' | 'config' | 'baseline' | 'admin' | 'templates' | 'permissions'>('variants');
  React.useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; document.documentElement.classList.toggle('dark', dark); }, [dark]);
  return <ThemeProvider defaultTheme="light"><div style={{ position: 'fixed', bottom: 12, left: 76, right: 12, maxWidth: 820, zIndex: 90 }} className="flex flex-wrap items-center gap-2 rounded-md border border-border-default bg-canvas-default px-3 py-2 text-xs">
    <span>交互预览 · 合成数据</span><button onClick={()=>previewAssessment('cancelled')}>初评取消状态</button><button onClick={() => setView('dashboard')}>工作台</button><button onClick={() => setView('billing')}>费用</button><button onClick={() => setView('history')}>历史</button><button onClick={() => setView('settings')}>设置</button><button onClick={() => setView('config')}>流程配置</button><button onClick={() => setView('baseline')}>基线</button><button onClick={() => setView('templates')}>报告服务</button><button onClick={() => setView('permissions')}>权限</button><button onClick={() => setView('admin')}>管理</button><button onClick={() => setView('tasks')}>任务列表</button><button onClick={() => setView('variants')}>位点判读</button><button onClick={() => setDark(!dark)}>{dark ? '浅色' : '深色'}</button>
  </div><AppShell>{view === 'variants' ? <DetailPage /> : view === 'dashboard' ? <DashboardPage /> : view === 'billing' ? <BillingPage /> : view === 'admin' ? <AdminPage /> : view === 'templates' ? <TemplatesPage /> : view === 'permissions' ? <div className="p-4 md:p-6"><div className="yj-page-header"><h2 className="yj-page-title">权限管理 · 自部署预览</h2></div><PermissionsManagement /></div> : view === 'baseline' ? <BaselinePage /> : view === 'settings' ? <SettingsPage /> : view === 'config' ? <PipelineConfigPage /> : view === 'history' ? <HistoryPage /> : <TaskPage />}</AppShell></ThemeProvider>;
}
window.__YIJIAN_CONFIG__ = {BACKEND:'squid'};
createRoot(document.getElementById('root')!).render(<Preview />);
