/**
 * Audit logs: who changed what and when.
 */

import { useState } from 'react';
import { useListState } from '@/hooks/useListState';
import { useAuditLogs } from '@/hooks/useEngagement';
import { ROUTES } from '@/constants/routes';
import { formatDateTime, humanize } from '@/lib/utils';
import type { AuditLog } from '@/types';
import { Badge, PageHeader } from '@/components/common';
import { DataTable, type Column } from '@/components/DataTable';
import { DateRange, FilterBar, SelectFilter } from '@/components/Filters';
import { Dialog, DialogBody, DialogContent, DialogHeader } from '@/components/ui/overlays';

const ENTITIES = ['booking', 'customer', 'service', 'serviceCategory', 'invoice', 'payment', 'amc', 'staff', 'role', 'setting', 'branch', 'user', 'ledger'];
const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'LOGIN', 'LOGOUT', 'APPROVE', 'REJECT', 'ASSIGN'];

export default function AuditLogsPage() {
  const list = useListState();
  const { data, isLoading, error, refetch } = useAuditLogs(list.query);
  const [open, setOpen] = useState<AuditLog | null>(null);

  const columns: Column<AuditLog>[] = [
    { key: 'when', header: 'When', cell: (l) => formatDateTime(l.createdAt) },
    { key: 'actor', header: 'User', cell: (l) => l.actor?.name ?? 'System' },
    { key: 'action', header: 'Action', cell: (l) => <Badge tone={l.action === 'DELETE' || l.action === 'REJECT' ? 'red' : l.action === 'CREATE' ? 'green' : 'blue'}>{humanize(l.action)}</Badge> },
    { key: 'entity', header: 'Entity', cell: (l) => `${humanize(l.entityType.replace(/([A-Z])/g, '_$1'))}${l.entityId ? ` #${l.entityId}` : ''}` },
    { key: 'ip', header: 'IP', cell: (l) => <span className="font-mono text-xs">{l.ipAddress ?? '—'}</span> },
  ];

  return (
    <>
      <PageHeader title="Audit Logs" description="Tamper-evident trail of logins and changes. Click a row for details." breadcrumbs={[{ label: 'Settings', to: ROUTES.SETTINGS_HOME }, { label: 'Audit Logs' }]} />
      <DataTable
        columns={columns}
        rows={data?.items}
        rowKey={(l) => l.id}
        loading={isLoading}
        error={error ? (error as Error).message : null}
        onRetry={refetch}
        meta={data?.meta}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        onRowClick={setOpen}
        dense
        toolbar={
          <FilterBar right={<DateRange from={list.state.filters.from} to={list.state.filters.to} onChange={(from, to) => list.update({ from, to })} />}>
            <SelectFilter placeholder="All entities" value={list.state.filters.entityType} onChange={(v) => list.setFilter('entityType', v)} options={ENTITIES.map((e) => ({ value: e, label: humanize(e.replace(/([A-Z])/g, '_$1')) }))} />
            <SelectFilter placeholder="All actions" value={list.state.filters.action} onChange={(v) => list.setFilter('action', v)} options={ACTIONS.map((a) => ({ value: a, label: humanize(a) }))} />
          </FilterBar>
        }
      />
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent size="lg">
          <DialogHeader title={open ? `${humanize(open.action)} · ${open.entityType} #${open.entityId ?? ''}` : ''} description={open ? `${open.actor?.name ?? 'System'} · ${formatDateTime(open.createdAt)}` : undefined} />
          <DialogBody className="grid gap-4 md:grid-cols-2">
            {(['before', 'after'] as const).map((k) => (
              <div key={k}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{k}</p>
                <pre className="scrollbar-thin max-h-80 overflow-auto rounded-lg bg-slate-900 p-3 text-[11.5px] leading-relaxed text-slate-100">{open?.[k] ? JSON.stringify(open[k], null, 2) : '—'}</pre>
              </div>
            ))}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}
