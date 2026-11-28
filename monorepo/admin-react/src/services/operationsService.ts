/**
 * Bookings, slots and assignment API calls.
 */

import { API } from '@/constants/api';
import type { AssignInput, Assignment, Booking, QueryParams, Slot, Suggestion, TechAvailability } from '@/types';
import { http } from './apiClient';

export const bookingService = {
  list: (params?: QueryParams) => http.page<Booking>(API.BOOKINGS, params),
  calendar: (params: QueryParams) => http.get<Booking[]>(API.BOOKINGS_CALENDAR, params),
  get: (id: number) => http.get<Booking>(API.BOOKING(id)),
  create: (body: unknown) => http.post<Booking>(API.BOOKINGS, body),
  update: (id: number, body: unknown) => http.patch<Booking>(API.BOOKING(id), body),
  changeStatus: (id: number, status: string, note?: string) => http.post<Booking>(API.BOOKING_STATUS(id), { status, note }),
  cancel: (id: number, reason: string) => http.post<Booking>(API.BOOKING_CANCEL(id), { reason }),
  reschedule: (id: number, body: { scheduledDate: string; slotId?: number | null; note?: string }) => http.post<Booking>(API.BOOKING_RESCHEDULE(id), body),
  addNote: (id: number, note: string) => http.post(API.BOOKING_NOTES(id), { note }),
  upload: (id: number, files: File[], kind: string) => {
    const form = new FormData();
    form.append('kind', kind);
    files.forEach((f) => form.append('files', f));
    return http.upload(API.BOOKING_ATTACHMENTS(id), form);
  },
  suggestions: (id: number) => http.get<Suggestion[]>(API.BOOKING_SUGGESTIONS(id)),
  assign: (id: number, body: AssignInput) => http.post<Booking>(API.BOOKING_ASSIGN(id), body),
  unassign: (id: number) => http.post<Booking>(API.BOOKING_UNASSIGN(id)),
};

export const slotService = {
  list: (params?: QueryParams) => http.get<Slot[]>(API.SLOTS, params),
  available: (branchId: number, date: string) => http.get<Slot[]>(API.SLOTS_AVAILABLE, { branchId, date }),
  generate: (body: unknown) => http.post<{ created: number; skippedExisting: number }>(API.SLOTS_GENERATE, body),
  create: (body: unknown) => http.post<Slot>(API.SLOTS, body),
  update: (id: number, body: unknown) => http.patch<Slot>(API.SLOT(id), body),
  remove: (id: number) => http.del(API.SLOT(id)),
};

export const assignmentService = {
  list: (params?: QueryParams) => http.page<Assignment>(API.ASSIGNMENTS, params),
  availability: (params: QueryParams) => http.get<TechAvailability[]>(API.AVAILABILITY, params),
};
