import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { STRTab } from './STRTab';
vi.mock('../result-api', () => ({ getSTRs: vi.fn().mockResolvedValue({ total: 1, data: [{ id: 'str', locus: 'chr4:3,074,876-3,074,899', gene: 'HTT', status: 'Normal' }] }), reportVariant: vi.fn(), pinVariant: vi.fn() }));
vi.mock('@schema/ui-kit', () => ({ Input: () => null, Tag: () => null, DataTable: ({ data, columns }: { data: any[]; columns: any[] }) => <div>{data.map(row => <div key={row.id}>{columns.find(column => column.id === 'locus').accessor(row)}</div>)}</div> }));
vi.mock('./GeneLinks', () => ({ GeneLinks: () => null }));
vi.mock('./ReviewCheckboxes', () => ({ PinCheckbox: () => null, ReportCheckbox: () => null, PinColumnHeader: () => null, ReportColumnHeader: () => null }));
vi.mock('./ResultColumnFilter', () => ({ filterableColumns: (columns: unknown) => columns }));
vi.mock('./ParquetColumnFilterBar', () => ({ ParquetColumnFilterBar: () => null }));
vi.mock('./IGVViewer', () => ({ PositionLink: ({ label, onClick }: { label: string; onClick: () => void }) => <button onClick={onClick}>{label}</button>, IGVViewer: ({ taskId, chromosome, position, endPosition }: any) => <div data-testid="igv">{taskId}/{chromosome}/{position}/{endPosition}</div> }));
it('opens the task IGV viewer at the STR interval', async () => {
  render(<STRTab taskId="task-str" />);
  fireEvent.click(await screen.findByRole('button', { name: 'chr4:3,074,876-3,074,899' }));
  expect(screen.getByTestId('igv')).toHaveTextContent('task-str/4/3074876/3074899');
});
