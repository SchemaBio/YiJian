import { ASSESSMENT_PROFILE, type AssessmentContext, type AutomaticAssessment, type ResultTable } from './types';

export interface CachedAssessment { table: ResultTable; rowId: string; assessment: AutomaticAssessment }
let scope = '';
export function setAssessmentCacheScope(next: string) {
  const value = next === 'anonymous' ? '' : next;
  if (scope && scope !== value) {
    void removeAssessmentCache();
    if (typeof window !== "undefined") window.dispatchEvent(new Event("yijian:assessment-scope-changed"));
  }
  scope = value;
}

function openCache(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('yijian-assessment-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('results');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function assessmentCacheKey(context: AssessmentContext): Promise<string | null> {
  if (!scope || typeof indexedDB === 'undefined' || !globalThis.crypto?.subtle) return null;
  // Include the full authorized context, not just its display version: changes
  // in attempts, HPO, proofs, references or rule packs invalidate the result.
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(context)));
  const hash = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('');
  return `${scope}/${context.taskId}/${context.attemptId}/${ASSESSMENT_PROFILE}/${hash}`;
}

export async function readAssessmentCache(key: string | null): Promise<CachedAssessment[] | null> {
  if (!key) return null;
  let db: IDBDatabase | undefined;
  try {
    db = await openCache();
    return await new Promise((resolve, reject) => {
      const request = db!.transaction('results').objectStore('results').get(key);
      request.onsuccess = () => resolve(request.result?.expiresAt > Date.now() ? request.result.rows : null);
      request.onerror = () => reject(request.error);
    });
  } catch { return null; } finally { db?.close(); }
}

export async function writeAssessmentCache(key: string | null, rows: CachedAssessment[]): Promise<void> {
  if (!key) return;
  let db: IDBDatabase | undefined;
  try {
    db = await openCache();
    await new Promise<void>((resolve, reject) => {
      const transaction = db!.transaction('results', 'readwrite');
      const store = transaction.objectStore('results');
      const cursor = store.openCursor();
      cursor.onsuccess = () => {
        const item = cursor.result;
        if (item) { if (item.value.expiresAt <= Date.now()) item.delete(); item.continue(); }
      };
      store.put({ expiresAt: Date.now() + 24 * 60 * 60 * 1000, rows }, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } catch { /* Private mode or quota limits must not prevent interpretation. */ } finally { db?.close(); }
}

export async function removeAssessmentCache(taskId?: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  let db: IDBDatabase | undefined;
  try {
    db = await openCache();
    await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction('results', 'readwrite');
      const store = tx.objectStore('results');
      if (!taskId) store.clear();
      else {
        const cursor = store.openCursor();
        cursor.onsuccess = () => { const item = cursor.result; if (item) { if (String(item.key).includes(`/${taskId}/`)) item.delete(); item.continue(); } };
      }
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    });
  } catch { /* Cache cleanup is best effort. */ } finally { db?.close(); }
}
