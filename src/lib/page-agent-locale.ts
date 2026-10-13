import { I18n } from '@page-agent/ui';
import { createTextTranslator, type TextTranslator } from '@/i18n/text';
import type { Locale } from '@/i18n/locales';

// page-agent 1.8.2 exposes I18n.t and Panel.wrapper, but no locale setter.
// Keep this version-specific bridge isolated; never recreate a running agent.
const parameterNames: Record<string, string> = {
  'panel.userAnswer': 'input', 'panel.question': 'question', 'panel.step': 'number',
  'tools.clicking': 'index', 'tools.inputting': 'index', 'tools.selecting': 'text',
  'tools.waiting': 'seconds', 'tools.clicked': 'index', 'tools.inputted': 'text',
  'tools.selected': 'text', 'tools.executing': 'toolName',
  'errors.elementNotFound': 'index', 'errors.optionNotFound': 'text',
};
const owners = new WeakMap<I18n, PageAgentLocale>();
let constructing: PageAgentLocale | undefined;
let installed = false;

function installBridge() {
  if (installed) return;
  installed = true;
  const native = I18n.prototype.t;
  I18n.prototype.t = function (key, params) {
    let owner = owners.get(this);
    if (!owner && constructing) {
      owner = constructing;
      owners.set(this, owner);
    }
    return owner?.translate(key, params) ?? native.call(this, key, params);
  };
}

export class PageAgentLocale {
  private t: TextTranslator;
  private rendered = new Map<string, {key: string; params?: Record<string, string | number>}>();
  private wrapper?: HTMLElement;
  private waitingLabel?: HTMLElement;
  private observer?: MutationObserver;

  constructor(locale: Locale) { this.t = createTextTranslator(locale); }

  construct<T>(factory: () => T): T {
    installBridge();
    const previous = constructing;
    constructing = this;
    try { return factory(); } finally { constructing = previous; }
  }

  translate(key: string, params?: Record<string, string | number>): string | undefined {
    if (!key.startsWith('ui.')) return undefined;
    const suffix = key.slice(3);
    const value = this.t(`pageAgent.${suffix}`, parameterNames[suffix]
      ? {p0: params?.[parameterNames[suffix]] ?? ''} : undefined);
    this.rendered.set(value, {key, params});
    return value;
  }

  attach(wrapper: HTMLElement) {
    this.wrapper = wrapper;
    this.waitingLabel = Array.from(wrapper.querySelectorAll<HTMLElement>('[class*="historyContent_"] > span'))
      .find(element => element.textContent === this.t('pageAgent.panel.waitingPlaceholder'));
    this.refreshControls();
    // The library may commit a queued status transition after a locale change.
    this.observer = new MutationObserver(() => this.refreshControls());
    this.observer.observe(wrapper, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['title', 'placeholder']});
  }

  setLocale(locale: Locale) {
    this.t = createTextTranslator(locale);
    this.refreshControls();
  }

  private refreshControls() {
    const wrapper = this.wrapper;
    if (!wrapper) return;
    wrapper.lang = this.t.locale;
    if (this.waitingLabel && wrapper.contains(this.waitingLabel)) {
      const label = this.t('pageAgent.panel.waitingPlaceholder');
      if (this.waitingLabel.textContent !== label) this.waitingLabel.textContent = label;
    }
    // Only library-owned controls and the current status are refreshed. Inputs,
    // conversation history, tool logs and AI-generated text retain their content.
    for (const element of wrapper.querySelectorAll<HTMLElement>('button[title], input[placeholder], [class*="statusText_"]')) {
      const attribute = element.tagName === 'BUTTON' ? 'title' : element.tagName === 'INPUT' ? 'placeholder' : null;
      const old = attribute ? element.getAttribute(attribute) : element.textContent;
      const message = old == null ? undefined : this.rendered.get(old);
      if (!message) continue;
      const next = this.translate(message.key, message.params);
      if (next === undefined || next === old) continue;
      if (attribute) element.setAttribute(attribute, next);
      else element.textContent = next;
    }
  }

  dispose() { this.observer?.disconnect(); this.wrapper = undefined; this.waitingLabel = undefined; this.rendered.clear(); }
}
