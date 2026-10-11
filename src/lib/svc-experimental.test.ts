import { describe, expect, it } from 'vitest';
import { svcExperimentalInput, unicodeSpanToUTF16, SVC_EXPERIMENTAL_COMMIT } from './svc-experimental';
describe('SVC experimental method and Unicode spans', () => {
  it('maps curator materials without promoting local confirmation or classification', () => {
    const mapped = svcExperimentalInput({ disease:'MONDO:1', moi:'AR', confirmed:true, geneDiseaseValidity:'STRONG', inputs:{ workflow:'nonsense', impact:{ prediction_outcome:'NMD_NO_RESCUE', initial_points:'6' }, population:{ faf:'0.000001', daft:'0.0001' } } });
    expect(mapped).toMatchObject({ upstream_commit:SVC_EXPERIMENTAL_COMMIT, moi:'AR', variant_impact:{workflow:'nonsense', initial_points:'6'} });
    expect(mapped).not.toHaveProperty('confirmed'); expect(mapped).not.toHaveProperty('classification');
  });
  it('preserves missing method values rather than introducing zero', () => {
    expect(svcExperimentalInput({disease:'',moi:'AD',inputs:{},confirmed:false})).not.toHaveProperty('variant_impact');
  });
  it('converts character spans including emoji and rejects invalid indices', () => {
    expect(unicodeSpanToUTF16('甲😀乙',1,2)).toEqual([1,3]);
    expect(unicodeSpanToUTF16('甲😀乙',2,3)).toEqual([3,4]);
    expect(() => unicodeSpanToUTF16('甲',0,2)).toThrow();
  });
});
