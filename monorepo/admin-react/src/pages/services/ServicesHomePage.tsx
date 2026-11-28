/**
 * Master Data → Services: landing page linking to every service-management screen.
 */

import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { SERVICE_HUB, SERVICE_HUB_PAGE } from '@/constants/navigation';
import { ROUTES } from '@/constants/routes';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/common';
import { Card } from '@/components/ui/primitives';

export default function ServicesHomePage() {
  const { can } = useAuth();
  return (
    <>
      <PageHeader title={SERVICE_HUB_PAGE.TITLE} description={SERVICE_HUB_PAGE.DESCRIPTION} breadcrumbs={[{ label: 'Master Data', to: ROUTES.STATES }, { label: SERVICE_HUB_PAGE.TITLE }]} />
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {SERVICE_HUB.filter((item) => can(item.permission)).map(({ to, label, description, icon: Icon }) => (
          <Link key={to} to={to} className="rounded-xl focus-visible:ring-2 focus-visible:ring-ring">
            <Card className="flex h-full items-center gap-4 p-5 transition-colors hover:border-brand-blue-300">
              {Icon && (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-blue-50 text-brand-blue">
                  <Icon className="h-5 w-5" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block font-display font-bold text-brand-navy">{label}</span>
                <span className="mt-0.5 block text-[13px] text-muted-foreground">{description}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
