/**
 * Overlay primitives: Dialog, Drawer (sheet), DropdownMenu (with submenus), Tooltip, Popover, Tabs. UI only.
 */

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Dialog ───
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { size?: 'sm' | 'md' | 'lg' | 'xl' }
>(({ className, children, size = 'md', ...props }, ref) => (
  <DialogPrimitive.Portal>
    {/* The overlay centres the dialog with grid (no translate on the dialog itself), so the open
        animation can never shift it sideways. */}
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-brand-navy/40 p-4 backdrop-blur-[2px] data-[state=open]:animate-fade-in">
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'relative flex max-h-[90vh] w-full flex-col rounded-2xl border bg-white shadow-elevated data-[state=open]:animate-zoom-in [&>form]:flex [&>form]:min-h-0 [&>form]:flex-1 [&>form]:flex-col focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0',
          { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size],
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Close">
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Overlay>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = 'DialogContent';

export const DialogHeader = ({ title, description }: { title: string; description?: string }) => (
  <div className="border-b px-6 pb-4 pt-5">
    <DialogPrimitive.Title className="font-display text-lg font-bold text-brand-navy">{title}</DialogPrimitive.Title>
    {description ? (
      <DialogPrimitive.Description className="mt-1 text-[13px] text-muted-foreground">{description}</DialogPrimitive.Description>
    ) : (
      <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
    )}
  </div>
);
export const DialogBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  // min-h-0 lets the body shrink and scroll so the footer always stays inside the dialog on short screens.
  <div className={cn('scrollbar-thin min-h-0 flex-1 overflow-y-auto px-6 py-5', className)} {...props} />
);
export const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col-reverse gap-2 border-t bg-slate-50/70 px-6 py-4 sm:flex-row sm:justify-end rounded-b-2xl', className)} {...props} />
);

// ─── Drawer (right sheet) ───
export const DrawerContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>>(
  ({ className, children, ...props }, ref) => (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-brand-navy/30 data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content
        ref={ref}
        className={cn('fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-elevated transition-transform duration-modal data-[state=open]:animate-fade-in focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0', className)}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Close">
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  ),
);
DrawerContent.displayName = 'DrawerContent';

// ─── Dropdown ───
export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;
export const DropdownMenuContent = React.forwardRef<React.ElementRef<typeof DropdownPrimitive.Content>, React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>>(
  ({ className, sideOffset = 6, ...props }, ref) => (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn('z-50 min-w-[12rem] overflow-hidden rounded-xl border bg-white p-1.5 shadow-elevated outline-none data-[state=open]:animate-slide-down focus-visible:ring-0 focus-visible:ring-offset-0', className)}
        {...props}
      />
    </DropdownPrimitive.Portal>
  ),
);
DropdownMenuContent.displayName = 'DropdownMenuContent';
export const DropdownMenuItem = React.forwardRef<React.ElementRef<typeof DropdownPrimitive.Item>, React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Item> & { destructive?: boolean }>(
  ({ className, destructive, ...props }, ref) => (
    <DropdownPrimitive.Item
      ref={ref}
      className={cn(
        // Highlight (bg) already marks the focused item, so suppress the global focus-visible ring here.
        'relative flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium outline-none transition-colors focus-visible:ring-0 focus-visible:ring-offset-0 data-[disabled]:pointer-events-none data-[highlighted]:bg-brand-blue-50 data-[highlighted]:text-brand-blue-700 data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-muted-foreground',
        destructive && 'text-destructive data-[highlighted]:bg-red-50 data-[highlighted]:text-destructive [&_svg]:text-destructive',
        className,
      )}
      {...props}
    />
  ),
);
DropdownMenuItem.displayName = 'DropdownMenuItem';
export const DropdownMenuLabel = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground', className)} {...props} />
);
export const DropdownMenuSeparator = () => <DropdownPrimitive.Separator className="-mx-1.5 my-1.5 h-px bg-border" />;
export const DropdownMenuSub = DropdownPrimitive.Sub;
export const DropdownMenuSubTrigger = React.forwardRef<React.ElementRef<typeof DropdownPrimitive.SubTrigger>, React.ComponentPropsWithoutRef<typeof DropdownPrimitive.SubTrigger>>(
  ({ className, children, ...props }, ref) => (
    <DropdownPrimitive.SubTrigger
      ref={ref}
      className={cn(
        'relative flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium outline-none transition-colors focus-visible:ring-0 focus-visible:ring-offset-0 data-[highlighted]:bg-brand-blue-50 data-[state=open]:bg-brand-blue-50 data-[highlighted]:text-brand-blue-700 data-[state=open]:text-brand-blue-700 [&_svg]:size-4 [&_svg]:text-muted-foreground',
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto" />
    </DropdownPrimitive.SubTrigger>
  ),
);
DropdownMenuSubTrigger.displayName = 'DropdownMenuSubTrigger';
export const DropdownMenuSubContent = React.forwardRef<React.ElementRef<typeof DropdownPrimitive.SubContent>, React.ComponentPropsWithoutRef<typeof DropdownPrimitive.SubContent>>(
  ({ className, sideOffset = 6, ...props }, ref) => (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.SubContent
        ref={ref}
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn('scrollbar-thin z-50 max-h-[min(70vh,var(--radix-dropdown-menu-content-available-height))] min-w-[13rem] overflow-y-auto rounded-xl border bg-white p-1.5 shadow-elevated outline-none data-[state=open]:animate-fade-in focus-visible:ring-0 focus-visible:ring-offset-0', className)}
        {...props}
      />
    </DropdownPrimitive.Portal>
  ),
);
DropdownMenuSubContent.displayName = 'DropdownMenuSubContent';

// ─── Tooltip ───
export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = ({
  content,
  children,
  side,
  delayDuration = 250,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** 0 = show immediately on hover (e.g. icon-only navigation). */
  delayDuration?: number;
}) => (
  <TooltipPrimitive.Root delayDuration={delayDuration}>
    <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content side={side} sideOffset={6} className="z-50 rounded-md bg-brand-navy px-2.5 py-1.5 text-xs font-medium text-white shadow-md data-[state=delayed-open]:animate-fade-in">
        {content}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  </TooltipPrimitive.Root>
);

// ─── Popover ───
export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverContent = React.forwardRef<React.ElementRef<typeof PopoverPrimitive.Content>, React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>>(
  ({ className, align = 'end', sideOffset = 8, ...props }, ref) => (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={cn('z-50 rounded-xl border bg-white shadow-elevated outline-none data-[state=open]:animate-slide-down focus-visible:ring-0 focus-visible:ring-offset-0', className)}
        {...props}
      />
    </PopoverPrimitive.Portal>
  ),
);
PopoverContent.displayName = 'PopoverContent';

// ─── Tabs ───
export const Tabs = TabsPrimitive.Root;
export const TabsList = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>) => (
  <TabsPrimitive.List className={cn('scrollbar-thin flex gap-1 overflow-x-auto border-b border-border', className)} {...props} />
);
export const TabsTrigger = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) => (
  <TabsPrimitive.Trigger
    className={cn(
      '-mb-px whitespace-nowrap border-b-2 border-transparent px-3.5 py-2.5 text-[13px] font-semibold text-muted-foreground transition-colors duration-micro hover:text-foreground data-[state=active]:border-brand-blue data-[state=active]:text-brand-blue',
      className,
    )}
    {...props}
  />
);
export const TabsContent = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>) => (
  <TabsPrimitive.Content className={cn('pt-5 focus-visible:outline-none data-[state=active]:animate-fade-in', className)} {...props} />
);
