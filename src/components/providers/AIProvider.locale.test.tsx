import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { AIProvider, useAI } from './AIProvider';
import { LocaleProvider, useLocaleSettings } from './LocaleProvider';
import { createTextTranslator } from '@/i18n/text';

const mock = vi.hoisted(() => ({create: vi.fn(), execute: vi.fn(), setLocale: vi.fn(), reset: vi.fn()}));
vi.mock('@/lib/pageAgent', () => ({createPageAgent: mock.create}));
vi.mock('next/navigation', () => ({useRouter: () => ({refresh: vi.fn()})}));
function Probe() {
  const ai = useAI(); const language = useLocaleSettings();
  return <><button onClick={() => void ai.executeCommand('原始命令 BRCA1')}>run</button>
    <button onClick={() => language.saveLocale('es-419')}>save language</button>
    <output data-testid="busy">{String(ai.isExecuting)}</output>
    <output data-testid="history">{JSON.stringify(ai.history)}</output></>;
}
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.setItem('schema_ai_config', JSON.stringify({openaiModel:'gpt-4o',aiAssistantEnabled:true}));
  mock.create.mockImplementation(() => ({execute:mock.execute,setLocale:mock.setLocale,reset:mock.reset}));
});
it('retains an in-flight AI operation and original conversation when saving another language', async () => {
  let finish!: (value: {success:boolean;result:string}) => void;
  mock.execute.mockImplementation(() => new Promise(resolve => {finish=resolve;}));
  render(<LocaleProvider initialLocale="zh-CN"><AIProvider><Probe /></AIProvider></LocaleProvider>);
  await waitFor(() => expect(mock.create).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByText('run'));
  expect(screen.getByTestId('busy')).toHaveTextContent('true');
  fireEvent.click(screen.getByText('save language'));
  expect(mock.create).toHaveBeenCalledOnce();
  expect(mock.reset).not.toHaveBeenCalled();
  expect(mock.setLocale).toHaveBeenLastCalledWith('es-419');
  expect(screen.getByTestId('history')).toHaveTextContent('原始命令 BRCA1');
  await act(async () => {finish({success:true,result:'AI 原始输出'});});
  expect(screen.getByTestId('busy')).toHaveTextContent('false');
  expect(screen.getByTestId('history')).toHaveTextContent('AI 原始输出');
  expect(screen.getByTestId('history')).toHaveTextContent(createTextTranslator('es-419')('assistance.executed3c6dd3', {p0:'原始命令 BRCA1'}));
});
