import { describe, expect, it } from 'vitest';
import { I18n } from '@page-agent/ui';
import { PageAgentLocale } from './page-agent-locale';
import { locales } from '@/i18n/locales';
import { createTextTranslator } from '@/i18n/text';

describe('PageAgent locale bridge', () => {
  it.each(locales)('uses %s for controls and preserves original interpolated content', locale => {
    const bridge = new PageAgentLocale(locale);
    const i18n = bridge.construct(() => {
      const instance = new I18n();
      instance.t('ui.panel.ready');
      return instance;
    });
    const t = createTextTranslator(locale);
    expect(i18n.t('ui.panel.ready')).toBe(t('pageAgent.panel.ready'));
    expect(i18n.t('ui.panel.question', {question: '原始问题 BRCA1 c.123A>G'})).toContain('原始问题 BRCA1 c.123A>G');
    expect(i18n.t('ui.tools.waiting', {seconds: 2})).toBe(t('pageAgent.tools.waiting', {p0: 2}));
  });

  it('updates an existing panel without replacing inputs, task state or AI history', async () => {
    const bridge = new PageAgentLocale('zh-CN');
    const i18n = bridge.construct(() => {
      const instance = new I18n(); instance.t('ui.panel.ready'); return instance;
    });
    const wrapper = document.createElement('div');
    const button = document.createElement('button');
    button.title = i18n.t('ui.panel.stop');
    const input = document.createElement('input');
    input.placeholder = i18n.t('ui.panel.taskInput'); input.value = 'unsaved task';
    const status = document.createElement('span'); status.className = '_statusText_fixture';
    const pending = i18n.t('ui.panel.thinking'); status.textContent = pending;
    const history = document.createElement('p'); history.textContent = '报告原文 BRCA1';
    wrapper.append(button, input, status, history);
    bridge.attach(wrapper);
    for (const locale of locales) {
      bridge.setLocale(locale);
      expect(button.title).toBe(createTextTranslator(locale)('pageAgent.panel.stop'));
      expect(status.textContent).toBe(createTextTranslator(locale)('pageAgent.panel.thinking'));
      expect(input.value).toBe('unsaved task'); expect(history.textContent).toBe('报告原文 BRCA1');
      expect(wrapper.lang).toBe(locale);
    }
    // A delayed status transition must also use the current language.
    status.textContent = pending;
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(status.textContent).toBe('Pensando...');
    bridge.dispose();
    expect(new I18n('en-US').t('ui.panel.ready')).toBe('Ready');
    expect(new I18n('zh-CN').t('ui.panel.ready')).toBe('准备就绪');
  });
});
