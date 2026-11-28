/**
 * Booking-specific UI: status timeline, technician assignment dialog, reschedule dialog,
 * attachment gallery. UI only — data and callbacks come from the page.
 */

import * as React from 'react';
import { CheckCircle2, Circle, HardHat, ImagePlus, MapPin, Star, Upload } from 'lucide-react';
import { cn, assetUrl, formatDateTime, humanize, toYmd } from '@/lib/utils';
import type { AssignInput, Booking, Slot, Suggestion } from '@/types';
import { Badge, EmptyState, Field } from './common';
import { SlotGrid } from './Pickers';
import { Button, Input, NativeSelect, Textarea } from './ui/primitives';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from './ui/overlays';
import { JOB_STEPS, PLACEHOLDERS } from '@/constants/ui';

export const StatusTimeline = ({ history }: { history: NonNullable<Booking['statusHistory']> }) => (
  <ol className="relative space-y-5 pl-1">
    {history.map((h, i) => {
      const last = i === history.length - 1;
      return (
        <li key={h.id} className="relative flex gap-3">
          {!last && <span className="absolute left-[9px] top-6 h-[calc(100%+4px)] w-px bg-border" aria-hidden />}
          {last ? <CheckCircle2 className="relative z-10 h-5 w-5 shrink-0 text-brand-blue" /> : <Circle className="relative z-10 h-5 w-5 shrink-0 fill-brand-green-100 text-brand-green-500" />}
          <div className="min-w-0 pb-0.5">
            <p className="text-[13.5px] font-semibold text-brand-navy">{humanize(h.toStatus)}</p>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(h.createdAt)}
              {h.actor ? ` · ${h.actor.name}` : ''}
            </p>
            {h.note && <p className="mt-1 rounded-md bg-slate-50 px-2.5 py-1.5 text-[12.5px] text-slate-600">{h.note}</p>}
          </div>
        </li>
      );
    })}
  </ol>
);

/** The five field steps with the time each was reached. */
export const JobProgress = ({ status, history }: { status: string; history: NonNullable<Booking['statusHistory']> }) => {
  const reached = JOB_STEPS.findIndex((s) => s.status === status);
  return (
    <ol className="grid grid-cols-5 gap-2">
      {JOB_STEPS.map((step, i) => {
        const done = i <= reached;
        const at = done ? [...history].reverse().find((h) => h.toStatus === step.status)?.createdAt : undefined;
        return (
          <li key={step.status} aria-current={i === reached ? 'step' : undefined} className="min-w-0">
            <span className={cn('block h-1.5 rounded-full', done ? 'bg-brand-green-500' : 'bg-slate-200')} />
            <span className={cn('mt-2 block text-[12.5px] font-semibold', done ? 'text-brand-navy' : 'text-slate-400')}>{step.label}</span>
            {at && <span className="block text-[11px] text-muted-foreground">{formatDateTime(at)}</span>}
          </li>
        );
      })}
    </ol>
  );
};

export const AssignDialog = ({
  open,
  onOpenChange,
  suggestions,
  loading,
  submitting,
  onAssign,
  booking,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  suggestions?: Suggestion[];
  loading?: boolean;
  submitting?: boolean;
  onAssign: (input: AssignInput) => void;
  /** The booking being assigned: shown as a summary and used to prefill date/time. */
  booking?: Booking | null;
}) => {
  const [selected, setSelected] = React.useState<number | null>(null);
  const [notes, setNotes] = React.useState('');
  const [date, setDate] = React.useState('');
  const [time, setTime] = React.useState('');
  const today = toYmd(new Date());
  React.useEffect(() => {
    if (open) {
      setSelected(null);
      setNotes('');
      setDate(booking?.scheduledDate.slice(0, 10) ?? '');
      // Slot bookings store "HH:MM-HH:MM": prefill its start.
      setTime(/^\d{2}:\d{2}/.exec(booking?.scheduledTime ?? '')?.[0] ?? '');
    }
  }, [open, booking?.id, booking?.scheduledDate, booking?.scheduledTime]);
  // An unchanged earlier date stays assignable; a newly picked one cannot be in the past.
  const dateInPast = !!date && date < today && date !== booking?.scheduledDate.slice(0, 10);
  const ready = !!selected && !!date && !!time && !dateInPast;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader title="Assign technician" description={booking ? `Choose who, and when, for ${booking.bookingNumber}.` : undefined} />
        <DialogBody className="space-y-3">
          {booking && (
            <div className="rounded-xl border bg-slate-50 p-3.5 text-[13px]">
              <p className="font-semibold text-brand-navy">{booking.items.map((i) => i.serviceName).join(', ') || booking.problemDescription || 'Repair visit'}</p>
              <p className="mt-0.5 text-muted-foreground">
                {booking.customer.fullName} · {booking.customer.mobile} · {booking.addressSnapshot.line1}, {booking.addressSnapshot.city}
              </p>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Visit date" required htmlFor="assign-date" error={dateInPast ? 'Date cannot be in the past' : undefined}>
              <Input id="assign-date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Visit time" required htmlFor="assign-time">
              <Input id="assign-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">Technicians ranked by area, skills, availability and workload.</p>
          {loading && Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-20" />)}
          {!loading && !suggestions?.length && <EmptyState icon={HardHat} title="No technicians in this branch" description="Add technicians under Master Data → Staff Management." />}
          {suggestions?.map((s, idx) => (
            <button
              key={s.staffId}
              type="button"
              onClick={() => setSelected(s.staffId)}
              className={cn('flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all duration-micro', selected === s.staffId ? 'border-brand-blue bg-brand-blue-50/60 ring-2 ring-brand-blue/20' : 'hover:border-brand-blue-300')}
            >
              <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold', idx === 0 ? 'bg-brand-green-500 text-white' : 'bg-slate-100 text-slate-600')}>{idx === 0 ? <Star className="h-4 w-4" /> : idx + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-brand-navy">{s.name}</span>
                  <span className="text-xs text-muted-foreground">{s.staffCode} · {s.mobile}</span>
                  {!s.isAvailable && <Badge tone="amber">Marked unavailable</Badge>}
                </span>
                <span className="mt-1.5 flex flex-wrap gap-1.5">
                  {s.coversArea && <Badge tone="green"><MapPin className="h-3 w-3" /> Covers area</Badge>}
                  {s.matchedSkills.map((k) => (
                    <Badge key={k} tone="blue">{k}</Badge>
                  ))}
                </span>
                <span className="mt-1.5 block text-xs text-muted-foreground">
                  {s.jobsOnDate} job(s) that day · {s.activeJobs} active now
                </span>
              </span>
              <span className="num shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{s.score}</span>
            </button>
          ))}
          <Field label="Notes for technician" counter={{ value: notes.length, max: 1000 }}>
            <Textarea value={notes} placeholder={PLACEHOLDERS.TECHNICIAN_NOTES} onChange={(e) => setNotes(e.target.value)} maxLength={1000} className="min-h-[64px]" />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!ready} loading={submitting} onClick={() => selected && ready && onAssign({ staffId: selected, notes: notes.trim() || undefined, scheduledDate: date, scheduledTime: time })}>
            <HardHat /> Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const RescheduleDialog = ({
  open,
  onOpenChange,
  date,
  onDateChange,
  slots,
  slotsLoading,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  date: string;
  onDateChange: (d: string) => void;
  slots?: Slot[];
  slotsLoading?: boolean;
  submitting?: boolean;
  onSubmit: (v: { scheduledDate: string; slotId: number | null; note: string }) => void;
}) => {
  const [slotId, setSlotId] = React.useState<number | null>(null);
  const [note, setNote] = React.useState('');
  React.useEffect(() => setSlotId(null), [date]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader title="Reschedule booking" description="The current slot is released and the technician assignment is cleared." />
        <DialogBody className="space-y-4">
          <Field label="New date" required className="max-w-xs" error={date && date < toYmd(new Date()) ? 'Date cannot be in the past' : !date ? 'Choose a date' : undefined}>
            <Input type="date" value={date} min={toYmd(new Date())} onChange={(e) => onDateChange(e.target.value)} />
          </Field>
          <Field label="Slot">
            <SlotGrid slots={slots} loading={slotsLoading} value={slotId} onChange={setSlotId} />
          </Field>
          <Field label="Reason / note">
            <Textarea value={note}  placeholder={PLACEHOLDERS.REASON}onChange={(e) => setNote(e.target.value)} maxLength={1000} className="min-h-[64px]" />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button loading={submitting} disabled={!date || date < toYmd(new Date())} onClick={() => onSubmit({ scheduledDate: date, slotId, note: note.trim() })}>
            Reschedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const AttachmentGallery = ({ items, onUpload, uploading }: { items: NonNullable<Booking['attachments']>; onUpload?: (files: File[], kind: string) => void; uploading?: boolean }) => {
  const input = React.useRef<HTMLInputElement>(null);
  const [kind, setKind] = React.useState('OTHER');
  return (
    <div className="space-y-4">
      {onUpload && (
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect value={kind} onChange={(e) => setKind(e.target.value)} className="w-36" aria-label="Photo type">
            <option value="BEFORE">Before</option>
            <option value="AFTER">After</option>
            <option value="OTHER">Other</option>
          </NativeSelect>
          <Button variant="outline" loading={uploading} onClick={() => input.current?.click()}>
            <Upload /> Upload files
          </Button>
          <input
            ref={input}
            type="file"
            hidden
            multiple
            accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) onUpload(files, kind);
              e.target.value = '';
            }}
          />
          <span className="text-xs text-muted-foreground">JPG, PNG, WEBP, MP4 or PDF · up to 6 files</span>
        </div>
      )}
      {!items.length ? (
        <EmptyState icon={ImagePlus} title="No photos or files" description="Technician before/after photos appear here." className="py-8" />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((a) => (
            <a key={a.id} href={assetUrl(a.filePath)} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-xl border bg-slate-50">
              {a.mimeType.startsWith('image/') ? (
                <img src={assetUrl(a.filePath)} alt={`${a.kind} attachment`} loading="lazy" className="aspect-[4/3] w-full object-cover transition-transform duration-page group-hover:scale-105" />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center text-xs font-semibold text-slate-500">{a.mimeType.split('/')[1].toUpperCase()}</div>
              )}
              <span className="absolute left-2 top-2">
                <Badge tone={a.kind === 'BEFORE' ? 'amber' : a.kind === 'AFTER' ? 'green' : 'neutral'}>{humanize(a.kind)}</Badge>
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};
