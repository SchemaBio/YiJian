import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmdirSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { locales } from './locales';

const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : '/bin/sh';
const suite = existsSync(bash) ? describe : describe.skip;
suite('container default language', () => {
  function entrypoint(locale?: string) {
    const root = resolve('.gotmp'); mkdirSync(root, {recursive: true});
    const dir = mkdtempSync(join(root, 'locale-test-'));
    const configPath = join(dir, 'runtime-config.js');
    const script = readFileSync('docker-entrypoint.sh', 'utf8').replace(/\r/g, '').replace('/app/public/runtime-config.js', configPath.replaceAll('\\', '/'));
    const env: NodeJS.ProcessEnv = {...process.env, NEXT_PUBLIC_DEFAULT_LOCALE: undefined, YIJIAN_DEFAULT_LOCALE: locale, NODE_ENV: 'test'};
    try {
      execFileSync(bash, ['-s'], {input: script, env, stdio: ['pipe', 'pipe', 'pipe']});
      const sandbox = {window: {} as {__YIJIAN_CONFIG__?: {DEFAULT_LOCALE: string}}};
      runInNewContext(readFileSync(configPath, 'utf8'), sandbox);
      return sandbox.window.__YIJIAN_CONFIG__;
    } finally {
      if (existsSync(configPath)) unlinkSync(configPath);
      rmdirSync(dir);
    }
  }
  it.each(locales)('writes %s into browser runtime configuration', locale => {
    expect(entrypoint(locale)?.DEFAULT_LOCALE).toBe(locale);
  });
  it('defaults to Chinese when absent and rejects unsupported or empty values', () => {
    expect(entrypoint()?.DEFAULT_LOCALE).toBe('zh-CN');
    expect(() => entrypoint('fr')).toThrow(/zh-CN, zh-Hant, en, or es-419/);
    expect(() => entrypoint('')).toThrow(/zh-CN, zh-Hant, en, or es-419/);
  });
});
