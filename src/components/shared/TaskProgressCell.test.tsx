import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { TaskProgressCell } from './TaskProgressCell';
import type { AnalysisTask } from '@/types/task';
afterEach(cleanup);
it('shows an example label without a synthetic computation progress bar', () => {
  render(<TaskProgressCell task={{origin:'example',status:'completed',progress:100} as AnalysisTask} />);
  expect(screen.getByText('示例')).toBeVisible();
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
});
it('retains progress for ordinary completed tasks', () => {
  render(<TaskProgressCell task={{status:'completed',progress:100} as AnalysisTask} />);
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
});
