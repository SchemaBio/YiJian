import * as React from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useLiveRetention, useResearchExpiry } from './research-retention';
const runtime=vi.hoisted(()=>({flavor:'squid'}));
vi.mock('./runtime-config',()=>({getRuntimeBackendFlavor:()=>runtime.flavor}));
afterEach(()=>{vi.useRealTimers();runtime.flavor='squid';});

describe('research deadline access',()=>{
 it('removes a loaded record at the exact deadline and invokes the current callback',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-14T00:00:00Z'));
  const expiresAt='2026-10-14T00:00:01Z';const initial=vi.fn(),current=vi.fn();
  const {result,rerender}=renderHook(({callback})=>{
   useResearchExpiry(expiresAt,callback);
   return useLiveRetention(React.useMemo(()=>[{id:'task',expiresAt}],[]));
  },{initialProps:{callback:initial}});
  expect(result.current).toHaveLength(1);rerender({callback:current});
  act(()=>vi.advanceTimersByTime(1000));
  expect(initial).not.toHaveBeenCalled();expect(current).toHaveBeenCalledOnce();expect(result.current).toEqual([]);
 });
 it('checks expiry on window focus and releases its timer on unmount',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-14T00:00:00Z'));
  const callback=vi.fn();const {unmount}=renderHook(()=>useResearchExpiry('2026-10-14T00:00:01Z',callback));
  vi.setSystemTime(new Date('2026-10-14T00:00:02Z'));act(()=>window.dispatchEvent(new Event('focus')));
  expect(callback).toHaveBeenCalledOnce();unmount();expect(vi.getTimerCount()).toBe(0);
 });
 it('keeps open source records and does not enable automatic expiry',()=>{
  runtime.flavor='octopus';vi.useFakeTimers();const callback=vi.fn();
  const {result}=renderHook(()=>{useResearchExpiry('2000-01-01T00:00:00Z',callback);return useLiveRetention([{expiresAt:'2000-01-01T00:00:00Z'}]);});
  expect(result.current).toHaveLength(1);expect(callback).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
 });
});
