import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@schema/ui-kit';
import '../../src/app/globals.css';
import { AppShell } from '../../src/components/layout/AppShell';
import TaskPage from '../../src/app/(main)/tasks/page';
import DetailPage from '../../src/app/(main)/tasks/[uuid]/page';
import { usePathname, useRouter } from './navigation';
function Preview() { const path = usePathname(); const router = useRouter(); const [dark, setDark] = React.useState(false); const [view, setView] = React.useState<'tasks' | 'variants'>('variants');
  React.useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; document.documentElement.classList.toggle('dark', dark); }, [dark]);
  return <ThemeProvider defaultTheme="light"><div style={{ position: 'fixed', bottom: 12, left: 76, zIndex: 90 }} className="flex items-center gap-2 rounded-md border border-border-default bg-canvas-default px-3 py-2 text-xs">
    <span>交互预览 · 合成数据</span><button onClick={() => setView('tasks')}>任务列表</button><button onClick={() => setView('variants')}>位点判读</button><button onClick={() => setDark(!dark)}>{dark ? '浅色' : '深色'}</button>
  </div><AppShell>{view === 'variants' ? <DetailPage /> : <TaskPage />}</AppShell></ThemeProvider>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
