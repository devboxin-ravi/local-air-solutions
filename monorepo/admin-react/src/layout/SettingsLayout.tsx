/**
 * Settings shell: grouped sidebar of every settings section the user may open, with the
 * selected section rendered beside it. Desktop: sticky left sidebar that collapses to icons
 * (remembered per browser). Mobile: scrollable chips.
 * Layout/UI only.
 */

import type * as React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react";
import {
  SETTINGS_GROUP_ICONS,
  SETTINGS_GROUPS,
  SETTINGS_SIDEBAR,
} from "@/constants/navigation";
import { useSettingsItems } from "@/hooks/useHeader";
import { useSettingsSidebar } from "@/hooks/useSettingsSidebar";
import { Button } from "@/components/ui/primitives";
import { Tooltip } from "@/components/ui/overlays";
import { cn } from "@/lib/utils";

/** Instant tooltip on the right — only for icon-only (collapsed) items. */
const MaybeTooltip = ({
  label,
  children,
}: {
  label?: string;
  children: React.ReactElement;
}) =>
  label ? (
    <Tooltip content={label} side="right" delayDuration={0}>
      {/* Wrapper is the trigger: Radix's Slot would mangle NavLink's className function. */}
      <span className="flex justify-center">{children}</span>
    </Tooltip>
  ) : (
    children
  );

export const SettingsLayout = () => {
  const items = useSettingsItems();
  const { collapsed, toggle } = useSettingsSidebar();
  const groups = SETTINGS_GROUPS.map((g) => ({
    title: g,
    items: items.filter((i) => i.group === g),
  })).filter((g) => g.items.length > 0);

  return (
    <div
      className={cn(
        "grid gap-6 lg:gap-6",
        collapsed
          ? "lg:grid-cols-[52px_minmax(0,1fr)]"
          : "lg:grid-cols-[240px_minmax(0,1fr)]",
      )}
    >
      {/* Mobile / tablet: horizontal chips */}
      <nav
        aria-label="Settings sections"
        className="scrollbar-thin -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:hidden"
      >
        {items.map((item) => {
          const Icon = item.icon ?? Settings;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors",
                  isActive
                    ? "border-brand-blue bg-brand-blue text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-brand-blue-200 hover:text-brand-blue",
                )
              }
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* Desktop: sticky sidebar — full labels, or icons only when collapsed */}
      <aside className="hidden lg:block">
        <nav
          aria-label="Settings sections"
          className={cn(
            "scrollbar-thin sticky top-[97px] max-h-[calc(100vh-121px)] overflow-y-auto rounded-2xl border border-border/80 bg-white shadow-card",
            collapsed ? "p-1.5" : "p-2.5",
          )}
        >
          <div
            className={cn(
              "flex items-center pb-1.5",
              collapsed ? "justify-center" : "justify-between pl-2",
            )}
          >
            {!collapsed && (
              <p className="flex items-center gap-2 font-display text-[15px] font-bold text-brand-navy">
                <Settings className="h-4 w-4 text-brand-blue" />{" "}
                {SETTINGS_SIDEBAR.TITLE}
              </p>
            )}
            <Tooltip
              content={
                collapsed ? SETTINGS_SIDEBAR.EXPAND : SETTINGS_SIDEBAR.COLLAPSE
              }
              side="right"
              delayDuration={0}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={toggle}
                aria-label={
                  collapsed
                    ? SETTINGS_SIDEBAR.EXPAND
                    : SETTINGS_SIDEBAR.COLLAPSE
                }
                aria-expanded={!collapsed}
                className="text-slate-500 hover:text-brand-blue"
              >
                {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
              </Button>
            </Tooltip>
          </div>
          <div className={collapsed ? "space-y-1" : "space-y-2"}>
            {groups.map((g, gi) => {
              const GroupIcon = SETTINGS_GROUP_ICONS[g.title];
              return (
                <div
                  key={g.title}
                  className={cn(
                    collapsed && gi > 0 && "border-t border-slate-100 pt-1",
                  )}
                >
                  {!collapsed && (
                    <p className="flex items-center gap-1.5 px-2 pb-0.5 pt-1 text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                      <GroupIcon className="h-3.5 w-3.5" />
                      {g.title}
                    </p>
                  )}
                  <ul>
                    {g.items.map((item) => {
                      const Icon = item.icon ?? Settings;
                      return (
                        <li key={item.to}>
                          <MaybeTooltip
                            label={collapsed ? item.label : undefined}
                          >
                            <NavLink
                              to={item.to}
                              end
                              aria-label={collapsed ? item.label : undefined}
                              className={({ isActive }) =>
                                cn(
                                  "group flex items-center rounded-lg text-[13.5px] font-medium transition-colors",
                                  collapsed
                                    ? "h-9 w-9 justify-center"
                                    : "gap-2.5 px-2.5 py-1.5",
                                  isActive
                                    ? "bg-brand-blue-50 font-semibold text-brand-blue"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-brand-navy",
                                )
                              }
                            >
                              {({ isActive }) => (
                                <>
                                  <Icon
                                    className={cn(
                                      "h-4 w-4 shrink-0",
                                      isActive
                                        ? "text-brand-blue"
                                        : "text-slate-400 group-hover:text-slate-500",
                                    )}
                                  />
                                  {!collapsed && (
                                    <span className="truncate">
                                      {item.label}
                                    </span>
                                  )}
                                  {!collapsed && isActive && (
                                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-blue" />
                                  )}
                                </>
                              )}
                            </NavLink>
                          </MaybeTooltip>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </nav>
      </aside>

      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
};
