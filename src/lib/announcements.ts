export interface Announcement {
    id: string;
    title: string;
    body: string;
    starts_at: string;
    ends_at: string;
    banner: boolean;
    revision: number;
}
export function parseAnnouncements(value: unknown): {
    items: Announcement[];
    server_time: string;
    org_id: string;
} {
    const list = value as {
        items?: Announcement[];
        server_time?: string;
        org_id?: string;
    };
    if (!list || !Array.isArray(list.items) || typeof list.server_time !== 'string' || !Number.isFinite(Date.parse(list.server_time)) || list.items.some(item => !item || typeof item.id !== 'string' || typeof item.title !== 'string' || typeof item.body !== 'string' || typeof item.banner !== 'boolean' || !Number.isSafeInteger(item.revision) || item.revision < 1 || !Number.isFinite(Date.parse(item.starts_at)) || !Number.isFinite(Date.parse(item.ends_at))))
        throw new Error('announcements_unavailable');
    if (typeof list.org_id !== "string") throw new Error("announcements_unavailable");
    return { items: list.items, server_time: list.server_time, org_id: list.org_id };
}
