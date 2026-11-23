/**
 * Service availability matrix: which services are offered in which branches.
 */

import { Check, Minus } from 'lucide-react';
import { useServiceActions, useServiceList } from '@/hooks/useCatalog';
import { useBranches } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils';
import type { Service } from '@/types';
import { ErrorState, LoadingBlock, PageHeader } from '@/components/common';
import { Card, Switch } from '@/components/ui/primitives';

export default function AvailabilityPage() {
  const { can } = useAuth();
  const services = useServiceList({ pageSize: 100, sortBy: 'sortOrder', sortOrder: 'asc' });
  const { data: branches } = useBranches();
  const actions = useServiceActions();
  const editable = can('services.edit');

  const toggleBranch = (s: Service, branchId: number) => {
    const all = (branches ?? []).map((b) => b.id);
    const current = s.branches.length ? s.branches.map((b) => b.id) : all; // empty = everywhere
    const next = current.includes(branchId) ? current.filter((x) => x !== branchId) : [...current, branchId];
    actions.update.mutate({ id: s.id, body: { branchIds: next.length === all.length ? [] : next } });
  };

  return (
    <>
      <PageHeader title="Service Availability" description="Turn services on/off globally or per branch. A service with no branch restriction is offered everywhere." breadcrumbs={[{ label: 'Services', to: ROUTES.SERVICES }, { label: 'Availability' }]} />
      {services.isLoading ? (
        <LoadingBlock />
      ) : services.error ? (
        <ErrorState message={(services.error as Error).message} onRetry={() => services.refetch()} />
      ) : (
        <Card className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13.5px]">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-[11.5px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="sticky left-0 bg-slate-50 px-5 py-3">Service</th>
                <th className="px-4 py-3 text-center">Active</th>
                {branches?.map((b) => <th key={b.id} className="px-4 py-3 text-center">{b.name}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y">
              {services.data?.items.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/60">
                  <td className="sticky left-0 bg-white px-5 py-3">
                    <p className="font-semibold text-brand-navy">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.category.name}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Switch checked={s.isActive} disabled={!editable} onCheckedChange={(v) => actions.setActive.mutate({ id: s.id, isActive: v })} aria-label={`${s.name} active`} />
                  </td>
                  {branches?.map((b) => {
                    const on = !s.branches.length || s.branches.some((x) => x.id === b.id);
                    return (
                      <td key={b.id} className="px-4 py-3 text-center">
                        <button
                          type="button"
                          disabled={!editable}
                          onClick={() => toggleBranch(s, b.id)}
                          aria-label={`${s.name} in ${b.name}: ${on ? 'available' : 'not available'}`}
                          className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors', on ? 'bg-brand-green-100 text-brand-green-700 hover:bg-brand-green-200' : 'bg-slate-100 text-slate-400 hover:bg-slate-200')}
                        >
                          {on ? <Check className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
