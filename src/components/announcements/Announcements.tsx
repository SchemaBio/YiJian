'use client';
import * as React from 'react';
import { Bell, CalendarDays, ChevronRight, Megaphone, X } from 'lucide-react';
import { api } from '@/lib/api';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';
import { parseAnnouncements, type Announcement } from '@/lib/announcements';
import { useAuth } from '@/components/providers/AuthProvider';
import { useText } from '@/i18n/useText';
import { createPortal } from 'react-dom';
type AnnouncementsState = {
    items: Announcement[];
    loading: boolean;
    failed: boolean;
    open: boolean;
    setOpen: (open: boolean) => void;
    reload: () => void;
    dismiss: (item: Announcement) => void;
    dismissed: Record<string, number>;
    unread: boolean;
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
    const { user, currentOrg } = useAuth();
    const orgID = currentOrg?.id ?? user?.orgId ?? "";
    const scopeKey = `${user?.id ?? "session"}:${orgID}`;
    const [loadedScope,setLoadedScope] = React.useState("");
    const [items, setItems] = React.useState<Announcement[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [failed, setFailed] = React.useState(false);
    const [open, setOpen] = React.useState(false);
    const [dismissed, setDismissed] = React.useState<Record<string, number>>({});
    const [offset, setOffset] = React.useState(0);
    const [clock, setClock] = React.useState(Date.now());
    const key = 'yj:announcement-dismissals:' + scopeKey;
    const readKey = 'yj:announcement-reads:' + scopeKey;
    const [readState, setReadState] = React.useState<{ scope: string; revisions: Record<string, number> }>({ scope: '', revisions: {} });
    React.useEffect(() => {
        function read() {
            let revisions: Record<string, number> = {};
            try {
                const value = JSON.parse(localStorage.getItem(readKey) || '{}');
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    revisions = Object.fromEntries(Object.entries(value).filter(([, revision]) => Number.isSafeInteger(revision) && (revision as number) > 0)) as Record<string, number>;
                }
            } catch { /* Reading still works when browser storage is unavailable. */ }
            setReadState({ scope: scopeKey, revisions });
        }
        function sync(event: StorageEvent) { if (event.key === readKey || event.key === null) read(); }
        read(); window.addEventListener('storage', sync);
        return () => window.removeEventListener('storage', sync);
    }, [readKey, scopeKey]);
    React.useEffect(() => { function read() { try {
        const value = JSON.parse(localStorage.getItem(key) || '{}');
        setDismissed(value && typeof value === 'object' && !Array.isArray(value) ? value : {});
    }
    catch {
        setDismissed({});
    } } read(); window.addEventListener('storage', read); return () => window.removeEventListener('storage', read); }, [key]);
    const active = (loadedScope === scopeKey ? items : []).filter(item => Date.parse(item.starts_at) <= clock + offset && Date.parse(item.ends_at) > clock + offset);
    const unread = active.some(item => readState.scope !== scopeKey || readState.revisions[item.id] !== item.revision);
    React.useEffect(() => {
        if (!open || loading || failed || loadedScope !== scopeKey || readState.scope !== scopeKey || !unread) return;
        // The center displays full announcement bodies, including revisions fetched while open.
        const revisions = { ...readState.revisions };
        for (const item of active) revisions[item.id] = item.revision;
        try { localStorage.setItem(readKey, JSON.stringify(revisions)); }
        catch { /* Keep this visit read even when persistence is unavailable. */ }
        setReadState({ scope: scopeKey, revisions });
    }, [open, loading, failed, loadedScope, scopeKey, readState, unread, items, clock, offset, readKey]);
    const abort = React.useRef<AbortController | null>(null);
    const generation = React.useRef(0);
    const reload = React.useCallback(async () => { const version = ++generation.current; abort.current?.abort(); const controller = new AbortController(); abort.current = controller; try {
        if (!orgID) throw new Error('organization_required');
        const result = parseAnnouncements(await api.get('/v1/announcements', { coreApi: false, cache: 'no-store', signal: controller.signal }));
        if (result.org_id?.toLowerCase() !== orgID.toLowerCase()) throw new Error('announcement_scope_changed');
        if (!controller.signal.aborted && version === generation.current) {
            setLoadedScope(scopeKey);
            setItems(result.items);
            setOffset(Date.parse(result.server_time) - Date.now());
            setClock(Date.now());
            setFailed(false);
        }
    }
    catch {
        if (!controller.signal.aborted && version === generation.current) { setLoadedScope(scopeKey); setItems([]); setFailed(true); }
    }
    finally {
        if (!controller.signal.aborted && version === generation.current)
            setLoading(false);
    } }, [orgID, scopeKey]);
    React.useEffect(() => { setItems([]); setLoadedScope(''); setFailed(false); setLoading(true); setOpen(false); void reload(); const timer = window.setInterval(() => { if (!document.hidden)
        void reload(); }, 60000); function visible() { if (!document.hidden)
        void reload(); } document.addEventListener('visibilitychange', visible); return () => { ++generation.current; abort.current?.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange', visible); }; }, [reload, key]);
    React.useEffect(() => { const now = Date.now() + offset; const next = Math.min(...items.map(item => Date.parse(item.ends_at)).filter(end => end > now)); if (!Number.isFinite(next))
        return; const timer = window.setTimeout(() => setClock(Date.now()), Math.min(2147483647, Math.max(1, next - now + 1))); return () => window.clearTimeout(timer); }, [items, offset, clock]);
    function dismiss(item: Announcement) { setDismissed(previous => { const next = { ...previous, [item.id]: item.revision }; const retained = Object.fromEntries(Object.entries(next).slice(-200)); try {
        localStorage.setItem(key, JSON.stringify(retained));
    }
    catch { /* Closing remains effective when storage is unavailable. */ } return retained; }); }
    return <Context.Provider value={{ items: active, loading, failed, open: open && loadedScope === scopeKey, setOpen, reload: () => void reload(), dismiss, dismissed, unread }}>{children}</Context.Provider>;
}
export function AnnouncementButton() {
  const state = React.useContext(Context);
  const t = useText();
  const trigger = React.useRef<HTMLButtonElement>(null);
  const panel = React.useRef<HTMLDivElement>(null);
  const panelID = React.useId();
  const [placement, setPlacement] = React.useState<React.CSSProperties>();
  const open = state?.open ?? false;
  const setOpen = state?.setOpen;
  React.useLayoutEffect(() => {
    if (!open) return;
    function position() {
      const anchor = trigger.current?.getBoundingClientRect();
      if (!anchor) return;
      const width = Math.min(460, Math.max(0, window.innerWidth - 24));
      const top = Math.max(12, Math.min(anchor.bottom + 10, window.innerHeight - 12));
      setPlacement({ position: 'fixed', width, top, left: Math.max(12, Math.min(anchor.right - width, window.innerWidth - width - 12)), maxHeight: Math.min(640, Math.max(0, window.innerHeight - top - 12)) });
    }
    position();
    panel.current?.focus({ preventScroll: true });
    function outside(event: Event) {
      const target = event.target as Node | null;
      if (target && !panel.current?.contains(target) && !trigger.current?.contains(target)) setOpen?.(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault(); setOpen?.(false); trigger.current?.focus();
      }
    }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [open, setOpen]);
  if (!state) return null;
  return <>
    <button ref={trigger} type="button" className="yj-announcement-trigger" data-state={open ? 'open' : 'closed'} aria-label={t('announcements.title')} title={t('announcements.title')} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? panelID : undefined} onClick={() => { state.setOpen(!open); if (!open) state.reload(); }}>
      <Bell className="h-5 w-5" aria-hidden="true"/>{state.unread && <span className="yj-announcement-dot" aria-hidden="true"/>}
    </button>
    {open && createPortal(<div ref={panel} id={panelID} role="dialog" tabIndex={-1} style={placement} className="yj-announcement-popover" aria-label={t('announcements.title')}>
      <div className="yj-announcement-popover-heading"><h2><Bell size={17} aria-hidden="true"/>{t('announcements.title')}</h2><button type="button" className="yj-announcement-popover-close" aria-label={t('common.closea1f5fe', { p0: t('announcements.title') })} onClick={() => { state.setOpen(false); trigger.current?.focus(); }}><X size={17} aria-hidden="true"/></button></div>
      <div className="yj-announcement-center">
        <p className="yj-announcement-intro">{t('announcements.intro')}</p>
        {state.loading && <p role="status">{t('announcements.loading')}</p>}
        {state.failed && <div role="alert" className="yj-announcement-error"><p>{t('announcements.failed')}</p><button onClick={state.reload}>{t('billing.retryLoading7b4939')}</button></div>}
        {!state.loading && !state.failed && !state.items.length && <div className="yj-announcement-empty"><span><Bell size={24} aria-hidden="true"/></span><p>{t('announcements.empty')}</p></div>}
        {state.items.map(item => <article key={item.id} className="yj-announcement-article"><div className="yj-announcement-article-heading"><span className="yj-announcement-article-icon"><Megaphone size={18} aria-hidden="true"/></span><h3>{item.title}</h3></div><p className="yj-announcement-date"><CalendarDays size={13} aria-hidden="true"/><time dateTime={item.starts_at}>{new Date(item.starts_at).toLocaleString(t.locale)}</time><span aria-hidden="true">—</span><time dateTime={item.ends_at}>{new Date(item.ends_at).toLocaleString(t.locale)}</time></p><p className="yj-announcement-body">{item.body}</p></article>)}
      </div>
    </div>, document.body)}
  </>;
}
export function AnnouncementBanners() {
  const state = React.useContext(Context);
  const t = useText();
  if (!state) return null;
  const banners = state.items.filter(item => item.banner && state.dismissed[item.id] !== item.revision);
  if (!banners.length) return null;
  return <section aria-label={t('announcements.title')} className="yj-announcement-banners">
    {banners.map(item => <div key={item.id} className="yj-announcement-banner">
      <span className="yj-announcement-banner-icon"><Megaphone size={20} aria-hidden="true"/></span>
      <button type="button" className="yj-announcement-banner-content" onClick={() => state.setOpen(true)}>
        <strong>{item.title}</strong><span className="yj-announcement-banner-excerpt">{item.body.replace(/\s+/g, ' ')}</span>
        <span className="yj-announcement-banner-link">{t('announcements.view')}<ChevronRight size={14} aria-hidden="true"/></span>
      </button>
      <button type="button" aria-label={t('announcements.dismiss', { p0: item.title })} className="yj-announcement-banner-close" onClick={() => state.dismiss(item)}><X size={16} aria-hidden="true"/></button>
    </div>)}
  </section>;
}
