/**
 * Service pricing: base and branch-specific prices with full price history.
 */

import { useState } from 'react';
import { History, IndianRupee } from 'lucide-react';
import { useServiceActions, useServicePricing } from '@/hooks/useCatalog';
import { useBranches, useServiceLookup } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { useFormErrors } from '@/hooks/useFormErrors';
import { priceSchema } from '@/lib/validation';
import { ROUTES } from '@/constants/routes';
import { SERIAL_COLUMN } from '@/constants/ui';
import { cn, formatDateTime, formatMoney, humanize, priceLabel, serialNumber } from '@/lib/utils';
import { SearchSelect } from '@/components/Pickers';
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
  const { errors, validate, clear, fromServer } = useFormErrors();

  const updatePrice = () => {
    const parsed = validate(priceSchema, { price });
    if (!parsed || !serviceId) return;
    actions.setPrice.mutate({ id: serviceId, branchId: branchId ? Number(branchId) : null, price: parsed.price }, { onSuccess: () => setPrice(''), onError: (e) => fromServer(e) });
  };

  return (
    <>
      <PageHeader title="Pricing" description="Set base prices and branch overrides. Every change is kept as history; existing bookings keep their price." breadcrumbs={[{ label: 'Master Data', to: ROUTES.STATES }, { label: 'Services', to: ROUTES.SERVICES_HOME }, { label: 'Pricing' }]} />
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card className="space-y-4 p-5 xl:sticky xl:top-[97px] xl:self-start">
          <Field label="Service">
            <SearchSelect
              id="pricing-service"
              placeholder="Select a service"
              value={serviceId ?? null}
              options={(services ?? []).map((s) => ({ value: s.id, label: s.name, hint: s.code, meta: priceLabel(s) }))}
              onChange={(id) => setServiceId(id ?? undefined)}
            />
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
                    <NativeSelect searchable value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                      <option value="">Base price (all branches)</option>
                      {branches?.map((b) => <option key={b.id} value={b.id}>{b.name} override</option>)}
                    </NativeSelect>
                  </Field>
                  <Field label="New price (₹)" required error={errors.price} htmlFor="new-price">
                    <Input id="new-price" type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00" value={price} onChange={(e) => { setPrice(e.target.value); clear('price'); }} />
                  </Field>
                  <Button className="w-full" loading={actions.setPrice.isPending} onClick={updatePrice}>
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
                <tr><th className={cn('px-5 py-2.5', SERIAL_COLUMN.CLASS)}>{SERIAL_COLUMN.HEADER}</th><th className="px-5 py-2.5">Scope</th><th className="px-5 py-2.5 text-right">Price</th><th className="px-5 py-2.5">Effective from</th><th className="px-5 py-2.5">Until</th></tr>
              </thead>
              <tbody className="divide-y">
                {pricing.data?.map((p, index) => (
                  <tr key={p.id}>
                    <td className={cn('px-5 py-3', SERIAL_COLUMN.CLASS, SERIAL_COLUMN.CELL_TEXT)}>{serialNumber(index)}</td>
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
