/**
 * Settings shell: grouped sidebar of every settings section the user may open, with the
 * selected section rendered beside it. Desktop: sticky left sidebar. Mobile: scrollable chips.
 * Layout/UI only.
 */

import { NavLink, Outlet } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { SETTINGS_GROUPS } from '@/constants/navigation';
import { useSettingsItems } from '@/hooks/useHeader';
import { cn } from '@/lib/utils';

export const SettingsLayout = () => {
  const items = useSettingsItems();
  const groups = SETTINGS_GROUPS.map((g) => ({ title: g, items: items.filter((i) => i.group === g) })).filter((g) => g.items.length > 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[264px_minmax(0,1fr)] lg:gap-8">
      {/* Mobile / tablet: horizontal chips */}
      <nav aria-label="Settings sections" className="scrollbar-thin -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:hidden">
        {items.map((item) => {
          const Icon = item.icon ?? Settings;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                cn(
                  'inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors',
                  isActive ? 'border-brand-blue bg-brand-blue text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-brand-blue-200 hover:text-brand-blue',
                )
              }
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* Desktop: sticky sidebar */}
      <aside className="hidden lg:block">
        <nav aria-label="Settings sections" className="scrollbar-thin sticky top-[113px] max-h-[calc(100vh-137px)] overflow-y-auto rounded-2xl border border-border/80 bg-white p-3 shadow-card">
          <p className="flex items-center gap-2 px-2.5 pb-3 pt-1 font-display text-[15px] font-bold text-brand-navy">
            <Settings className="h-4 w-4 text-brand-blue" /> Settings
          </p>
          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g.title}>
                <p className="px-2.5 pb-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{g.title}</p>
                <ul className="space-y-0.5">
                  {g.items.map((item) => {
                    const Icon = item.icon ?? Settings;
                    return (
                      <li key={item.to}>
                        <NavLink
                          to={item.to}
                          end
                          className={({ isActive }) =>
                            cn(
                              'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-colors',
                              isActive ? 'bg-brand-blue-50 font-semibold text-brand-blue' : 'text-slate-600 hover:bg-slate-50 hover:text-brand-navy',
                            )
                          }
                        >
                          {({ isActive }) => (
                            <>
                              <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-brand-blue' : 'text-slate-400 group-hover:text-slate-500')} />
                              <span className="truncate">{item.label}</span>
                              {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-blue" />}
                            </>
                          )}
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>
      </aside>

      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
};
