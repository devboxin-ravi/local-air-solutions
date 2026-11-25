/**
 * New-booking form logic: customer search, address/branch resolution, service lines,
 * slot availability, estimate and submission.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { toYmd } from '@/lib/utils';
import type { Customer, PricingType } from '@/types';
import { errorMessage, fieldErrors, useServiceLookup } from './useApi';
import { useCustomer, useCustomerSearch } from './usePeople';
import { useAvailableSlots, useCreateBooking } from './useOperations';

export interface Line {
  serviceId: number;
  quantity: number;
}

export function useBookingForm(initialCustomerId?: number) {
  const navigate = useNavigate();
  const [bookingType, setBookingType] = useState<'SERVICE' | 'REPAIR'>('SERVICE');
  const [search, setSearch] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const preset = useCustomer(initialCustomerId);
  const selectedCustomer = customer ?? preset.data ?? null;
  const [addressId, setAddressId] = useState<number | null>(null);
  const [branchOverride, setBranchOverride] = useState<number | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [productId, setProductId] = useState<number | null>(null);
  const [problemCategory, setProblemCategory] = useState('');
  const [problemDescription, setProblemDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [scheduledDate, setScheduledDate] = useState(toYmd(new Date(Date.now() + 86_400_000)));
  const [slotId, setSlotId] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const customerSearch = useCustomerSearch(search);
  const addresses = selectedCustomer?.addresses ?? [];
  const address = addresses.find((a) => a.id === addressId) ?? addresses.find((a) => a.isDefault) ?? addresses[0];
  const branchId = branchOverride ?? address?.serviceArea?.branchId ?? selectedCustomer?.branchId ?? null;

  const services = useServiceLookup(branchId ?? undefined);
  const slots = useAvailableSlots(branchId ?? undefined, scheduledDate);
  const create = useCreateBooking((id) => navigate(ROUTES.BOOKING_DETAIL(id)));

  const estimate = useMemo(() => {
    return lines.reduce(
      (acc, l) => {
        const s = services.data?.find((x) => x.id === l.serviceId);
        if (!s) return acc;
        const priced = s.pricingType === 'FIXED' || s.pricingType === 'STARTING';
        if (!priced) acc.quoteItems += 1;
        acc.total += priced ? s.effectivePrice * l.quantity : 0;
        return acc;
      },
      { total: 0, quoteItems: 0 },
    );
  }, [lines, services.data]);

  const selectCustomer = (c: Customer) => {
    setCustomer(c);
    setAddressId(c.addresses.find((a) => a.isDefault)?.id ?? c.addresses[0]?.id ?? null);
    setBranchOverride(null);
  };

  const addLine = (serviceId: number) => setLines((ls) => (ls.some((l) => l.serviceId === serviceId) ? ls : [...ls, { serviceId, quantity: 1 }]));
  const setQty = (serviceId: number, quantity: number) => setLines((ls) => ls.map((l) => (l.serviceId === serviceId ? { ...l, quantity: Math.max(1, Math.min(50, quantity)) } : l)));
  const removeLine = (serviceId: number) => setLines((ls) => ls.filter((l) => l.serviceId !== serviceId));
  const pricingOf = (serviceId: number): { type: PricingType; price: number; name: string } | undefined => {
    const s = services.data?.find((x) => x.id === serviceId);
    return s ? { type: s.pricingType, price: s.effectivePrice, name: s.name } : undefined;
  };

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!selectedCustomer) e.customerId = 'Select a customer';
    if (!address) e.addressId = 'Customer needs an address';
    if (!branchId) e.branchId = 'Select a branch';
    if (bookingType === 'SERVICE' && !lines.length) e.items = 'Add at least one service';
    if (bookingType === 'REPAIR' && problemDescription.trim().length < 5) e.problemDescription = 'Describe the problem (min 5 characters)';
    if (!scheduledDate) e.scheduledDate = 'Choose a date';
    else if (scheduledDate < toYmd(new Date())) e.scheduledDate = 'Date cannot be in the past';
    setErrors(e);
    setFormError(null);
    if (Object.keys(e).length) return;
    try {
      await create.mutateAsync({
        bookingType,
        customerId: selectedCustomer!.id,
        addressId: address!.id,
        branchId,
        productId,
        items: lines,
        scheduledDate,
        slotId,
        problemCategory: problemCategory.trim() || null,
        problemDescription: problemDescription.trim() || null,
        instructions: instructions.trim() || null,
      });
    } catch (err) {
      setErrors(fieldErrors(err));
      setFormError(errorMessage(err));
    }
  };

  return {
    state: { bookingType, search, customer: selectedCustomer, address, addresses, branchId, lines, productId, problemCategory, problemDescription, instructions, scheduledDate, slotId, errors, formError },
    set: { setBookingType, setSearch, setAddressId, setBranchOverride, setProductId, setProblemCategory, setProblemDescription, setInstructions, setScheduledDate: (d: string) => { setScheduledDate(d); setSlotId(null); }, setSlotId },
    customerSearch,
    services,
    slots,
    estimate,
    selectCustomer,
    addLine,
    setQty,
    removeLine,
    pricingOf,
    submit,
    submitting: create.isPending,
  };
}
