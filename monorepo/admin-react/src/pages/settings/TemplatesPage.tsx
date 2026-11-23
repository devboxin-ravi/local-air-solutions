/**
 * Notification templates per event and channel. Placeholders use {{name}}.
 */

import { useMemo, useState } from 'react';
import { Pencil } from 'lucide-react';
import { useTemplates, useUpdateTemplate } from '@/hooks/useEngagement';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { humanize } from '@/lib/utils';
import type { Template } from '@/types';
import { ActiveBadge, ErrorState, Field, LoadingBlock, PageHeader } from '@/components/common';
import { Button, Card, Input, Label, Switch, Textarea } from '@/components/ui/primitives';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, Tabs, TabsList, TabsTrigger } from '@/components/ui/overlays';

const CHANNELS = ['IN_APP', 'PUSH', 'EMAIL', 'WHATSAPP'];

export default function TemplatesPage() {
  const { can } = useAuth();
  const { data, isLoading, error, refetch } = useTemplates();
  const update = useUpdateTemplate();
  const [channel, setChannel] = useState('IN_APP');
  const [editing, setEditing] = useState<Template | null>(null);
  const [draft, setDraft] = useState({ subject: '', body: '', isActive: true });
  const rows = useMemo(() => (data ?? []).filter((t) => t.channel === channel), [data, channel]);

  if (isLoading) return <LoadingBlock rows={6} />;
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />;

  return (
    <>
      <PageHeader title="Notification Templates" description="Wording of messages sent for each event. Use placeholders like {{bookingNumber}}, {{date}}, {{amount}}." breadcrumbs={[{ label: 'Settings', to: ROUTES.SETTINGS('company') }, { label: 'Templates' }]} />
      <Tabs value={channel} onValueChange={setChannel} className="mb-4">
        <TabsList>{CHANNELS.map((c) => <TabsTrigger key={c} value={c}>{humanize(c)}</TabsTrigger>)}</TabsList>
      </Tabs>
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {rows.map((t) => (
          <Card key={t.id} className="flex flex-col p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display font-bold text-brand-navy">{humanize(t.eventType)}</p>
              <ActiveBadge active={t.isActive} />
            </div>
            {t.subject && <p className="mt-2 text-[13px] font-semibold text-slate-700">{t.subject}</p>}
            <p className="mt-1 flex-1 text-[13px] text-slate-600">{t.body}</p>
            {can('notifications.manage') && <Button variant="ghost" size="sm" className="mt-3 self-start" onClick={() => { setEditing(t); setDraft({ subject: t.subject ?? '', body: t.body, isActive: t.isActive }); }}><Pencil /> Edit</Button>}
          </Card>
        ))}
      </div>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader title={editing ? `${humanize(editing.eventType)} · ${humanize(editing.channel)}` : ''} />
          <DialogBody className="space-y-4">
            <Field label="Title / subject"><Input value={draft.subject} maxLength={200} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} /></Field>
            <Field label="Message" required counter={{ value: draft.body.length, max: 5000 }}><Textarea value={draft.body} maxLength={5000} onChange={(e) => setDraft({ ...draft, body: e.target.value })} className="min-h-[140px]" /></Field>
            <div className="flex items-center justify-between rounded-lg border px-3.5 py-3"><Label>Active</Label><Switch checked={draft.isActive} onCheckedChange={(v) => setDraft({ ...draft, isActive: v })} /></div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button disabled={!draft.body.trim()} loading={update.isPending} onClick={() => editing && update.mutate({ id: editing.id, body: { subject: draft.subject.trim() || null, body: draft.body.trim(), isActive: draft.isActive } }, { onSuccess: () => setEditing(null) })}>Save template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
