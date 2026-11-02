import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AIAssistanceProvider } from '@/components/providers/AIAssistanceProvider';
import { AIAssistanceAction } from './AIAssistanceAction';
import { createTextTranslator } from '@/i18n/text';
const state = vi.hoisted(() => ({locale: 'en' as 'en' | 'es-419'}));
vi.mock('@/components/providers/LocaleProvider', () => ({useAppLocale: () => state.locale}));
afterEach(cleanup);
it('captures page language in the generated input and changes identity after a language switch', async () => {
  const generate = vi.fn(async () => ({feature:'acmg' as const, summary:'Synthetic result'}));
  const adapter = {getSettings: vi.fn().mockResolvedValue({enabled:true, connected:true, configured:true}), saveSettings:vi.fn(), generate};
  const view = () => <AIAssistanceProvider deployment="opensource" adapter={adapter}><AIAssistanceAction input={{feature:'acmg'}} onResult={vi.fn()} /></AIAssistanceProvider>;
  const rendered = render(view());
  const button = screen.getByRole('button');
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  await waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
  expect(generate).toHaveBeenLastCalledWith(expect.objectContaining({locale:'en'}), expect.anything());
  state.locale='es-419'; rendered.rerender(view());
  await waitFor(() => expect(screen.getByRole('button')).toBeEnabled());
  fireEvent.click(screen.getByRole('button'));
  await waitFor(() => expect(generate).toHaveBeenCalledTimes(2));
  expect(generate).toHaveBeenLastCalledWith(expect.objectContaining({locale:'es-419'}), expect.anything());
});
it('translates legacy assessment notes and phenotype keys without exposing keys', () => {
  const t=createTextTranslator('en');
  for (const note of ['计算证据缺少唯一转录本或适用的错义分值','PVS1：疾病机制、转录本/NMD 前提待核验','人群计分缺少疾病阈值、AC/AN 或东亚覆盖','本地参考证据包尚未发布','phenotype.gqPending','phenotype.frequencyPending','phenotype.familyPending']) {
    expect(t(note)).not.toMatch(/[\u4e00-\u9fff]|phenotype\./);
    expect(t(note)).not.toBe(note);
  }
});
