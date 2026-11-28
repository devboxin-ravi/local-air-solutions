/** @type {import('tailwindcss').Config} */
// Design tokens derived from the Local Air Solutions logo (blue #0048A8, green #88C040).
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1.5rem', screens: { '2xl': '1440px' } },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        brand: {
          blue: { DEFAULT: '#0048A8', 50: '#EEF4FD', 100: '#D7E5FA', 200: '#AFCBF4', 300: '#7AA8EA', 400: '#3F7CD8', 500: '#0B5BC4', 600: '#0048A8', 700: '#003A8A', 800: '#002E6C', 900: '#0F1F3D' },
          green: { DEFAULT: '#88C040', 50: '#F4F9EC', 100: '#E6F2D2', 200: '#CDE5A6', 300: '#B0D575', 400: '#99CA55', 500: '#88C040', 600: '#6FA22F', 700: '#567E26', 800: '#3F5D1D', 900: '#2A3E14' },
          navy: '#0F1F3D',
        },
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        success: { DEFAULT: '#16A34A', soft: '#DCFCE7' },
        warning: { DEFAULT: '#D97706', soft: '#FEF3C7' },
        danger: { DEFAULT: '#DC2626', soft: '#FEE2E2' },
      },
      fontFamily: {
        // Times New Roman across the system; Hindi falls back to the system Devanagari serif fonts.
        sans: ['"Times New Roman"', 'Times', '"Nirmala UI"', '"Noto Serif Devanagari"', 'Mangal', 'serif'],
        display: ['"Times New Roman"', 'Times', '"Nirmala UI"', '"Noto Serif Devanagari"', 'Mangal', 'serif'],
      },
      borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 2px)', sm: 'calc(var(--radius) - 4px)', xl: 'calc(var(--radius) + 4px)' },
      boxShadow: {
        card: '0 1px 2px rgba(15,31,61,0.04), 0 1px 3px rgba(15,31,61,0.06)',
        elevated: '0 4px 6px -2px rgba(15,31,61,0.05), 0 12px 24px -6px rgba(15,31,61,0.10)',
        header: '0 1px 0 rgba(15,31,61,0.06), 0 2px 8px rgba(15,31,61,0.04)',
      },
      height: { control: '2.5rem', 'control-sm': '2rem', header: '4rem' },
      transitionDuration: { micro: '150ms', dropdown: '120ms', modal: '160ms', page: '240ms' },
      keyframes: {
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        'slide-down': { from: { opacity: 0, translate: '0 -6px' }, to: { opacity: 1, translate: '0 0' } },
        // Uses the standalone `scale` property so it never overrides the centring translate on dialogs.
        'zoom-in': { from: { opacity: 0, scale: '0.97' }, to: { opacity: 1, scale: '1' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'fade-up': { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        float: { '0%, 100%': { transform: 'translateY(0) rotate(0deg)' }, '50%': { transform: 'translateY(-10px) rotate(8deg)' } },
      },
      animation: {
        'fade-up': 'fade-up 460ms cubic-bezier(0.2, 0.7, 0.2, 1) both',
        float: 'float 9s ease-in-out infinite',
        'fade-in': 'fade-in 120ms ease-out',
        'slide-down': 'slide-down 120ms ease-out',
        'zoom-in': 'zoom-in 140ms ease-out',
      },
    },
  },
  plugins: [],
};
