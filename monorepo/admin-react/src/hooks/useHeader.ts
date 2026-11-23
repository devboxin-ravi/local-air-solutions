/**
 * Header logic: global search (debounced), notifications feed with polling and read-marking.
 */

import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { reportService, notificationService } from '@/services/engagementService';
import { QUERY } from '@/constants/api';
import { LIMITS } from '@/constants/ui';
import { useAction } from './useApi';

export function useGlobalSearch() {
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), LIMITS.SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [term]);
  const query = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => reportService.search(debounced),
    enabled: debounced.length >= 2,
    placeholderData: keepPreviousData,
  });
  return { term, setTerm, results: debounced.length >= 2 ? query.data : undefined, loading: query.isFetching };
}

export function useNotifications(pageSize = 10) {
  const query = useQuery({
    queryKey: ['notifications', pageSize],
    queryFn: () => notificationService.list({ page: 1, pageSize }),
    refetchInterval: QUERY.NOTIFICATION_POLL_MS,
  });
  const markRead = useAction((ids: number[] | 'all') => notificationService.markRead(ids), { invalidate: [['notifications']] });
  return { items: query.data?.items ?? [], unread: query.data?.meta.unread ?? 0, loading: query.isLoading, markRead: markRead.mutate };
}
