/**
 * Sticky single-row header: logo, module navigation (overflow collapses into "More"),
 * notifications (settings live in the profile menu), branch selector and profile menu. Mobile: compact drawer. No sidebar.
 */

import * as React from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Building2, ChevronDown, KeyRound, LogOut, Menu, Settings, X } from 'lucide-react';
import { NAVIGATION, SETTINGS_MENU, type NavModule } from '@/constants/navigation';
import { ROUTES } from '@/constants/routes';
import { PAGE_CONTAINER } from '@/constants/ui';
import { cn, formatRelative, initials } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useBranchScope } from '@/hooks/useBranchScope';
import { useBranches } from '@/hooks/useApi';
import { useNotifications, useSettingsItems } from '@/hooks/useHeader';
import { usePriorityNav } from '@/hooks/usePriorityNav';
import { BrandLogo } from '@/components/common';
import { Avatar, Button, NativeSelect } from '@/components/ui/primitives';
import { Dialog, DrawerContent, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger, Popover, PopoverContent, PopoverTrigger } from '@/components/ui/overlays';

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
  'relative isolate flex h-10 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[14px] font-semibold outline-none transition-colors duration-micro focus-visible:ring-2 focus-visible:ring-ring';
const NAV_ACTIVE = 'text-brand-blue';
const NAV_IDLE = 'text-slate-600 hover:bg-slate-100 hover:text-brand-navy';
const NAV_OPEN = 'bg-slate-100 text-brand-navy';
const NAV_GAP = 'gap-1';

/** Soft brand pill behind the active module; glides between items. */
const ActivePill = () => (
  <motion.span
    layoutId="nav-active-pill"
    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
    className="absolute inset-0 -z-10 rounded-lg bg-brand-blue-50 ring-1 ring-inset ring-brand-blue-100"
  />
);

/** Label row shared by real items and the invisible measuring row (keeps widths identical). */
const NavItemBody = ({ module, chevron, open }: { module: NavModule; chevron: boolean; open?: boolean }) => (
  <>
    {module.label}
    {chevron && <ChevronDown className={cn('h-3.5 w-3.5 opacity-50 transition-transform duration-dropdown', open && 'rotate-180')} />}
  </>
);

/** Hover-intent open/close for pointer users; click and keyboard still work normally. */
const useHoverIntent = () => {
  const [open, setOpen] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout>>();
  const schedule = (next: boolean, ms: number) => (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(next), ms);
  };
  return { open, setOpen, onPointerEnter: schedule(true, 80), onPointerLeave: schedule(false, 150), keepOpen: () => clearTimeout(timer.current) };
};

/** Desktop module entry: direct link for single-page modules, dropdown otherwise. */
const ModuleMenu = ({ module, active }: { module: NavModule; active: boolean }) => {
  const { open, setOpen, onPointerEnter, onPointerLeave, keepOpen } = useHoverIntent();
  const navigate = useNavigate();

  if (module.children.length === 1) {
    return (
      <NavLink to={module.children[0].to} className={cn(NAV_ITEM, active ? NAV_ACTIVE : NAV_IDLE)}>
        <NavItemBody module={module} chevron={false} />
        {active && <ActivePill />}
      </NavLink>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <div onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} className="relative">
        <DropdownMenuTrigger className={cn(NAV_ITEM, active ? NAV_ACTIVE : open ? NAV_OPEN : NAV_IDLE)}>
          <NavItemBody module={module} chevron open={open} />
          {active && <ActivePill />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={10} className="w-60" onPointerEnter={keepOpen}>
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

/** "More" menu holding the modules that don't fit in the current width. */
const MoreMenu = ({ modules, active }: { modules: NavModule[]; active: boolean }) => {
  const [open, setOpen] = React.useState(false);
  const navigate = useNavigate();
  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger className={cn(NAV_ITEM, active ? NAV_ACTIVE : open ? NAV_OPEN : NAV_IDLE)}>
        More
        <ChevronDown className={cn('h-3.5 w-3.5 opacity-50 transition-transform duration-dropdown', open && 'rotate-180')} />
        {active && <ActivePill />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} className="w-56">
        {modules.map((m) =>
          m.children.length === 1 ? (
            <DropdownMenuItem key={m.key} onSelect={() => navigate(m.children[0].to)}>
              <m.icon /> {m.label}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuSub key={m.key}>
              <DropdownMenuSubTrigger>
                <m.icon /> {m.label}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-60">
                {m.children.map((c) => (
                  <DropdownMenuItem key={c.to} onSelect={() => navigate(c.to)}>
                    {c.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

/** Single-row module navigation; overflowing modules collapse into "More". */
const PriorityNav = ({ nav, className }: { nav: NavModule[]; className?: string }) => {
  const { pathname } = useLocation();
  const { containerRef, measureRef, visibleCount } = usePriorityNav(nav.length);
  const shown = nav.slice(0, visibleCount);
  const hidden = nav.slice(visibleCount);
  const isActive = (m: NavModule) => pathname.startsWith(m.basePath);

  return (
    <div ref={containerRef} className={cn('relative min-w-0 overflow-x-clip', className)}>
      <nav aria-label="Main" className={cn('flex items-center justify-center', NAV_GAP)}>
        {shown.map((m) => (
          <ModuleMenu key={m.key} module={m} active={isActive(m)} />
        ))}
        {hidden.length > 0 && <MoreMenu modules={hidden} active={hidden.some(isActive)} />}
      </nav>
      {/* Invisible measuring row: every item + the More trigger, same styles. */}
      <div ref={measureRef} aria-hidden className={cn('pointer-events-none invisible absolute left-0 top-0 flex w-max', NAV_GAP)}>
        {nav.map((m) => (
          <span key={m.key} className={NAV_ITEM}>
            <NavItemBody module={m} chevron={m.children.length > 1} />
          </span>
        ))}
        <span className={NAV_ITEM}>
          More <ChevronDown className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  );
};

const NotificationBell = () => {
  const { items, unread, markSeen, clearSeen, isNew } = useNotifications(8);
  return (
    <Popover onOpenChange={(open) => (open ? markSeen() : clearSeen())}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`} className="relative h-10 w-10 rounded-full text-slate-600 hover:bg-slate-100 hover:text-brand-navy data-[state=open]:bg-slate-100 data-[state=open]:text-brand-navy">
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && <span className="num absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">{unread > 9 ? '9+' : unread}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,380px)] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-display text-sm font-bold text-brand-navy">Notifications</p>
        </div>
        <div className="scrollbar-thin max-h-[360px] overflow-y-auto">
          {items.length === 0 && <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">You’re all caught up.</p>}
          {items.map((n) => (
            <div key={n.id} className={cn('flex w-full gap-3 border-b px-4 py-3 text-left last:border-0', isNew(n) && 'bg-brand-blue-50/40')}>
              <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', isNew(n) ? 'bg-brand-blue' : 'bg-transparent')} />
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-brand-navy">{n.title}</span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-slate-600">{n.body}</span>
                <span className="mt-1 block text-[11px] text-muted-foreground">{formatRelative(n.createdAt)}</span>
              </span>
            </div>
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
      <span className={cn('hidden h-9 max-w-[160px] items-center gap-1.5 truncate rounded-full border border-slate-200 bg-slate-50 px-3 text-[12.5px] font-semibold text-brand-navy lg:inline-flex', className)}>
        <Building2 className="h-3 w-3" /> {own?.name ?? 'My branch'}
      </span>
    );
  }
  return (
    <div className={cn('relative', className)}>
      <span className="pointer-events-none absolute left-1.5 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-brand-green-50 text-brand-green-700">
        <Building2 className="h-3 w-3" />
      </span>
      <NativeSelect aria-label="Branch" value={branchId ?? ''} onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : undefined)} className="h-9 w-[150px] truncate rounded-full border-slate-200 bg-slate-50 bg-[right_0.55rem_center] pl-9 pr-7 text-[12.5px] font-semibold text-brand-navy shadow-none hover:border-slate-300">
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
  const settingsItems = useSettingsItems();
  if (!user) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu: ${user.name}, ${ROLE_LABEL[user.roles[0]] ?? 'Staff'}`}
        title={user.name}
        className="flex h-10 w-10 items-center justify-center rounded-full outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="rounded-full bg-gradient-to-br from-brand-green-400 to-brand-blue p-[2px]">
          <Avatar fallback={initials(user.name)} className="h-[34px] w-[34px] ring-2 ring-white" />
        </span>
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
        {settingsItems.length > 0 && (
          <DropdownMenuItem onSelect={() => navigate(ROUTES.SETTINGS_HOME)}>
            <Settings /> {SETTINGS_MENU.label}
          </DropdownMenuItem>
        )}
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
        <div className="border-b p-4">
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
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b bg-white/95 backdrop-blur transition-shadow duration-page supports-[backdrop-filter]:bg-white/85',
        scrolled ? 'border-slate-200 shadow-header' : 'border-slate-200/70',
      )}
    >
      {/* One row: brand · modules · utilities */}
      <div className={cn(PAGE_CONTAINER, 'flex h-[68px] items-center gap-3 lg:h-[88px] lg:gap-6')}>
        <Button variant="ghost" size="icon" className="-ml-2 lg:hidden" aria-label="Open menu" onClick={() => setMobileOpen(true)}>
          {mobileOpen ? <X /> : <Menu />}
        </Button>
        <Link to={ROUTES.DASHBOARD} className="flex shrink-0 items-center rounded-lg focus-visible:ring-2 focus-visible:ring-ring" aria-label="Local Air Solutions — Dashboard">
          <BrandLogo variant="header" className="h-12 lg:h-16" />
        </Link>

        <PriorityNav nav={nav} className="hidden flex-1 lg:block" />

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2 lg:ml-0">
          <BranchSelector className="hidden sm:block" />
          <NotificationBell />
          <span className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" aria-hidden />
          <ProfileMenu />
        </div>
      </div>
      <MobileNav nav={nav} open={mobileOpen} onOpenChange={setMobileOpen} />
    </header>
  );
};
