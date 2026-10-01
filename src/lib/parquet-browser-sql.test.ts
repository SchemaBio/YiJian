import { describe, it, expect } from 'vitest';
import { buildLocalSelection, effectiveField, localPredicate, literal } from './parquet-browser-sql';
describe('browser effective Parquet query', () => {
    const raw = ['Chromosome', 'Position', 'Gene', 'GnomAD_AF', 'Transcript'];
    it('uses the stored baseline and overlays before filtering', () => {
        const q = buildLocalSelection({ offset: 0, limit: 20, filters: [{ column: 'reviewed', operator: 'equals', value: 'false' }, { column: 'acmgClassification', operator: 'equals', value: 'Pathogenic' }] }, raw);
        expect(q.where).toContain("COALESCE(json_extract_string(o.payload, '$.reviewed'), 'false')");
        expect(q.where).toContain("json_extract_string(a.baseline, '$.classification')");
        expect(q.where).toContain('$.acmgOverride');
        expect(effectiveField('acmgScore', raw)).toContain('$.acmgEvidence');
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
