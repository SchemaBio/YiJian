import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ flavor: 'squid', org: 'org-a', get: vi.fn() }));
vi.mock('@/lib/runtime-config', () => ({ getRuntimeBackendFlavor: () => mocks.flavor }));
vi.mock('@/components/providers/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'user' }, currentOrg: { id: mocks.org } }) }));
vi.mock('@/lib/api', () => ({ api: { get: mocks.get } }));
vi.mock('next/navigation', () => ({ usePathname: () => '/samples' }));
import { ExampleBadge, ExampleDataNotice } from './ExampleData';

beforeEach(() => { mocks.flavor = 'squid'; mocks.org = 'org-a'; mocks.get.mockReset(); });
afterEach(cleanup);

it('renders example badge only in SaaS for example origin', () => {
  const { rerender } = render(<ExampleBadge origin="example" />);
  expect(screen.getByText('示例')).toBeInTheDocument();

  rerender(<ExampleBadge origin="scanner" />);
  expect(screen.queryByText('示例')).toBeNull();

  mocks.flavor = 'octopus';
  rerender(<ExampleBadge origin="example" />);
  expect(screen.queryByText('示例')).toBeNull();
});

it('does not display top example data notice or query example-data endpoint', () => {
  render(<ExampleDataNotice />);
  expect(screen.queryByText(/示例|Example/)).toBeNull();
  expect(screen.queryByText(/FASTQ\/BAM/)).toBeNull();
  expect(screen.queryByRole('link', { name: /查看/ })).toBeNull();
  expect(mocks.get).not.toHaveBeenCalled();
});
