'use client';

import { useMemo } from 'react';
import { useAppLocale } from '@/components/providers/LocaleProvider';
import { createTextTranslator } from './text';

/** Also supports isolated component previews without a provider, in Chinese. */
export function useText() {
  const locale = useAppLocale();
  return useMemo(() => createTextTranslator(locale), [locale]);
}
