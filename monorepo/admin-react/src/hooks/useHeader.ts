/**
 * Header logic: global search (debounced), notifications feed with polling and read-marking.
 * Opening the notifications panel counts as seeing them: the unread badge clears at once.
 */

import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { reportService, notificationService } from '@/services/engagementService';
import { QUERY } from '@/constants/api';
import { LIMITS } from '@/constants/ui';
import { SETTINGS_MENU } from '@/constants/navigation';
import { useAction } from './useApi';
import { useAuth } from './useAuth';
import { useBranchScope } from './useBranchScope';

export function useGlobalSearch() {
  const { branchId } = useBranchScope();
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), LIMITS.SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [term]);
  const query = useQuery({
    queryKey: ['search', debounced, branchId],
    // Same branch scope as the rest of the admin (header branch selector).
    queryFn: () => reportService.search(debounced, branchId),
    enabled: debounced.length >= 2,
    placeholderData: keepPreviousData,
  });
  return { term, setTerm, results: debounced.length >= 2 ? query.data : undefined, loading: query.isFetching };
}

export function useNotifications(pageSize = 10) {
  const qc = useQueryClient();
  const queryKey = ['notifications', pageSize];
  const query = useQuery({
    queryKey,
    queryFn: () => notificationService.list({ page: 1, pageSize }),
    refetchInterval: QUERY.NOTIFICATION_POLL_MS,
  });
  const markRead = useAction((ids: number[] | 'all') => notificationService.markRead(ids), { invalidate: [['notifications']] });
  const unread = query.data?.meta.unread ?? 0;
  /** Ids that were unread when the panel opened — still highlighted as "new" while it stays open. */
  const [seenNowIds, setSeenNowIds] = useState<ReadonlySet<number>>(new Set());

  /** Panel opened: everything counts as seen. Clear the badge immediately, then persist. */
  const markSeen = () => {
    const items = query.data?.items ?? [];
    setSeenNowIds(new Set(items.filter((n) => !n.readAt).map((n) => n.id)));
    if (!unread) return;
    void qc.cancelQueries({ queryKey }); // a poll in flight must not bring the old count back
    qc.setQueryData<typeof query.data>(queryKey, (old) => (old ? { ...old, meta: { ...old.meta, unread: 0 } } : old));
    markRead.mutate('all');
  };
  /** Panel closed: drop the "new" highlights. */
  const clearSeen = () => setSeenNowIds(new Set());

  return {
    items: query.data?.items ?? [],
    unread,
    loading: query.isLoading,
    markRead: markRead.mutate,
    markSeen,
    clearSeen,
    isNew: (n: { id: number; readAt: string | null }) => !n.readAt || seenNowIds.has(n.id),
  };
}

/** Settings pages the current user may open (empty when they lack settings access). */
export function useSettingsItems() {
  const { can } = useAuth();
  return can(SETTINGS_MENU.permission) ? SETTINGS_MENU.children.filter((c) => can(c.permission)) : [];
}
