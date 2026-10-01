// The worker queries one immutable dataset and its versioned server overlays.
// Only registered fields/operators may become SQL; values are escaped literals.
export const OVERLAY_FIELDS = ['reviewed', 'reported', 'interpretation', 'acmgClassification', 'acmgEvidence', 'acmgScore', 'acmgProfile', 'acmgState', 'acmgOverride', 'acmgOverrideReason', 'cnvAssessment', 'cnvClassification', 'cnvScore'];
const NUMERIC_FIELDS = new Set(['acmgScore', 'cnvScore', 'Position', 'Start', 'End', 'Quality', 'Depth', 'VAF', 'GnomAD_AF', 'GnomAD_AF_EAS', 'GnomAD_nhomalt_XX', 'GnomAD_nhomalt_XY', 'Pangolin_Gain', 'Pangolin_Loss', 'EVOScore', 'AlphaMissense_AM', 'copy_number', 'score', 'size', 'Repeat_Count', 'RepeatCount', 'Heteroplasmy', 'Heteroplasmy_Level', 'NbVariants', 'Percentage_Homozygosity', 'Average_Depth', 'Log2_Ratio', 'Copy_Ratio', 'Start_Position', 'End_Position']);
export interface LocalFilter {
    column: string;
    operator: string;
    value?: unknown;
}
export interface LocalQuery {
    offset: number;
    limit: number;
    search?: string;
    sort?: string;
    direction?: string;
    filters?: LocalFilter[];
}
export const ident = (s: string) => '"' + s.replaceAll('"', '""') + '"';
export const literal = (s: unknown) => "'" + String(s).replaceAll("'", "''") + "'";
export function fieldType(s: string): 'text' | 'number' | 'enum' | 'boolean' {
    if (s === 'reviewed' || s === 'reported')
        return 'boolean';
    if (s === 'acmgClassification')
        return 'enum';
    if (NUMERIC_FIELDS.has(s) || /(^|_)(af|vaf|depth|score|count|size|start|end|position|ratio|length|fraction|percent|heteroplasmy)(_|$)/i.test(s))
        return 'number';
    return 'text';
}
export function effectiveField(s: string, raw: string[]): string {
    const overlay = `json_extract_string(o.payload, ${literal('$.' + s)})`;
    if (s === 'reviewed' || s === 'reported')
        return `COALESCE(${overlay}, 'false')`;
    if (s === 'cnvAssessment')
        return overlay;
    if (s === 'cnvClassification' || s === 'cnvScore')
        return `json_extract_string(o.payload, ${literal('$.cnvAssessment.' + (s === 'cnvScore' ? 'totalScore' : 'classification'))})`;
    const names: Record<string, string> = { acmgClassification: 'classification', acmgScore: 'score', acmgProfile: 'profile', acmgState: 'state', acmgEvidence: 'criteria' };
    if (s in names) {
        const baseline = `json_extract_string(a.baseline, ${literal('$.' + names[s])})`;
        if (s === 'acmgClassification')
            return `COALESCE(NULLIF(json_extract_string(o.payload, '$.acmgOverride'), ''), CASE WHEN json_exists(o.payload, '$.acmgEvidence') THEN NULLIF(${overlay}, '') ELSE ${baseline} END)`;
        return `CASE WHEN json_exists(o.payload, '$.acmgEvidence') THEN ${overlay} ELSE ${baseline} END`;
    }
    if (OVERLAY_FIELDS.includes(s))
        return overlay;
    if (!raw.includes(s))
        throw new Error('未知筛选字段：' + s);
    return `t.${ident(s)}`;
}
export function localPredicate(f: LocalFilter, raw: string[]): string {
    const x = effectiveField(f.column, raw), text = `CAST(${x} AS VARCHAR)`;
    if (f.operator === 'is_missing')
        return `(${x} IS NULL OR ${text} IN ('', '.'))`;
    if (f.operator === 'is_not_missing')
        return `(${x} IS NOT NULL AND ${text} NOT IN ('', '.'))`;
    const values = Array.isArray(f.value) ? f.value : [f.value];
    if (!values.length || values.length > 1000 || values.some(v => v === undefined || typeof v === 'object'))
        throw new Error('筛选值无效');
    if (f.operator === 'contains')
        return `contains(lower(${text}), lower(${literal(values[0])}))`;
    if (f.operator === 'equals' || f.operator === 'in')
        return `EXISTS (SELECT 1 FROM UNNEST(string_split(${text}, '&')) AS u(v) WHERE v IN (${values.map(literal).join(',')}))`;
    if (fieldType(f.column) !== 'number')
        throw new Error('此列不支持数值筛选');
    if (f.operator === 'between') {
        if (values.length !== 2 || values.some(v => !Number.isFinite(Number(v))) || Number(values[0]) > Number(values[1]))
            throw new Error('范围无效');
        return `EXISTS (SELECT 1 FROM UNNEST(string_split(${text}, '&')) AS u(v) WHERE TRY_CAST(NULLIF(v,'.') AS DOUBLE) BETWEEN ${Number(values[0])} AND ${Number(values[1])})`;
    }
    const ops: Record<string, string> = { gt: '>', gte: '>=', lt: '<', lte: '<=' };
    if (!(f.operator in ops) || !Number.isFinite(Number(values[0])))
        throw new Error('数值筛选无效');
    return `EXISTS (SELECT 1 FROM UNNEST(string_split(${text}, '&')) AS u(v) WHERE TRY_CAST(NULLIF(v,'.') AS DOUBLE) ${ops[f.operator]} ${Number(values[0])})`;
}
export function buildLocalSelection(q: LocalQuery, raw: string[]) {
    if ((q.filters?.length ?? 0) > 40 || (q.search?.length ?? 0) > 256)
        throw new Error('筛选条件超过限制');
    const where = (q.filters ?? []).map(f => localPredicate(f, raw));
    const search = q.search?.trim();
    if (search) {
        const fields = [...raw, 'acmgClassification'];
        where.push('(' + fields.map(s => `contains(lower(CAST(${effectiveField(s, raw)} AS VARCHAR)), lower(${literal(search)}))`).join(' OR ') + ')');
    }
    let order = 't.file_row_number ASC';
    if (q.sort) {
        let x = effectiveField(q.sort, raw);
        if (/^(chromosome|chr|chrom)$/i.test(q.sort)) {
            const v = `regexp_replace(upper(trim(CAST(${x} AS VARCHAR))), '^CHR', '')`;
            x = `CASE WHEN TRY_CAST(${v} AS INTEGER) IS NOT NULL THEN TRY_CAST(${v} AS INTEGER) WHEN ${v}='X' THEN 23 WHEN ${v}='Y' THEN 24 WHEN ${v} IN ('M','MT') THEN 25 ELSE 1000 END`;
        }
        else if (fieldType(q.sort) === 'number')
            x = `(SELECT min(TRY_CAST(NULLIF(v,'.') AS DOUBLE)) FROM UNNEST(string_split(CAST(${x} AS VARCHAR),'&')) AS u(v))`;
        order = `CASE WHEN ${x} IS NULL OR CAST(${x} AS VARCHAR) IN ('','.') THEN 1 ELSE 0 END ASC, ${x} ${q.direction === 'desc' ? 'DESC' : 'ASC'}, t.file_row_number ASC`;
    }
    return { where: where.length ? ' WHERE ' + where.join(' AND ') : '', order };
}
