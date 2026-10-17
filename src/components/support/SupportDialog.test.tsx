import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { SupportDialog } from './SupportDialog';
it('links directly to the repository without exposing a support dialog or email', () => {
  render(<SupportDialog />);
  expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', 'https://github.com/SchemaBio/YiJian');
  expect(screen.queryByRole('button', { name: '帮助与支持' })).not.toBeInTheDocument();
  expect(document.querySelector('a[href^="mailto:"]')).not.toBeInTheDocument();
});
