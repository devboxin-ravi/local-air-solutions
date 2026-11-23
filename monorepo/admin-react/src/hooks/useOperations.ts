/**
 * Booking, slot and assignment logic for pages.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { assignmentService, bookingService, slotService } from '@/services/operationsService';
import { settingsService } from '@/services/engagementService';
import type { QueryParams } from '@/types';
import { useAction } from './useApi';

const BOOKING_KEYS = [['bookings'], ['booking'], ['assignments'], ['dashboard'], ['slots']];

export const useBookingList = (params: QueryParams, enabled = true) =>
  useQuery({ queryKey: ['bookings', params], queryFn: () => bookingService.list(params), placeholderData: keepPreviousData, enabled });

export const useBooking = (id: number) => useQuery({ queryKey: ['booking', id], queryFn: () => bookingService.get(id), enabled: id > 0 });

export const useCalendar = (params: { from: string; to: string; branchId?: number }) =>
  useQuery({ queryKey: ['bookings', 'calendar', params], queryFn: () => bookingService.calendar(params), placeholderData: keepPreviousData });

export function useBookingActions(id: number) {
  return {
    changeStatus: useAction((v: { status: string; note?: string }) => bookingService.changeStatus(id, v.status, v.note), { success: 'Status updated', invalidate: BOOKING_KEYS }),
    cancel: useAction((reason: string) => bookingService.cancel(id, reason), { success: 'Booking cancelled', invalidate: BOOKING_KEYS }),
    reschedule: useAction((v: { scheduledDate: string; slotId?: number | null; note?: string }) => bookingService.reschedule(id, v), { success: 'Booking rescheduled', invalidate: BOOKING_KEYS }),
    addNote: useAction((note: string) => bookingService.addNote(id, note), { success: 'Note added', invalidate: [['booking', id]] }),
    upload: useAction((v: { files: File[]; kind: string }) => bookingService.upload(id, v.files, v.kind), { success: 'Files uploaded', invalidate: [['booking', id]] }),
    assign: useAction((v: { staffId: number; notes?: string }) => bookingService.assign(id, v.staffId, v.notes), { success: 'Technician assigned', invalidate: BOOKING_KEYS }),
    unassign: useAction(() => bookingService.unassign(id), { success: 'Technician unassigned', invalidate: BOOKING_KEYS }),
    update: useAction((body: unknown) => bookingService.update(id, body), { success: 'Booking updated', invalidate: BOOKING_KEYS }),
    whatsapp: useAction((type: 'booking' | 'assignment') => settingsService.whatsappLink(type, id), {
      onSuccess: (r) => window.open(r.url, '_blank', 'noopener,noreferrer'),
    }),
  };
}

export const useAssignAction = () =>
  useAction((v: { bookingId: number; staffId: number; notes?: string }) => bookingService.assign(v.bookingId, v.staffId, v.notes), { success: 'Technician assigned', invalidate: BOOKING_KEYS });

export const useCreateBooking = (onDone: (id: number) => void) =>
  useAction((body: unknown) => bookingService.create(body), { success: (b) => `Booking ${b.bookingNumber} created`, invalidate: BOOKING_KEYS, onSuccess: (b) => onDone(b.id), silentError: true });

export const useSuggestions = (bookingId?: number) =>
  useQuery({ queryKey: ['suggestions', bookingId], queryFn: () => bookingService.suggestions(bookingId as number), enabled: !!bookingId });

export const useAvailableSlots = (branchId?: number, date?: string) =>
  useQuery({ queryKey: ['slots', 'available', branchId, date], queryFn: () => slotService.available(branchId as number, date as string), enabled: !!branchId && !!date });

export const useSlots = (params: QueryParams) => useQuery({ queryKey: ['slots', params], queryFn: () => slotService.list(params), placeholderData: keepPreviousData });

export function useSlotActions() {
  return {
    generate: useAction((body: unknown) => slotService.generate(body), { success: (r) => `${r.created} slot(s) created${r.skippedExisting ? `, ${r.skippedExisting} already existed` : ''}`, invalidate: [['slots']] }),
    create: useAction((body: unknown) => slotService.create(body), { success: 'Slot created', invalidate: [['slots']] }),
    update: useAction((v: { id: number; body: unknown }) => slotService.update(v.id, v.body), { success: 'Slot updated', invalidate: [['slots']] }),
    remove: useAction((id: number) => slotService.remove(id), { success: 'Slot deleted', invalidate: [['slots']] }),
  };
}

export const useAssignmentList = (params: QueryParams, enabled = true) =>
  useQuery({ queryKey: ['assignments', params], queryFn: () => assignmentService.list(params), placeholderData: keepPreviousData, enabled });

export const useTechAvailability = (params: { date: string; branchId?: number }) =>
  useQuery({ queryKey: ['assignments', 'availability', params], queryFn: () => assignmentService.availability(params), placeholderData: keepPreviousData });
