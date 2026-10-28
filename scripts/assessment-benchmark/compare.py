"""Compare actual browser reports. Unknown acceptance gates never become passes."""
import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path


def load(path):
    report = json.loads(Path(path).read_text(encoding='utf-8'))
    if report.get('kind') != 'yijian-synthetic-browser-v1' or not report.get('completed') or report.get('error'):
        raise ValueError('REPORT_INCOMPLETE')
    return report


def quantile(values, q):
    import math
    ordered = sorted(values)
    return ordered[max(0, math.ceil(len(ordered) * q) - 1)]


def compare(baseline, optimized):
    if baseline['metadata']['optimized'] is not False or optimized['metadata']['optimized'] is not True:
        raise ValueError('REPORT_PATHS_NOT_DISTINCT')
    for key in ['userAgent', 'hardwareConcurrency', 'deviceMemoryGiB', 'crossOriginIsolated', 'fixtureManifest', 'coldDefinition', 'hotDefinition', 'weakDefinition']:
        if baseline['metadata'].get(key) != optimized['metadata'].get(key):
            raise ValueError('ENVIRONMENT_OR_FIXTURE_MISMATCH')
    if baseline['metadata'].get('visibilityState') != 'visible' or optimized['metadata'].get('visibilityState') != 'visible':
        raise ValueError('PAGE_NOT_VISIBLE_AT_START')
    grouped = []
    expected = {(size, cache) for size in [10000, 50000, 100000] for cache in ['cold', 'hot']}
    if any({(run['size'], run['cache']) for run in report['runs']} != expected for report in [baseline, optimized]):
        raise ValueError('UNEXPECTED_RUN_GROUPS')
    seen = set()
    for size, cache in sorted(expected):
        a = [run for run in baseline['runs'] if run['size'] == size and run['cache'] == cache]
        b = [run for run in optimized['runs'] if run['size'] == size and run['cache'] == cache]
        if min(len(a), len(b)) < 5 or len(a) != len(b):
            raise ValueError('INSUFFICIENT_OR_UNBALANCED_REPETITIONS')
        if any(len({run['repeat'] for run in runs}) != len(runs) for runs in [a, b]):
            raise ValueError('REPETITIONS_NOT_DISTINCT')
        if any(run['scenario'] != 'normal' or run['state'] != 'ready' or run['rows'] != size or not run['previewWithdrawn'] for run in a + b):
            raise ValueError('RUN_NOT_COMPLETE')
        for key in ['resultDigest', 'pageDigest']:
            digests = {run[key] for run in a + b}
            if len(digests) != 1 or any(not isinstance(value, str) or not re.fullmatch('[a-f0-9]{64}', value) for value in digests):
                raise ValueError('RESULT_OR_ORDER_PARITY_FAILED')
        metrics = {}
        for key in ['firstReadableMs', 'fullMs']:
            if any(run[key] is None for run in a + b):
                raise ValueError('MISSING_TIMING')
            av, bv = [run[key] for run in a], [run[key] for run in b]
            metrics[key] = {'baselineP50': quantile(av, .5), 'baselineP95': quantile(av, .95), 'optimizedP50': quantile(bv, .5), 'optimizedP95': quantile(bv, .95),
                            'p95ReductionPercent': 100 * (1 - quantile(bv, .95) / quantile(av, .95))}
        target = 50 if cache == 'hot' else 25
        grouped.append({'size': size, 'cache': cache, 'nPerPath': len(a), 'metrics': metrics, 'fullTimeTargetReductionPercent': target,
                        'fullTimeTargetMet': metrics['fullMs']['p95ReductionPercent'] >= target, 'exactResultAndFirstPageParity': True,
                        'baselineHeapCounterMax': max(run['mainRealmReportedHeapPeakBytes'] or 0 for run in a),
                        'optimizedHeapCounterMax': max(run['mainRealmReportedHeapPeakBytes'] or 0 for run in b)})
        seen.add((size, cache))
    return {'version': 'assessment-browser-comparison-v1', 'createdUtc': datetime.now(timezone.utc).isoformat(),
            'baselineCommit': baseline['metadata']['commit'], 'optimizedCommit': optimized['metadata']['commit'],
            'environment': {key: baseline['metadata'][key] for key in ['userAgent', 'hardwareConcurrency', 'deviceMemoryGiB', 'crossOriginIsolated', 'visibilityState']},
            'groups': grouped, 'exactParityPassed': seen == expected,
            'timingTargetsPassed': all(group['fullTimeTargetMet'] for group in grouped),
            'memoryAcceptance': 'unverified: implementation-dependent heap counter is not a proven whole-page plus worker peak',
            'overallAcceptance': False, 'defaultEnableAllowed': False,
            'limitations': ['Five runs provide coarse nearest-rank p95 (the maximum); repeat on representative hardware.',
                            'Synthetic local data and 20 ms normal fixture latency do not establish production network performance.',
                            'Cold runs retain compiled assets and potentially OS/HTTP caches.',
                            'Product toolbar visual behavior and whole-page memory require separate acceptance.']}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('baseline')
    parser.add_argument('optimized')
    parser.add_argument('--output')
    args = parser.parse_args()
    result = compare(load(args.baseline), load(args.optimized))
    text = json.dumps(result, indent=2)
    if args.output:
        Path(args.output).write_text(text + '\n', encoding='utf-8')
    print(text)
