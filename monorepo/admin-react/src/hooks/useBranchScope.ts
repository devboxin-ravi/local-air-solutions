/**
 * Global branch selector state (header), persisted per browser. Company-wide users can pick any
 * branch or "All branches"; branch-scoped users are pinned to their own branch (backend enforces too).
 */

import { useCallback, useSyncExternalStore } from 'react';
import { STORAGE_KEYS } from '@/constants/api';

const read = (): number | undefined => {
  try {
    const v = localStorage.getItem(STORAGE_KEYS.BRANCH);
    return v ? Number(v) : undefined;
  } catch {
    return undefined;
  }
};

let current = read();
const listeners = new Set<() => void>();

export function useBranchScope() {
  const branchId = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
  const setBranchId = useCallback((id?: number) => {
    current = id;
    try {
      if (id) localStorage.setItem(STORAGE_KEYS.BRANCH, String(id));
      else localStorage.removeItem(STORAGE_KEYS.BRANCH);
    } catch {
      /* ignore */
    }
    listeners.forEach((l) => l());
  }, []);
  return { branchId, setBranchId };
}
