/**
 * Base form & display primitives (shadcn-style). UI only.
 */

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import * as LabelPrimitive from '@radix-ui/react-label';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cva, type VariantProps } from 'class-variance-authority';
import { Check, Eye, EyeOff, Loader2, Minus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PASSWORD_TOGGLE, SEARCHABLE_SELECT } from '@/constants/ui';
import { Combobox, type ComboOption } from './combobox';

// ─── Button ───
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-[background-color,box-shadow,color,transform] duration-micro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-brand-blue text-white shadow-sm hover:bg-brand-blue-700',
        secondary: 'bg-brand-green-500 text-white shadow-sm hover:bg-brand-green-600',
        outline: 'border border-input bg-white text-foreground hover:bg-muted',
        ghost: 'text-foreground hover:bg-muted',
        soft: 'bg-brand-blue-50 text-brand-blue-700 hover:bg-brand-blue-100',
        destructive: 'bg-destructive text-white shadow-sm hover:bg-red-700',
        link: 'text-brand-blue underline-offset-4 hover:underline px-0',
      },
      size: { default: 'h-control px-4', sm: 'h-control-sm px-3 text-xs', lg: 'h-11 px-6 text-[15px]', icon: 'h-control w-10 px-0', 'icon-sm': 'h-8 w-8 px-0' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, loading, children, disabled, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} disabled={disabled || loading} {...props}>
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Loader2 className="animate-spin" />}
          {children}
        </>
      )}
    </Comp>
  );
});
Button.displayName = 'Button';

// ─── Inputs ───
const fieldBase =
  'flex w-full rounded-lg border border-input bg-white px-3 text-sm text-foreground shadow-sm transition-colors duration-micro placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-brand-blue disabled:cursor-not-allowed disabled:bg-muted aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/20';

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  /** Password fields get a show/hide eye by default; pass false where the page draws its own. */
  revealToggle?: boolean;
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, revealToggle = true, type, ...props }, ref) => {
  const [shown, setShown] = React.useState(false);
  if (type !== 'password' || !revealToggle) return <input ref={ref} type={type} className={cn(fieldBase, 'h-control', className)} {...props} />;
  return (
    <div className="relative w-full">
      <input ref={ref} type={shown ? 'text' : 'password'} className={cn(fieldBase, 'h-control pr-10', className)} {...props} />
      <button
        type="button"
        tabIndex={-1}
        aria-label={shown ? PASSWORD_TOGGLE.HIDE : PASSWORD_TOGGLE.SHOW}
        title={shown ? PASSWORD_TOGGLE.HIDE : PASSWORD_TOGGLE.SHOW}
        onClick={() => setShown((v) => !v)}
        disabled={props.disabled}
        className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:pointer-events-none"
      >
        {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(fieldBase, 'min-h-[88px] py-2 leading-relaxed', className)} {...props} />
));
Textarea.displayName = 'Textarea';

/**
 * Compact search box used inside every dropdown and picker: soft grey fill, light-blue border,
 * "Search…" placeholder and a clear (×) button once something is typed.
 */
export const SearchBox = React.forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & { value: string; onValueChange: (v: string) => void; wrapperClassName?: string }>(
  ({ value, onValueChange, className, wrapperClassName, placeholder = SEARCHABLE_SELECT.SEARCH_PLACEHOLDER, ...props }, ref) => (
    <div className={cn('relative', wrapperClassName)}>
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={placeholder}
        aria-label={props['aria-label'] ?? placeholder}
        autoComplete="off"
        spellCheck={false}
        className={cn(
          'h-9 w-full rounded-lg border-2 border-brand-blue-100 bg-slate-50 px-3 pr-8 text-[13px] text-foreground outline-none transition-colors placeholder:text-slate-400 hover:border-brand-blue-200 focus:border-brand-blue-200 focus:bg-white focus-visible:ring-0 focus-visible:ring-offset-0',
          className,
        )}
        {...props}
      />
      {value && (
        <button type="button" aria-label="Clear search" onClick={() => onValueChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  ),
);
SearchBox.displayName = 'SearchBox';

/** Chevron + padding for the native <select>; defined in styles/index.css. */
const selectChevron = 'select-chevron';

interface SelectOptionItem {
  value: string;
  label: string;
  disabled?: boolean;
}

const nodeText = (node: React.ReactNode): string =>
  React.Children.toArray(node)
    .map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : React.isValidElement<{ children?: React.ReactNode }>(c) ? nodeText(c.props.children) : ''))
    .join('');

/** Flattens <option> children (including arrays, fragments and optgroups) into a list. */
const collectOptions = (children: React.ReactNode, out: SelectOptionItem[] = []): SelectOptionItem[] => {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement<{ value?: string | number; children?: React.ReactNode; disabled?: boolean }>(child)) return;
    if (child.type === 'option') {
      const label = nodeText(child.props.children);
      out.push({ value: child.props.value !== undefined ? String(child.props.value) : label, label, disabled: child.props.disabled });
    } else {
      collectOptions(child.props.children, out);
    }
  });
  return out;
};

type NativeSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  /** Force the type-to-search popover on/off. By default it turns on for long lists. */
  searchable?: boolean;
};

/**
 * Drop-in `<select>`. Long lists (SEARCHABLE_SELECT.MIN_OPTIONS+) render a type-to-search popover
 * while a hidden native <select> keeps the value, so `value/onChange` and react-hook-form
 * `register()` work unchanged. An option with value "" acts as the placeholder / "all" choice.
 */
export const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(({ className, children, searchable, ...props }, ref) => {
  const options = collectOptions(children);
  const choiceCount = options.filter((o) => o.value !== '').length;
  if (searchable ?? choiceCount >= SEARCHABLE_SELECT.MIN_OPTIONS) {
    return (
      <SearchableNativeSelect ref={ref} className={className} options={options} {...props}>
        {children}
      </SearchableNativeSelect>
    );
  }
  return (
    <select ref={ref} className={cn(fieldBase, 'h-control', selectChevron, className)} {...props}>
      {children}
    </select>
  );
});
NativeSelect.displayName = 'NativeSelect';

const SearchableNativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { options: SelectOptionItem[] }>(
  ({ className, children, options, id, disabled, 'aria-invalid': ariaInvalid, 'aria-label': ariaLabel, ...props }, ref) => {
    const selectRef = React.useRef<HTMLSelectElement | null>(null);
    const setRefs = (el: HTMLSelectElement | null) => {
      selectRef.current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) ref.current = el;
    };
    // Mirrors the hidden select's value so uncontrolled (react-hook-form) fields show the right label.
    const [current, setCurrent] = React.useState<string>(props.value !== undefined ? String(props.value) : '');

    React.useLayoutEffect(() => {
      const v = props.value !== undefined ? String(props.value) : selectRef.current?.value ?? '';
      if (v !== current) setCurrent(v);
    });

    const comboOptions = React.useMemo<ComboOption[]>(() => options.map((o) => ({ value: o.value, label: o.label, disabled: o.disabled, muted: o.value === '' })), [options]);
    const placeholder = options.find((o) => o.value === '')?.label;

    /** Writes the value to the hidden select and fires real change/blur events so any onChange/register sees it. */
    const pick = (o: ComboOption) => {
      const el = selectRef.current;
      if (!el) return;
      el.value = o.value;
      setCurrent(o.value);
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    };

    return (
      <>
        <select ref={setRefs} tabIndex={-1} aria-hidden className="sr-only" disabled={disabled} {...props}>
          {children}
        </select>
        <Combobox
          id={id}
          aria-label={ariaLabel}
          invalid={ariaInvalid === true || ariaInvalid === 'true'}
          disabled={disabled}
          options={comboOptions}
          value={current}
          onSelect={pick}
          placeholder={placeholder ?? SEARCHABLE_SELECT.SELECT_PLACEHOLDER}
          className={className}
        />
      </>
    );
  },
);
SearchableNativeSelect.displayName = 'SearchableNativeSelect';

export const Label = React.forwardRef<React.ElementRef<typeof LabelPrimitive.Root>, React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn('text-[13px] font-medium text-slate-700', className)} {...props} />
));
Label.displayName = 'Label';

export const Checkbox = React.forwardRef<React.ElementRef<typeof CheckboxPrimitive.Root>, React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'group peer h-[18px] w-[18px] shrink-0 rounded-[5px] border border-slate-300 bg-white shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 data-[state=checked]:border-brand-blue data-[state=checked]:bg-brand-blue data-[state=checked]:text-white data-[state=indeterminate]:border-brand-blue data-[state=indeterminate]:bg-brand-blue data-[state=indeterminate]:text-white',
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center">
      <Check className="h-3.5 w-3.5 group-data-[state=indeterminate]:hidden" strokeWidth={3} />
      {/* "Some selected" state (checked="indeterminate"), e.g. select-all headers. */}
      <Minus className="hidden h-3.5 w-3.5 group-data-[state=indeterminate]:block" strokeWidth={3} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = 'Checkbox';

export const Switch = React.forwardRef<React.ElementRef<typeof SwitchPrimitive.Root>, React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-micro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-brand-green-500 data-[state=unchecked]:bg-slate-300',
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb className="pointer-events-none block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-micro data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0" />
  </SwitchPrimitive.Root>
));
Switch.displayName = 'Switch';

// ─── Card ───
export const Card = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('rounded-xl border border-border/80 bg-card text-card-foreground shadow-card', className)} {...props} />
);
export const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-1 p-5 pb-3', className)} {...props} />
);
export const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn('font-display text-[15px] font-bold text-brand-navy', className)} {...props} />
);
export const CardDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn('text-[13px] text-muted-foreground', className)} {...props} />
);
export const CardContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('p-5 pt-2', className)} {...props} />;

// ─── Misc ───
export const Skeleton = ({ className }: { className?: string }) => <div className={cn('skeleton h-4', className)} />;

export const Separator = ({ className }: { className?: string }) => <div role="separator" className={cn('h-px w-full bg-border', className)} />;

export const Avatar = ({ src, fallback, className }: { src?: string | null; fallback: string; className?: string }) => (
  <AvatarPrimitive.Root className={cn('relative flex h-9 w-9 shrink-0 overflow-hidden rounded-full', className)}>
    {src && <AvatarPrimitive.Image src={src} className="aspect-square h-full w-full object-cover" />}
    <AvatarPrimitive.Fallback className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-blue to-brand-blue-400 text-xs font-bold text-white">
      {fallback}
    </AvatarPrimitive.Fallback>
  </AvatarPrimitive.Root>
);

export const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground sm:inline">{children}</kbd>
);
