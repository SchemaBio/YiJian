export const HISTORY_TYPES = [
  ['snv-indel', 'SNP/InDel'], ['cnv-segment', 'CNV Region'], ['cnv-exon', 'CNV Exon'],
  ['str', '动态突变'], ['mei', 'MEI'], ['mt', 'MT'], ['roh', 'ROH'], ['upd', 'UPD'],
] as const;
export type HistoryType = typeof HISTORY_TYPES[number][0];
export interface ReportRow {
  id: string; revision: number; deleted?: boolean; table: HistoryType; taskUuid: string;
  attemptId: string; datasetId?: string; datasetVersion?: string; rowId?: string;
  groupKey: string; reference: string; identityKnown: boolean; fields: Record<string, string>;
  reported: boolean; classification: string; reportedClassification: string;
  firstReportedAt: string | null; lastReportedAt: string | null; reportedBy: string;
  updatedAt: string; adjustmentVersion: number;
  currentSource?: boolean;
}
export interface HistoryTask {
  uuid: string; name: string; sampleId: string; internalId: string; currentAttempt: string; pipeline: string;
}
export interface HistoryGroup {
  id: string; reference: string; identityKnown: boolean; locus: string; gene: string;
  classification: string; classificationCounts: Record<string, number>; detectionCount: number;
  firstReportedAt: string; lastReportedAt: string; sourceCount: number; withdrawnCount: number;
  fields: Record<string, string>;
}
export interface HistoryQuery {
  table: HistoryType; search: string; includeWithdrawn: boolean; filters: Record<string, string>;
  sort: string; direction: 'asc' | 'desc'; page: number; pageSize: number;
}
export interface HistoryQueryResult {
  groups: HistoryGroup[]; total: number; totalVariants: number; totalTasks: number; page: number;
}
export const CLASS_LABELS: Record<string, string> = {
  Pathogenic: '致病', Likely_Pathogenic: '可能致病', VUS: '意义不明',
  Likely_Benign: '可能良性', Benign: '良性', mixed: '分类不一致', '': '未提供',
};
export function locus(fields: Record<string, string>): string {
  const chrom = fields.chromosome || '染色体未提供';
  if (fields.position) return `${chrom}:${fields.position}${fields.ref && fields.alt ? ` ${fields.ref}>${fields.alt}` : ''}`;
  return fields.startPosition && fields.endPosition ? `${chrom}:${fields.startPosition}-${fields.endPosition}` : chrom;
}

function afNumbers(raw: string | undefined): number[] {
  return (raw || '').split(/[&,;|]/).filter(value => value.trim() && value.trim() !== '.').map(Number).filter(Number.isFinite);
}

export class HistoryEngine {
  private rows = new Map<string, ReportRow>();
  private revisions = new Map<string, { revision: number; table?: HistoryType }>();
  private tasks = new Map<string, HistoryTask>();
  private generation = 0;
  private staged = new Map<HistoryType, { rows: Map<string, ReportRow>; tasks: Record<string, HistoryTask> }>();
  private cache = new Map<string, { generation: number; groups: HistoryGroup[]; sources: Map<string, ReportRow[]>; tasks: number; variants: number }>();

  begin(table: HistoryType) { this.staged.set(table, { rows: new Map(), tasks: {} }); }
  stage(table: HistoryType, rows: ReportRow[], tasks: Record<string, HistoryTask>) {
    const pending = this.staged.get(table); if (!pending) throw new Error('history sync is no longer active');
    for (const row of rows) { const prior = pending.rows.get(row.id); if (!prior || row.revision >= prior.revision) pending.rows.set(row.id, row); }
    Object.assign(pending.tasks, tasks);
  }
  commit(table: HistoryType) { const pending = this.staged.get(table); if (!pending) throw new Error('history sync is no longer active'); if (pending.rows.size || Object.keys(pending.tasks).length) this.apply(Array.from(pending.rows.values()), pending.tasks); this.staged.delete(table); }
  discard(table: HistoryType) { this.staged.delete(table); }

  apply(rows: ReportRow[], tasks: Record<string, HistoryTask>): void {
    for (const [id, task] of Object.entries(tasks)) this.tasks.set(id, task);
    for (const row of rows) {
      const previous = this.revisions.get(row.id);
      if (previous && previous.revision >= row.revision) continue;
      this.revisions.set(row.id, { revision: row.revision, table: row.table || this.rows.get(row.id)?.table });
      if (row.deleted) this.rows.delete(row.id); else this.rows.set(row.id, row);
    }
    // Task metadata for a deleted task must not survive in this session.
    const liveTasks = new Set(Array.from(this.rows.values(), row => row.taskUuid));
    for (const id of this.tasks.keys()) if (!liveTasks.has(id)) this.tasks.delete(id);
    this.generation++;
    this.cache.clear();
  }

  clear(table?: HistoryType): void {
    if (!table) { this.rows.clear(); this.tasks.clear(); this.revisions.clear(); this.staged.clear(); }
    else { for (const [id, row] of this.rows) if (row.table === table) this.rows.delete(id); for (const [id, revision] of this.revisions) if (revision.table === table) this.revisions.delete(id); }
    this.generation++; this.cache.clear();
  }

  private grouped(table: HistoryType, includeWithdrawn: boolean) {
    const key = `${table}:${includeWithdrawn}`;
    const cached = this.cache.get(key);
    if (cached && cached.generation === this.generation) return cached;
    const sources = new Map<string, ReportRow[]>();
    const activeGroups = new Set<string>(), activeTasks = new Set<string>();
    for (const row of this.rows.values()) {
      if (row.table !== table) continue;
      if (row.reported) { activeGroups.add(row.groupKey); activeTasks.add(row.taskUuid); }
      if (!includeWithdrawn && !row.reported) continue;
      const members = sources.get(row.groupKey) || []; members.push(row); sources.set(row.groupKey, members);
    }
    const groups: HistoryGroup[] = [];
    for (const [id, rows] of sources) {
      const active = rows.filter(row => row.reported);
      const representative = active[0] || rows[0];
      const classes = new Map<string, Set<string>>();
      for (const row of active) {
        const tasks = classes.get(row.classification || '') || new Set<string>(); tasks.add(row.taskUuid); classes.set(row.classification || '', tasks);
      }
      const classificationCounts = Object.fromEntries(Array.from(classes, ([name, tasks]) => [name, tasks.size]));
      const first = active.map(row => row.firstReportedAt).filter((value): value is string => Boolean(value)).sort();
      const last = active.map(row => row.lastReportedAt).filter((value): value is string => Boolean(value)).sort();
      groups.push({ id, reference: representative.reference, identityKnown: representative.identityKnown,
        locus: locus(representative.fields), gene: [...new Set(rows.map(row => row.fields.gene || row.fields.mtGene).filter(Boolean))].join(' / '),
        classification: classes.size > 1 ? 'mixed' : [...classes.keys()][0] || '', classificationCounts,
        detectionCount: new Set(active.map(row => row.taskUuid)).size, firstReportedAt: first[0] || '', lastReportedAt: last.at(-1) || '',
        sourceCount: rows.length, withdrawnCount: rows.length - active.length, fields: representative.fields });
    }
    const result = { generation: this.generation, groups, sources, tasks: activeTasks.size, variants: activeGroups.size };
    this.cache.set(key, result); return result;
  }

  query(query: HistoryQuery): HistoryQueryResult {
    const snapshot = this.grouped(query.table, query.includeWithdrawn);
    const search = query.search.trim().toLowerCase();
    const filtered = snapshot.groups.filter(group => {
      const rows = snapshot.sources.get(group.id) || [];
      if (search && ![group.locus, group.gene, group.reference, ...rows.flatMap(row => {
        const task = this.tasks.get(row.taskUuid);
        return [row.taskUuid, task?.name || '', task?.internalId || '', task?.sampleId || '', ...Object.values(row.fields)];
      })].join(' ').toLowerCase().includes(search)) return false;
      return Object.entries(query.filters).every(([key, filter]) => {
        if (!filter.trim()) return true;
        if (key === 'classification') return filter === '__missing' ? '' in group.classificationCounts || !Object.keys(group.classificationCounts).length : filter === 'mixed' ? group.classification === 'mixed' : filter in group.classificationCounts;
        const value = key === 'af' ? group.fields.gnomadAF || '' : String(group[key as keyof HistoryGroup] ?? '');
        if (filter === '__missing' || filter === '未提供') return !value;
        if (filter === '__present' || filter === '已提供') return Boolean(value);
        if (key === 'detectionCount' || key === 'af') {
          const match = filter.match(/^\s*(>=|<=|>|<|=)?\s*([\d.eE+-]+)\s*$/);
          if (!match) return false;
          const n = Number(match[2]); if (!Number.isFinite(n)) return false;
          const values = key === 'af' ? afNumbers(group.fields.gnomadAF) : [group.detectionCount];
          return values.some(value => match[1] === '>=' ? value >= n : match[1] === '<=' ? value <= n : match[1] === '>' ? value > n : match[1] === '<' ? value < n : value === n);
        }
        return value.toLowerCase().includes(filter.toLowerCase());
      });
    });
    const sign = query.direction === 'asc' ? 1 : -1;
    const collator = new Intl.Collator('zh-CN', { numeric: true });
    filtered.sort((a, b) => {
      const afA = query.sort === 'af' ? afNumbers(a.fields.gnomadAF) : [], afB = query.sort === 'af' ? afNumbers(b.fields.gnomadAF) : [];
      const av = query.sort === 'af' ? (afA.length ? Math.min(...afA) : undefined) : a[query.sort as keyof HistoryGroup], bv = query.sort === 'af' ? (afB.length ? Math.min(...afB) : undefined) : b[query.sort as keyof HistoryGroup];
      if (!av && av !== 0) return !bv && bv !== 0 ? a.id.localeCompare(b.id) : 1;
      if (!bv && bv !== 0) return -1;
      const primary = query.sort === 'af' && Number.isFinite(Number(av)) && Number.isFinite(Number(bv)) ? Number(av) - Number(bv) : typeof av === 'number' && typeof bv === 'number' ? av - bv : collator.compare(String(av), String(bv));
      return primary * sign || b.lastReportedAt.localeCompare(a.lastReportedAt) || a.id.localeCompare(b.id);
    });
    const page = Math.max(1, Math.min(query.page, Math.ceil(filtered.length / query.pageSize) || 1));
    return { groups: filtered.slice((page - 1) * query.pageSize, page * query.pageSize), total: filtered.length,
      totalVariants: snapshot.variants, totalTasks: snapshot.tasks, page };
  }

  sources(table: HistoryType, id: string, includeWithdrawn: boolean) {
    const rows = this.grouped(table, includeWithdrawn).sources.get(id) || [];
    return rows.map(row => ({ row, task: this.tasks.get(row.taskUuid) }));
  }
}
