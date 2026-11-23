/**
 * Service pricing: base and branch-specific prices with full price history.
 */

import { useState } from 'react';
import { History, IndianRupee } from 'lucide-react';
import { useServiceActions, useServicePricing } from '@/hooks/useCatalog';
import { useBranches, useServiceLookup } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { formatDateTime, formatMoney, humanize, priceLabel } from '@/lib/utils';
import { Badge, EmptyState, Field, PageHeader, SectionCard } from '@/components/common';
import { Button, Card, Input, NativeSelect } from '@/components/ui/primitives';

export default function PricingPage() {
  const { can } = useAuth();
  const { data: services } = useServiceLookup();
  const { data: branches } = useBranches();
  const [serviceId, setServiceId] = useState<number>();
  const service = services?.find((s) => s.id === serviceId);
  const pricing = useServicePricing(serviceId);
  const actions = useServiceActions();
  const [branchId, setBranchId] = useState<string>('');
  const [price, setPrice] = useState('');

  const priceNum = Number(price);
  const valid = price !== '' && priceNum >= 0 && Number.isFinite(priceNum);

  return (
    <>
      <PageHeader title="Service Pricing" description="Set base prices and branch overrides. Every change is kept as history; existing bookings keep their price." breadcrumbs={[{ label: 'Services', to: ROUTES.SERVICES }, { label: 'Pricing' }]} />
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card className="space-y-4 p-5 xl:sticky xl:top-36 xl:self-start">
          <Field label="Service">
            <NativeSelect value={serviceId ?? ''} onChange={(e) => setServiceId(Number(e.target.value) || undefined)}>
              <option value="">Select a service</option>
              {services?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </NativeSelect>
          </Field>
          {service && (
            <>
              <div className="rounded-xl bg-gradient-to-br from-brand-blue-50 to-brand-green-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current base</p>
                <p className="num font-display text-2xl font-extrabold text-brand-navy">{priceLabel(service)}</p>
                <p className="text-xs text-muted-foreground">{humanize(service.pricingType)} · GST {service.gstApplicable ? `${service.gstRate}%` : 'exempt'}</p>
              </div>
              {can('services.edit') && (
                <>
                  <Field label="Apply to">
                    <NativeSelect value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                      <option value="">Base price (all branches)</option>
                      {branches?.map((b) => <option key={b.id} value={b.id}>{b.name} override</option>)}
                    </NativeSelect>
                  </Field>
                  <Field label="New price (₹)">
                    <Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
                  </Field>
                  <Button className="w-full" disabled={!valid} loading={actions.setPrice.isPending} onClick={() => serviceId && actions.setPrice.mutate({ id: serviceId, branchId: branchId ? Number(branchId) : null, price: priceNum }, { onSuccess: () => setPrice('') })}>
                    <IndianRupee /> Update price
                  </Button>
                </>
              )}
            </>
          )}
        </Card>
        <SectionCard title="Price history" description={service ? service.name : 'Select a service to see its history'} bodyClassName="p-0">
          {!serviceId ? (
            <EmptyState icon={History} title="No service selected" />
          ) : pricing.isLoading ? (
            <div className="skeleton m-5 h-40" />
          ) : (
            <table className="w-full text-[13.5px]">
              <thead className="bg-slate-50 text-left text-[11.5px] font-semibold uppercase tracking-wider text-slate-500">
                <tr><th className="px-5 py-2.5">Scope</th><th className="px-5 py-2.5 text-right">Price</th><th className="px-5 py-2.5">Effective from</th><th className="px-5 py-2.5">Until</th></tr>
              </thead>
              <tbody className="divide-y">
                {pricing.data?.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-3">{p.branch ? <Badge tone="violet">{p.branch.name}</Badge> : <Badge tone="blue">Base</Badge>}</td>
                    <td className="num px-5 py-3 text-right font-semibold">{formatMoney(p.price)}</td>
                    <td className="px-5 py-3">{formatDateTime(p.effectiveFrom)}</td>
                    <td className="px-5 py-3">{p.effectiveTo ? formatDateTime(p.effectiveTo) : <Badge tone="green">Current</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>
      </div>
    </>
  );
}
