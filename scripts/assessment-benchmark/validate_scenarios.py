"""Validate completed synthetic browser failure/latency/cancel replays."""
import argparse
import json
from pathlib import Path

from compare import load


def validate(folder):
    checks = []
    for scenario in ['weak', 'reference_failure', 'cancel']:
        baseline = load(folder / f'baseline-{scenario}.json')
        optimized = load(folder / f'optimized-{scenario}.json')
        for key in ['userAgent', 'hardwareConcurrency', 'deviceMemoryGiB', 'fixtureManifest']:
            if baseline['metadata'][key] != optimized['metadata'][key]:
                raise ValueError('SCENARIO_ENVIRONMENT_MISMATCH')
        if baseline['metadata']['optimized'] is not False or optimized['metadata']['optimized'] is not True:
            raise ValueError('SCENARIO_PATHS_NOT_DISTINCT')
        for size in [10000, 50000, 100000]:
            for cache in ['cold', 'hot']:
                a = [run for run in baseline['runs'] if run['size'] == size and run['cache'] == cache]
                b = [run for run in optimized['runs'] if run['size'] == size and run['cache'] == cache]
                if not a or len(a) != len(b):
                    raise ValueError('SCENARIO_COVERAGE_INCOMPLETE')
                if any(run['scenario'] != scenario or not run['previewWithdrawn'] for run in a + b):
                    raise ValueError('SCENARIO_OR_PREVIEW_INVALID')
                expected_state = 'cancelled' if scenario == 'cancel' else 'ready'
                expected_rows = 0 if scenario == 'cancel' else size
                if any(run['state'] != expected_state or run['rows'] != expected_rows for run in a + b):
                    raise ValueError('PARTIAL_RESULT_PUBLISHED')
                for key in ['resultDigest', 'pageDigest']:
                    if len({run[key] for run in a + b}) != 1 or any(not run[key] for run in a + b):
                        raise ValueError('SCENARIO_RESULT_PARITY_FAILED')
                    if scenario == 'weak':
                        for name, runs in [('baseline', a), ('optimized', b)]:
                            normal = load(folder / f'{name}-normal.json')
                            expected = {run[key] for run in normal['runs'] if run['size'] == size and run['cache'] == cache}
                            if expected != {run[key] for run in runs}:
                                raise ValueError('LATENCY_CHANGED_RESULT')
                if scenario == 'reference_failure' and cache == 'hot':
                    if any(run['requests'].get('cnv_reference', 0) < 1 or run['requests'].get('gene_reference', 0) < 1 for run in a + b):
                        raise ValueError('DEGRADED_RESULT_REUSED_AS_COMPLETE')
                checks.append({'scenario': scenario, 'size': size, 'cache': cache, 'nPerPath': len(a), 'state': expected_state,
                               'rows': expected_rows, 'previewWithdrawn': True, 'fullResultAndPageParity': True})
    return {'version': 'assessment-browser-scenarios-v1', 'allChecksPassed': True, 'checks': checks,
            'scope': 'Engineering replay on synthetic local inputs; latency-only weak mode, not a bandwidth/packet-loss test or clinical evaluation.'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('folder', type=Path)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    result = json.dumps(validate(args.folder), indent=2)
    if args.output:
        args.output.write_text(result + '\n', encoding='utf-8')
    print(result)
