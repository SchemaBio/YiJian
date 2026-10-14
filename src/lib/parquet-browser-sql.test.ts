import { describe, it, expect } from 'vitest';
import { buildLocalSelection, effectiveField, localPredicate, literal } from './parquet-browser-sql';
describe('browser effective Parquet query', () => {
    const raw = ['Chromosome', 'Position', 'Gene', 'GnomAD_AF', 'Transcript'];
    it('promotes reported rows ahead of pinned-only rows before user sorting and pagination', () => {
        const reported = `COALESCE(TRY_CAST(${effectiveField('reported', raw)} AS BOOLEAN), FALSE)`;
        const pinned = `COALESCE(TRY_CAST(${effectiveField('pinned', raw)} AS BOOLEAN), FALSE)`;
        for (const direction of ['asc', 'desc']) {
            const q = buildLocalSelection({ offset: 20, limit: 20, sort: 'Position', direction }, raw);
            expect(q.order.startsWith(`CASE WHEN ${reported} THEN 0 WHEN ${pinned} THEN 1 ELSE 2 END ASC,`)).toBe(true);
            expect(q.order).toContain('$.phenotypeMatch.score');
            expect(q.order).toContain('$.familySupport');
            expect(q.order).toContain(` ${direction.toUpperCase()}, t.file_row_number ASC`);
        }
    });
    it('excludes literal text without case sensitivity, including empty cells', () => {
        const predicate = localPredicate({ column: 'Gene', operator: 'not_contains', value: "BRCA'_%" }, raw);
        expect(predicate).toBe(`NOT contains(lower(COALESCE(CAST(t."Gene" AS VARCHAR), '')), lower('BRCA''_%'))`);
        expect(buildLocalSelection({ offset: 0, limit: 20, filters: [{ column: 'Gene', operator: 'not_contains', value: 'BRCA' }] }, raw).where).toContain('NOT contains(');
    });
    it('uses the stored baseline and overlays before filtering', () => {
        const q = buildLocalSelection({ offset: 0, limit: 20, filters: [{ column: 'reviewed', operator: 'equals', value: 'false' }, { column: 'acmgClassification', operator: 'equals', value: 'Pathogenic' }] }, raw);
        expect(q.where).toContain("COALESCE(json_extract_string(o.payload, '$.reviewed'), 'false')");
        expect(q.where).toContain("json_extract_string(a.baseline, '$.classification')");
        expect(q.where).toContain('$.acmgOverride');
        expect(effectiveField('acmgScore', raw)).toContain('$.acmgEvidence');
    });
    it('matches any equivalent spelling and excludes every spelling, retaining missing cells', () => {
        const raw = ['Zygosity'];
        const include = localPredicate({column:'Zygosity', operator:'contains', value:['Het', 'Heterozygous']}, raw);
        expect(include).toBe('(contains(lower(CAST(t."Zygosity" AS VARCHAR)), lower(\'Het\')) OR contains(lower(CAST(t."Zygosity" AS VARCHAR)), lower(\'Heterozygous\')))');
        const exclude = localPredicate({column:'Zygosity', operator:'not_contains', value:['Het', 'Heterozygous']}, raw);
        expect(exclude).toBe('NOT (contains(lower(COALESCE(CAST(t."Zygosity" AS VARCHAR), \'\')), lower(\'Het\')) OR contains(lower(COALESCE(CAST(t."Zygosity" AS VARCHAR), \'\')), lower(\'Heterozygous\')))');
    });
    it('preserves multi-value any-match filters and minimum numeric sorting', () => {
        const q = buildLocalSelection({ offset: 0, limit: 20, sort: 'GnomAD_AF', filters: [{ column: 'GnomAD_AF', operator: 'between', value: ['0', '0.001'] }] }, raw);
        expect(q.where).toContain('UNNEST(string_split');
        expect(q.order).toContain('min(TRY_CAST');
        expect(q.order).toContain('t.file_row_number ASC');
    });
    it('rejects unknown fields and invalid bounds, quotes values safely', () => {
        expect(() => localPredicate({ column: 'arbitrary SQL', operator: 'equals', value: 'x' }, raw)).toThrow('未知');
        expect(() => localPredicate({ column: 'Position', operator: 'between', value: ['2', '1'] }, raw)).toThrow('范围');
        expect(literal("a'; DELETE FROM source;--")).toBe("'a''; DELETE FROM source;--'");
    });
    it('uses natural chromosomes and leaves missing values last', () => {
        const q = buildLocalSelection({ offset: 0, limit: 20, sort: 'Chromosome', direction: 'desc' }, raw);
        expect(q.order).toContain("WHEN");
        expect(q.order).toContain("='X' THEN 23");
        expect(q.order).toContain('DESC');
    });
});
