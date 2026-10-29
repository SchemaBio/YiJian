'use client';
import * as React from 'react';
import { Bell, ChevronRight, X } from 'lucide-react';
import { api } from '@/lib/api';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';
import { parseAnnouncements, type Announcement } from '@/lib/announcements';
import { useAuth } from '@/components/providers/AuthProvider';
import { useText } from '@/i18n/useText';
import { AppModal } from '@/components/shared/AppModal';
type AnnouncementsState = {
    items: Announcement[];
    loading: boolean;
    failed: boolean;
    open: boolean;
    setOpen: (open: boolean) => void;
    reload: () => void;
    dismiss: (item: Announcement) => void;
    dismissed: Record<string, number>;
};
const Context = React.createContext<AnnouncementsState | null>(null);
export function AnnouncementsProvider({ children }: {
    children: React.ReactNode;
}) {
    const saas = getRuntimeBackendFlavor() === 'squid';
    return saas ? <SaaSAnnouncements>{children}</SaaSAnnouncements> : <>{children}</>;
}
function SaaSAnnouncements({ children }: {
    children: React.ReactNode;
}) {
    const { user } = useAuth();
    const [items, setItems] = React.useState<Announcement[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [failed, setFailed] = React.useState(false);
    const [open, setOpen] = React.useState(false);
    const [dismissed, setDismissed] = React.useState<Record<string, number>>({});
    const [offset, setOffset] = React.useState(0);
    const [clock, setClock] = React.useState(Date.now());
    const key = 'yj:announcement-dismissals:' + (user?.id ?? 'session');
    React.useEffect(() => { function read() { try {
        const value = JSON.parse(localStorage.getItem(key) || '{}');
        setDismissed(value && typeof value === 'object' && !Array.isArray(value) ? value : {});
    }
    catch {
        setDismissed({});
    } } read(); window.addEventListener('storage', read); return () => window.removeEventListener('storage', read); }, [key]);
    const active = items.filter(item => Date.parse(item.starts_at) <= clock + offset && Date.parse(item.ends_at) > clock + offset);
    const abort = React.useRef<AbortController | null>(null);
    const generation = React.useRef(0);
    const reload = React.useCallback(async () => { const version = ++generation.current; abort.current?.abort(); const controller = new AbortController(); abort.current = controller; try {
        const result = parseAnnouncements(await api.get('/v1/announcements', { coreApi: false, cache: 'no-store', signal: controller.signal }));
        if (!controller.signal.aborted && version === generation.current) {
            setItems(result.items);
            setOffset(Date.parse(result.server_time) - Date.now());
            setClock(Date.now());
            setFailed(false);
        }
    }
    catch {
        if (!controller.signal.aborted && version === generation.current)
            setFailed(true);
    }
    finally {
        if (!controller.signal.aborted && version === generation.current)
            setLoading(false);
    } }, []);
    React.useEffect(() => { setItems([]); setLoading(true); setOpen(false); void reload(); const timer = window.setInterval(() => { if (!document.hidden)
        void reload(); }, 60000); function visible() { if (!document.hidden)
        void reload(); } document.addEventListener('visibilitychange', visible); return () => { ++generation.current; abort.current?.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange', visible); }; }, [reload, key]);
    React.useEffect(() => { const now = Date.now() + offset; const next = Math.min(...items.map(item => Date.parse(item.ends_at)).filter(end => end > now)); if (!Number.isFinite(next))
        return; const timer = window.setTimeout(() => setClock(Date.now()), Math.min(2147483647, Math.max(1, next - now + 1))); return () => window.clearTimeout(timer); }, [items, offset, clock]);
    function dismiss(item: Announcement) { setDismissed(previous => { const next = { ...previous, [item.id]: item.revision }; const retained = Object.fromEntries(Object.entries(next).slice(-200)); try {
        localStorage.setItem(key, JSON.stringify(retained));
    }
    catch { /* Closing remains effective when storage is unavailable. */ } return retained; }); }
    return <Context.Provider value={{ items: active, loading, failed, open, setOpen, reload: () => void reload(), dismiss, dismissed }}>{children}</Context.Provider>;
}
export function AnnouncementButton() {
    const state = React.useContext(Context);
    const t = useText();
    if (!state)
        return null;
    return <><button type="button" className="relative rounded-md p-2 text-fg-muted hover:bg-canvas-inset hover:text-fg-default" aria-label={t('announcements.title')} onClick={() => { state.setOpen(true); state.reload(); }}><Bell className="h-5 w-5" aria-hidden="true"/>{state.items.length > 0 && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent-emphasis" aria-hidden="true"/>}</button><AppModal open={state.open} onOpenChange={state.setOpen} title={t('announcements.title')} size="medium"><div className="space-y-4">{state.loading && <p role="status">{t('announcements.loading')}</p>}{state.failed && <div role="alert"><p>{t('announcements.failed')}</p><button className="mt-2 text-accent-fg" onClick={state.reload}>{t('billing.retryLoading7b4939')}</button></div>}{!state.loading && !state.failed && !state.items.length && <p className="py-8 text-center text-sm text-fg-muted">{t('announcements.empty')}</p>}{state.items.map(item => <article key={item.id} className="rounded-lg border border-border-default p-4"><h3 className="break-words text-base font-semibold">{item.title}</h3><p className="mt-1 text-xs text-fg-muted">{new Date(item.starts_at).toLocaleString(t.locale)} — {new Date(item.ends_at).toLocaleString(t.locale)}</p><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{item.body}</p></article>)}</div></AppModal></>;
}
export function AnnouncementBanners() {
    const state = React.useContext(Context);
    const t = useText();
    if (!state)
        return null;
    const banners = state.items.filter(item => item.banner && state.dismissed[item.id] !== item.revision);
    if (!banners.length)
        return null;
    return <section aria-label={t('announcements.title')} className="max-h-[30dvh] shrink-0 overflow-y-auto border-b border-accent-muted bg-accent-subtle px-4 py-2 text-accent-fg sm:px-5">{banners.map(item => <div key={item.id} className="flex items-start gap-3 py-1"><Bell aria-hidden="true" className="mt-2 h-4 w-4 shrink-0"/><button type="button" className="min-w-0 flex-1 py-1 text-left" onClick={() => state.setOpen(true)}><span className="block break-words text-sm font-semibold">{item.title}</span><span className="mt-0.5 line-clamp-2 whitespace-pre-wrap break-words text-xs leading-5">{item.body}</span><span className="mt-1 inline-flex items-center text-xs">{t('announcements.view')}<ChevronRight aria-hidden="true" className="h-3 w-3"/></span></button><button type="button" aria-label={t('announcements.dismiss', { p0: item.title })} className="shrink-0 rounded-md p-2 hover:bg-accent-muted" onClick={() => state.dismiss(item)}><X aria-hidden="true" className="h-4 w-4"/></button></div>)}</section>;
}
