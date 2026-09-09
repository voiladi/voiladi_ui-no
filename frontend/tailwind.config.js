/** @type {import('tailwindcss').Config} */

// Voiladi design tokens (Apple/iOS system). Hex values live here so Tailwind opacity modifiers (e.g. ring-ink/30) work.
const palette = {
  ink: '#1D1D1F',
  ink2: '#3A3A3C',
  paper: '#FFFFFF',
  surface: '#FFFFFF',
  surface2: '#F5F5F7',
  surface3: '#E8E8ED',
  line: '#E5E5EA',
  mute: '#6E6E73',
  mute2: '#8E8E93',
  tint: '#2B4C7E',
  'tint-dark': '#1F3A63',
  'tint-soft': '#EDF1F7',
  danger: '#D70015',
  online: '#34C759',
};

module.exports = {
    // `overline` is a Tailwind utility; without this an app's own eyebrow-label class draws a line above the text.
    blocklist: ["overline"],
    darkMode: ["class"],
    content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"SF Pro Text"', 'Inter', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"SF Pro Display"', 'Inter', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        btn: '12px',
        card: '16px',
        sheet: '20px',
        frame: '40px',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(0, 0, 0, 0.04), 0 2px 10px rgba(0, 0, 0, 0.06)',
        card: '0 2px 6px rgba(0, 0, 0, 0.04), 0 10px 28px rgba(0, 0, 0, 0.08)',
        float: '0 12px 40px rgba(0, 0, 0, 0.14)',
      },
      transitionTimingFunction: {
        ios: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
      },
      colors: {
        ...palette,
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))'
        }
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0'
          },
          to: {
            height: 'var(--radix-accordion-content-height)'
          }
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)'
          },
          to: {
            height: '0'
          }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out'
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
};
