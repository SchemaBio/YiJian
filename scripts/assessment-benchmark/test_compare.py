import copy
import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('benchmark_compare', Path(__file__).with_name('compare.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def reports():
    baseline = {'metadata': {'optimized': False, 'commit': 'base', 'userAgent': 'fixed-browser', 'hardwareConcurrency': 8, 'deviceMemoryGiB': 8,
                            'crossOriginIsolated': True, 'fixtureManifest': {'sha256': 'fixed'}, 'coldDefinition': 'fixed', 'hotDefinition': 'fixed',
                            'weakDefinition': 'fixed', 'visibilityState': 'visible'}, 'runs': []}
    for size in [10000, 50000, 100000]:
        for cache in ['cold', 'hot']:
            for repeat in range(1, 6):
                baseline['runs'].append({'size': size, 'cache': cache, 'repeat': repeat, 'scenario': 'normal', 'state': 'ready', 'rows': size,
                                         'previewWithdrawn': True, 'resultDigest': 'a' * 64, 'pageDigest': 'b' * 64, 'firstReadableMs': 1000, 'fullMs': 1000,
                                         'mainRealmReportedHeapPeakBytes': 100})
    optimized = copy.deepcopy(baseline)
    optimized['metadata'].update({'optimized': True, 'commit': 'next'})
    for run in optimized['runs']:
        run['fullMs'] = 400 if run['cache'] == 'hot' else 600
        run['firstReadableMs'] = 200
    return baseline, optimized


class ComparisonGates(unittest.TestCase):
    def test_timing_success_does_not_approve_unknown_memory_or_default_enable(self):
        result = module.compare(*reports())
        self.assertTrue(result['exactParityPassed'])
        self.assertTrue(result['timingTargetsPassed'])
        self.assertFalse(result['overallAcceptance'])
        self.assertFalse(result['defaultEnableAllowed'])

    def test_target_misses_are_reported_without_relaxation(self):
        baseline, optimized = reports()
        for run in optimized['runs']:
            run['fullMs'] = 1001
        result = module.compare(baseline, optimized)
        self.assertFalse(result['timingTargetsPassed'])
        self.assertTrue(all(group['metrics']['fullMs']['p95ReductionPercent'] < 0 for group in result['groups']))

    def test_rejects_identity_changes_incomplete_results_and_repeated_samples(self):
        for defect in ['fixture', 'browser', 'result', 'sort', 'missing', 'incomplete', 'duplicate', 'unknown-group', 'empty-digest']:
            with self.subTest(defect=defect):
                baseline, optimized = reports()
                if defect == 'fixture':
                    optimized['metadata']['fixtureManifest'] = {'sha256': 'different'}
                elif defect == 'browser':
                    optimized['metadata']['userAgent'] = 'other'
                elif defect == 'result':
                    optimized['runs'][0]['resultDigest'] = 'c' * 64
                elif defect == 'sort':
                    optimized['runs'][0]['pageDigest'] = 'c' * 64
                elif defect == 'missing':
                    optimized['runs'].pop()
                elif defect == 'incomplete':
                    optimized['runs'][0]['state'] = 'cancelled'
                elif defect == 'duplicate':
                    optimized['runs'][1]['repeat'] = optimized['runs'][0]['repeat']
                elif defect == 'unknown-group':
                    optimized['runs'][0]['size'] = 1
                else:
                    for run in baseline['runs'] + optimized['runs']:
                        run['pageDigest'] = ''
                with self.assertRaises(ValueError):
                    module.compare(baseline, optimized)


if __name__ == '__main__':
    unittest.main()
