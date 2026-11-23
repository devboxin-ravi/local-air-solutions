/**
 * Full notification inbox.
 */

import { BellOff, CheckCheck } from 'lucide-react';
import { useListState } from '@/hooks/useListState';
import { useMarkNotificationsRead, useNotificationPage } from '@/hooks/useEngagement';
import { cn, formatDateTime, humanize } from '@/lib/utils';
import { Badge, EmptyState, ErrorState, LoadingBlock, PageHeader } from '@/components/common';
import { Button, Card } from '@/components/ui/primitives';

export default function NotificationsPage() {
  const list = useListState({ pageSize: 30 });
  const { data, isLoading, error, refetch } = useNotificationPage({ page: list.state.page, pageSize: list.state.pageSize });
  const markRead = useMarkNotificationsRead();

  return (
    <>
      <PageHeader title="Notifications" description={data?.meta.unread ? `${data.meta.unread} unread` : 'You’re all caught up.'} actions={!!data?.meta.unread && <Button variant="outline" onClick={() => markRead.mutate('all')}><CheckCheck /> Mark all read</Button>} />
      {isLoading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : !data?.items.length ? (
        <Card><EmptyState icon={BellOff} title="No notifications" /></Card>
      ) : (
        <Card className="divide-y">
          {data.items.map((n) => (
            <button key={n.id} type="button" onClick={() => !n.readAt && markRead.mutate([n.id])} className={cn('flex w-full gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50', !n.readAt && 'bg-brand-blue-50/40')}>
              <span className={cn('mt-2 h-2.5 w-2.5 shrink-0 rounded-full', n.readAt ? 'bg-slate-200' : 'bg-brand-blue')} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2"><span className="font-semibold text-brand-navy">{n.title}</span><Badge>{humanize(n.eventType)}</Badge></span>
                <span className="mt-1 block text-[13.5px] text-slate-600">{n.body}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</span>
              </span>
            </button>
          ))}
        </Card>
      )}
      {data && data.meta.totalPages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="outline" disabled={list.state.page <= 1} onClick={() => list.setPage(list.state.page - 1)}>Previous</Button>
          <Button variant="outline" disabled={list.state.page >= data.meta.totalPages} onClick={() => list.setPage(list.state.page + 1)}>Next</Button>
        </div>
      )}
    </>
  );
}
