import json
import tempfile
import unittest
from pathlib import Path

from test_compare import reports
from validate_scenarios import validate

TEST_ROOT = Path(__file__).resolve().parents[2] / '.assessment-benchmark' / 'test-data'
TEST_ROOT.mkdir(parents=True, exist_ok=True)


def write_reports(folder, defect=None):
    for scenario in ['weak', 'reference_failure', 'cancel']:
        baseline, optimized = reports()
        for name, report in [('baseline', baseline), ('optimized', optimized)]:
            report.update({'kind': 'yijian-synthetic-browser-v1', 'completed': True})
            report['runs'] = [run for run in report['runs'] if run['repeat'] == 1]
            for run in report['runs']:
                run.update({'scenario': scenario, 'requests': {'cnv_reference': 1, 'gene_reference': 2}})
                if scenario == 'cancel':
                    run.update({'state': 'cancelled', 'rows': 0})
            if name == 'optimized':
                if defect == 'partial' and scenario == 'cancel':
                    report['runs'][0]['rows'] = 1000
                if defect == 'preview':
                    report['runs'][0]['previewWithdrawn'] = False
                if defect == 'cached' and scenario == 'reference_failure':
                    for run in report['runs']:
                        if run['cache'] == 'hot':
                            run['requests'] = {}
                if defect == 'parity':
                    report['runs'][0]['resultDigest'] = 'c' * 64
                if defect == 'incomplete':
                    report['completed'] = False
            (folder / f'{name}-{scenario}.json').write_text(json.dumps(report), encoding='utf-8')


class ScenarioGates(unittest.TestCase):
    def test_complete_replays_cover_all_scales_and_cache_states(self):
        with tempfile.TemporaryDirectory(dir=TEST_ROOT) as location:
            folder = Path(location)
            self.assertTrue(folder.resolve().is_relative_to(TEST_ROOT.resolve()))
            write_reports(folder)
            result = validate(folder)
            self.assertTrue(result['allChecksPassed'])
            self.assertEqual(18, len(result['checks']))

    def test_failed_gates_cannot_be_reported_as_completed_acceptance(self):
        for defect in ['partial', 'preview', 'cached', 'parity', 'incomplete']:
            with self.subTest(defect=defect), tempfile.TemporaryDirectory(dir=TEST_ROOT) as location:
                folder = Path(location)
                self.assertTrue(folder.resolve().is_relative_to(TEST_ROOT.resolve()))
                write_reports(folder, defect)
                with self.assertRaises(ValueError):
                    validate(folder)


if __name__ == '__main__':
    unittest.main()
