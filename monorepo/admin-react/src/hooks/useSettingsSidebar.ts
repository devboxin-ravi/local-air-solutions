/**
 * Settings sidebar collapsed/expanded state, remembered per browser. Logic only.
 */

import { useCallback, useState } from 'react';
import { STORAGE_KEYS } from '@/constants/api';

const readCollapsed = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEYS.SETTINGS_SIDEBAR_COLLAPSED) === '1';
  } catch {
    return false;
  }
};

export function useSettingsSidebar() {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        if (next) localStorage.setItem(STORAGE_KEYS.SETTINGS_SIDEBAR_COLLAPSED, '1');
        else localStorage.removeItem(STORAGE_KEYS.SETTINGS_SIDEBAR_COLLAPSED);
      } catch {
        /* storage unavailable (private mode) — keep in-memory state only */
      }
      return next;
    });
  }, []);
  return { collapsed, toggle };
}
