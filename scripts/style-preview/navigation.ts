import * as React from 'react';
const navigate = (url: string, replace = false) => { if (!replace && new URL(url, location.href).pathname !== location.pathname) { location.assign(url); return; } history[replace ? 'replaceState' : 'pushState']({}, '', url); window.dispatchEvent(new Event('popstate')); };
const router = { push: (url: string) => navigate(url), replace: (url: string) => navigate(url, true), back: () => history.back(), refresh: () => window.dispatchEvent(new Event('popstate')) };
export function useLocation() { return React.useSyncExternalStore(callback => { window.addEventListener('popstate', callback); return () => window.removeEventListener('popstate', callback); }, () => location.pathname + location.search); }
export function usePathname() { return useLocation().split('?')[0]; }
export function useSearchParams() { const url = useLocation(); return React.useMemo(() => new URLSearchParams(url.split('?')[1]), [url]); }
export function useRouter() { return router; }
export function useParams() { return { uuid: usePathname().split('/')[2] || 'preview-task' }; }
