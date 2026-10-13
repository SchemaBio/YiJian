import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { DataTable, Select, Avatar } from '@schema/ui-kit';
import { LocaleProvider, useLocaleSettings } from './LocaleProvider';
import { locales } from '@/i18n/locales';
import { createTextTranslator } from '@/i18n/text';

vi.mock('next/navigation', () => ({useRouter: () => ({refresh: vi.fn()})}));
function Controls() {
  const {saveLocale} = useLocaleSettings();
  return <><Select searchable options={[{label:'Original patient name',value:'original'}]} />
    <button onClick={() => saveLocale('es-419')}>save</button></>;
}
it.each(locales)('renders shared table empty states and accessibility labels in %s on the server', locale => {
  const t = createTextTranslator(locale);
  const html = renderToString(<LocaleProvider initialLocale={locale}>
    <DataTable data={[]} columns={[{id:'id',header:'ID',accessor:'id'}]} rowKey="id" selectable />
    <Avatar />
  </LocaleProvider>);
  expect(html).toContain(t('uiKit.noData'));
  expect(html).toContain(`aria-label="${t('uiKit.dataTable')}"`);
  expect(html).toContain(`aria-label="${t('uiKit.selectAllRows')}"`);
  expect(html).toContain(`aria-label="${t('uiKit.userAvatar')}"`);
});
it('updates shared select text while preserving its search input and original options', () => {
  const zh = createTextTranslator('zh-CN'), es = createTextTranslator('es-419');
  render(<LocaleProvider initialLocale="zh-CN"><Controls /></LocaleProvider>);
  fireEvent.click(screen.getByText(zh('uiKit.select')));
  const input = screen.getByPlaceholderText(zh('uiKit.search'));
  fireEvent.change(input, {target: {value:'no matching option'}});
  expect(screen.getByText(zh('uiKit.noOptions'))).toBeVisible();
  fireEvent.click(screen.getByText('save'));
  expect(screen.getByPlaceholderText(es('uiKit.search'))).toHaveValue('no matching option');
  expect(screen.getByText(es('uiKit.noOptions'))).toBeVisible();
});
