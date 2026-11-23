/**
 * Sticky top header: logo, horizontal module navigation with dropdowns, global search,
 * notifications, branch selector and profile menu. Mobile: compact drawer. No sidebar.
 */

import * as React from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Building2, CalendarCheck2, ChevronDown, FileText, KeyRound, LogOut, Menu, Search, ShieldCheck, User, Users, Wrench, X } from 'lucide-react';
import { NAVIGATION, type NavModule } from '@/constants/navigation';
import { ROUTES } from '@/constants/routes';
import { cn, formatRelative, initials } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useBranchScope } from '@/hooks/useBranchScope';
import { useBranches } from '@/hooks/useApi';
import { useGlobalSearch, useNotifications } from '@/hooks/useHeader';
import { BrandLogo } from '@/components/common';
import { Avatar, Button, Input, NativeSelect } from '@/components/ui/primitives';
import { Dialog, DrawerContent, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/overlays';

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  COMPANY_ADMIN: 'Company Admin',
  BRANCH_MANAGER: 'Branch Manager',
  TECHNICIAN: 'Technician',
};

const useVisibleNav = () => {
  const { can } = useAuth();
  return NAVIGATION.filter((m) => can(m.permission))
    .map((m) => ({ ...m, children: m.children.filter((c) => can(c.permission)) }))
    .filter((m) => m.children.length > 0);
};

const NAV_ITEM =
  'relative isolate flex h-10 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 text-[13.5px] font-semibold transition-colors duration-micro focus-visible:ring-2 focus-visible:ring-ring xl:px-3 2xl:px-4';
const NAV_ACTIVE = 'text-white';
const NAV_IDLE = 'text-slate-600 hover:bg-white hover:text-brand-blue hover:shadow-sm';

/** Solid brand pill behind the active module; animates between items. */
const ActivePill = () => (
  <motion.span
    layoutId="nav-active-pill"
    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
    className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-r from-brand-blue to-brand-blue-500 shadow-md shadow-brand-blue/25"
  />
);

/** Desktop module dropdown (opens on click/keyboard; hover-intent for pointer users). */
const ModuleMenu = ({ module, active }: { module: NavModule; active: boolean }) => {
  const [open, setOpen] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout>>();
  const navigate = useNavigate();
  const Icon = module.icon;
  const single = module.children.length === 1;

  if (single) {
    return (
      <NavLink to={module.children[0].to} className={cn(NAV_ITEM, active ? NAV_ACTIVE : NAV_IDLE)}>
        <Icon className="hidden h-4 w-4 shrink-0 xl:block" />
        {module.label}
        {active && <ActivePill />}
      </NavLink>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <div
        onPointerEnter={(e) => {
          if (e.pointerType !== 'mouse') return;
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setOpen(true), 80);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType !== 'mouse') return;
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setOpen(false), 150);
        }}
        className="relative"
      >
        <DropdownMenuTrigger className={cn(NAV_ITEM, 'outline-none', active ? NAV_ACTIVE : open ? 'bg-white text-brand-blue shadow-sm' : NAV_IDLE)}>
          <Icon className="hidden h-4 w-4 shrink-0 xl:block" />
          {module.label}
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-dropdown', active ? 'opacity-90' : 'opacity-50', open && 'rotate-180')} />
          {active && <ActivePill />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={8} className="w-60" onPointerEnter={() => clearTimeout(timer.current)}>
          <DropdownMenuLabel>{module.label}</DropdownMenuLabel>
          {module.children.map((c) => (
            <DropdownMenuItem key={c.to} onSelect={() => navigate(c.to)}>
              {c.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </div>
    </DropdownMenu>
  );
};

const SEARCH_GROUPS = [
  { key: 'bookings', label: 'Bookings', icon: CalendarCheck2 },
  { key: 'customers', label: 'Customers', icon: Users },
  { key: 'invoices', label: 'Invoices', icon: FileText },
  { key: 'services', label: 'Services', icon: Wrench },
  { key: 'staff', label: 'Technicians', icon: User },
  { key: 'amc', label: 'AMC', icon: ShieldCheck },
] as const;

const GlobalSearch = ({ className }: { className?: string }) => {
  const { term, setTerm, results, loading } = useGlobalSearch();
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const go = (to: string) => {
    setOpen(false);
    setTerm('');
    navigate(to);
  };

  const rows = results
    ? SEARCH_GROUPS.flatMap((g) =>
        (results[g.key] as Array<Record<string, unknown>>).map((r) => {
          const id = r.id as number;
          switch (g.key) {
            case 'bookings':
              return { g, id, title: r.bookingNumber as string, sub: (r.customer as { fullName: string }).fullName, to: ROUTES.BOOKING_DETAIL(id) };
            case 'customers':
              return { g, id, title: r.fullName as string, sub: `${r.customerCode} · ${r.mobile}`, to: ROUTES.CUSTOMER_DETAIL(id) };
            case 'invoices':
              return { g, id, title: r.invoiceNumber as string, sub: `₹${r.grandTotal}`, to: ROUTES.INVOICE_DETAIL(id) };
            case 'services':
              return { g, id, title: r.name as string, sub: r.code as string, to: ROUTES.SERVICE_EDIT(id) };
            case 'staff':
              return { g, id, title: (r.user as { name: string }).name, sub: r.staffCode as string, to: `${ROUTES.STAFF}?search=${r.staffCode}` };
            default:
              return { g, id, title: r.amcNumber as string, sub: (r.customer as { fullName: string }).fullName, to: ROUTES.AMC_DETAIL(id) };
          }
        }),
      )
    : [];

  return (
    <Popover open={open && term.trim().length >= 2} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className={cn('relative', className)}>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
          <Input
            ref={inputRef}
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search booking, customer, invoice…"
            className="h-11 rounded-xl border-slate-200 bg-slate-50 pl-10 pr-14 text-[14px] shadow-none transition-colors hover:border-slate-300 focus-visible:border-brand-blue focus-visible:bg-white"
            aria-label="Global search"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10.5px] font-semibold text-slate-500 shadow-sm sm:block">Ctrl K</span>
        </div>
      </PopoverAnchor>
      <PopoverContent align="start" className="w-[min(92vw,420px)] p-1.5" onOpenAutoFocus={(e) => e.preventDefault()}>
        {loading && !results && <p className="px-3 py-4 text-center text-[13px] text-muted-foreground">Searching…</p>}
        {results && rows.length === 0 && <p className="px-3 py-4 text-center text-[13px] text-muted-foreground">No matches for “{term}”.</p>}
        <div className="scrollbar-thin max-h-[380px] overflow-y-auto">
          {rows.map((r) => (
            <button key={`${r.g.key}-${r.id}`} type="button" onClick={() => go(r.to)} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-brand-blue-50">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <r.g.icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-brand-navy">{r.title}</span>
                <span className="block truncate text-[12px] text-muted-foreground">{r.sub}</span>
              </span>
              <span className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">{r.g.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

/** Icon-triggered search for narrower desktops/tablets. */
const CompactSearch = () => (
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="ghost" size="icon" aria-label="Search" className="text-slate-600 md:hidden">
        <Search className="h-[18px] w-[18px]" />
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-[min(92vw,420px)] p-3">
      <GlobalSearch />
    </PopoverContent>
  </Popover>
);

const NotificationBell = () => {
  const { items, unread, markRead } = useNotifications(8);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`} className="relative h-11 w-11 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-brand-blue-200 hover:bg-brand-blue-50 hover:text-brand-blue">
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && <span className="num absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">{unread > 9 ? '9+' : unread}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,380px)] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-display text-sm font-bold text-brand-navy">Notifications</p>
          {unread > 0 && (
            <button type="button" className="text-xs font-semibold text-brand-blue hover:underline" onClick={() => markRead('all')}>
              Mark all read
            </button>
          )}
        </div>
        <div className="scrollbar-thin max-h-[360px] overflow-y-auto">
          {items.length === 0 && <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">You’re all caught up.</p>}
          {items.map((n) => (
            <button key={n.id} type="button" onClick={() => !n.readAt && markRead([n.id])} className={cn('flex w-full gap-3 border-b px-4 py-3 text-left transition-colors last:border-0 hover:bg-slate-50', !n.readAt && 'bg-brand-blue-50/40')}>
              <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-brand-blue')} />
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-brand-navy">{n.title}</span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-slate-600">{n.body}</span>
                <span className="mt-1 block text-[11px] text-muted-foreground">{formatRelative(n.createdAt)}</span>
              </span>
            </button>
          ))}
        </div>
        <Link to={ROUTES.NOTIFICATIONS} className="block border-t px-4 py-2.5 text-center text-xs font-semibold text-brand-blue hover:bg-slate-50">
          View all notifications
        </Link>
      </PopoverContent>
    </Popover>
  );
};

const BranchSelector = ({ className }: { className?: string }) => {
  const { user } = useAuth();
  const { branchId, setBranchId } = useBranchScope();
  const { data: branches } = useBranches({ activeOnly: true });
  if (!user) return null;
  if (!user.isCompanyWide) {
    const own = branches?.find((b) => b.id === user.branchId);
    return (
      <span className={cn('hidden h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-brand-navy lg:inline-flex', className)}>
        <Building2 className="h-3.5 w-3.5" /> {own?.name ?? 'My branch'}
      </span>
    );
  }
  return (
    <div className={cn('relative', className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-lg bg-brand-green-50 text-brand-green-700">
        <Building2 className="h-3.5 w-3.5" />
      </span>
      <NativeSelect aria-label="Branch" value={branchId ?? ''} onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : undefined)} className="h-11 w-[170px] rounded-xl border-slate-200 bg-white pl-11 text-[13px] font-semibold text-brand-navy shadow-none hover:border-slate-300">
        <option value="">All branches</option>
        {branches?.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
};

const ProfileMenu = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-11 items-center gap-2.5 rounded-xl border border-transparent py-1 pl-1 pr-2 outline-none transition-colors hover:border-slate-200 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-ring">
        <span className="rounded-full bg-gradient-to-br from-brand-green-400 to-brand-blue p-[2px]">
          <Avatar fallback={initials(user.name)} className="h-9 w-9 ring-2 ring-white" />
        </span>
        <span className="hidden min-w-0 text-left lg:block">
          <span className="block max-w-[140px] truncate text-[13px] font-semibold leading-tight text-brand-navy">{user.name}</span>
          <span className="block max-w-[140px] truncate text-[11.5px] leading-tight text-muted-foreground">{ROLE_LABEL[user.roles[0]] ?? 'Staff'}</span>
        </span>
        <ChevronDown className="hidden h-3.5 w-3.5 text-slate-500 sm:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <div className="px-2.5 py-2">
          <p className="truncate text-[13px] font-bold text-brand-navy">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email ?? user.mobile}</p>
          <p className="mt-1 text-[11px] font-semibold text-brand-green-700">{user.roles.map((r) => r.replace('_', ' ')).join(', ')}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate(ROUTES.PROFILE)}>
          <KeyRound /> Profile & password
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate(ROUTES.NOTIFICATIONS)}>
          <Bell /> Notifications
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={() => void logout().then(() => navigate(ROUTES.LOGIN))}>
          <LogOut /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const MobileNav = ({ nav, open, onOpenChange }: { nav: NavModule[]; open: boolean; onOpenChange: (o: boolean) => void }) => {
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const { pathname } = useLocation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-w-sm" aria-describedby={undefined}>
        <div className="flex h-header items-center border-b px-5">
          <BrandLogo variant="header" className="h-10" />
        </div>
        <div className="space-y-3 border-b p-4">
          <GlobalSearch />
          <BranchSelector className="[&_select]:w-full" />
        </div>
        <nav className="scrollbar-thin flex-1 overflow-y-auto p-3" aria-label="Main">
          {nav.map((m) => {
            const isOpen = expanded === m.key || (expanded === null && pathname.startsWith(m.basePath));
            return (
              <div key={m.key} className="mb-1">
                <button type="button" onClick={() => setExpanded(isOpen ? '' : m.key)} className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-semibold', pathname.startsWith(m.basePath) ? 'bg-brand-blue-50 text-brand-blue' : 'text-slate-700 hover:bg-slate-50')}>
                  <m.icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{m.label}</span>
                  <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
                      <div className="ml-6 mt-1 space-y-0.5 border-l pl-3">
                        {m.children.map((c) => (
                          <NavLink key={c.to} to={c.to} end onClick={() => onOpenChange(false)} className={({ isActive }) => cn('block rounded-md px-3 py-2 text-[13px] font-medium', isActive ? 'bg-brand-blue-50 text-brand-blue' : 'text-slate-600 hover:bg-slate-50')}>
                            {c.label}
                          </NavLink>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>
      </DrawerContent>
    </Dialog>
  );
};

export const TopHeader = () => {
  const nav = useVisibleNav();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={cn('sticky top-0 z-40 bg-white/95 backdrop-blur transition-shadow duration-page supports-[backdrop-filter]:bg-white/90', scrolled ? 'shadow-header' : '')}>
      <div className="h-[3px] bg-gradient-to-r from-brand-blue via-brand-blue-400 to-brand-green-500" aria-hidden />

      {/* Row 1: brand · search · utilities */}
      <div className="mx-auto flex h-[72px] max-w-[1680px] items-center gap-3 px-4 sm:h-[80px] sm:gap-4 sm:px-6">
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" onClick={() => setMobileOpen(true)}>
          {mobileOpen ? <X /> : <Menu />}
        </Button>
        <Link to={ROUTES.DASHBOARD} className="flex shrink-0 items-center rounded-lg focus-visible:ring-2 focus-visible:ring-ring" aria-label="Local Air Solutions — Dashboard">
          <BrandLogo variant="header" className="h-[52px] sm:h-16" />
        </Link>

        <div className="hidden flex-1 justify-center px-4 md:flex">
          <GlobalSearch className="w-full max-w-xl" />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0">
          <CompactSearch />
          <BranchSelector className="hidden sm:block" />
          <NotificationBell />
          <span className="mx-1 hidden h-8 w-px bg-slate-200 sm:block" aria-hidden />
          <ProfileMenu />
        </div>
      </div>

      {/* Row 2: module navigation (no sidebar) */}
      <div className={cn('hidden border-y border-slate-200/80 bg-gradient-to-r from-brand-blue-50/70 via-slate-50 to-brand-green-50/70 lg:block', scrolled && 'border-b-transparent')}>
        <nav aria-label="Main" className="scrollbar-thin mx-auto flex h-14 max-w-[1680px] items-center justify-center gap-0.5 overflow-x-auto px-3 xl:gap-1.5 xl:px-6">
          {nav.map((m) => (
            <ModuleMenu key={m.key} module={m} active={pathname.startsWith(m.basePath)} />
          ))}
        </nav>
      </div>
      <MobileNav nav={nav} open={mobileOpen} onOpenChange={setMobileOpen} />
    </header>
  );
};
