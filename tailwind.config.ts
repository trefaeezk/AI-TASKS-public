import type { Config } from "tailwindcss";

export default {
    darkMode: ["class"],
    content: [
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		colors: {
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
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
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
  		},
  		// إضافة Grid متجاوب تلقائياً
  		gridTemplateColumns: {
  			'auto-fit-sm': 'repeat(auto-fit, minmax(250px, 1fr))',
  			'auto-fit-md': 'repeat(auto-fit, minmax(300px, 1fr))',
  			'auto-fit-lg': 'repeat(auto-fit, minmax(350px, 1fr))',
  			// تحسين للشاشات الصغيرة - تقليل الحد الأدنى للعرض
  			'auto-fit-cards': 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))',
  			'auto-fit-stats': 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))',
  		},
  		// إضافة أحجام متجاوبة
  		fontSize: {
  			'responsive-xs': 'clamp(0.625rem, 1.5vw, 0.75rem)',
  			'responsive-sm': 'clamp(0.75rem, 2vw, 0.875rem)',
  			'responsive-base': 'clamp(0.875rem, 2.5vw, 1rem)',
  			'responsive-lg': 'clamp(1rem, 3vw, 1.125rem)',
  			'responsive-xl': 'clamp(1.125rem, 3.5vw, 1.25rem)',
  		},
  		spacing: {
  			'responsive-1': 'clamp(0.25rem, 1vw, 0.5rem)',
  			'responsive-2': 'clamp(0.5rem, 1.5vw, 0.75rem)',
  			'responsive-3': 'clamp(0.75rem, 2vw, 1rem)',
  			'responsive-4': 'clamp(1rem, 2.5vw, 1.5rem)',
  		},
  		// إضافة breakpoints مخصصة للشاشات الصغيرة جداً
  		screens: {
  			'xs': '320px',
  			'sm': '640px',
  			'md': '768px',
  			'lg': '1024px',
  			'xl': '1280px',
  			'2xl': '1536px',
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
