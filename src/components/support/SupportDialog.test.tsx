import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { SupportDialog } from './SupportDialog';
const mode = vi.hoisted(() => ({ backend: 'octopus' }));
vi.mock('@/lib/runtime-config', () => ({getRuntimeBackendFlavor: () => mode.backend,getRuntimeSupportEmail: () => 'support@example.invalid'}));
vi.mock('@/components/providers/AuthProvider', () => ({useAuth: () => ({user: null,currentOrg:null})}));
beforeEach(() => {mode.backend='octopus';});
it('links directly to the repository without exposing a support dialog or email', () => {
  render(<SupportDialog />);
  expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', 'https://github.com/SchemaBio/YiJian');
  expect(screen.queryByRole('button', { name: '帮助与支持' })).not.toBeInTheDocument();
  expect(document.querySelector('a[href^="mailto:"]')).not.toBeInTheDocument();
});

it('keeps the SaaS support dialog and configured contact instead of GitHub', () => {
 mode.backend='squid';render(<SupportDialog />);
 expect(screen.queryByRole('link', {name:'GitHub'})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button', {name:'帮助与支持'}));
 expect(screen.getByRole('dialog')).toBeInTheDocument();
 expect(screen.getByRole('button', {name:'support@example.invalid'})).toBeInTheDocument();
});
