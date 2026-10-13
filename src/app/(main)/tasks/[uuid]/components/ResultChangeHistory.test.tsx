import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { createTextTranslator } from '@/i18n/text';
import { ResultChangeHistory } from './ResultChangeHistory';
vi.mock('@/i18n/useText', () => ({ useText: () => createTextTranslator('en') }));
vi.mock('../result-api', () => ({ getResultRowAdjustmentHistory: vi.fn(async () => [
  { id: 'pin', actor: 'reviewer', reason: '手动置顶', before: { pinned: false }, after: { pinned: true } },
  { id: 'manual', actor: 'reviewer', reason: '临床复核说明', before: {}, after: { interpretation: '患者解读原文' } },
]) }));
it('renders older fixed messages in the interface language while retaining user text', async () => {
  render(<ResultChangeHistory taskId="task" table="snv-indel" rowId="row" active />);
  expect(await screen.findByText('Pin manually')).toBeInTheDocument();
  expect(screen.queryByText('手动置顶')).not.toBeInTheDocument();
  expect(screen.getByText('临床复核说明')).toBeInTheDocument();
  expect(screen.getByText(/患者解读原文/)).toBeInTheDocument();
});
