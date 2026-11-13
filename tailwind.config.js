/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm ivory / white palette
        canvas: {
          DEFAULT: '#FAF8F5',
          subtle: '#F4F0E8',
          card: '#FFFFFF',
          sunken: '#EDE8DD',
        },
        // Charcoal typography
        charcoal: {
          DEFAULT: '#1E2328',
          muted: '#5A626A',
          subtle: '#8C95A0',
          dark: '#14181B',
        },
        // Muted Sage / Mint accent
        sage: {
          DEFAULT: '#5E7A68',
          hover: '#4C6555',
          active: '#3E5346',
          light: '#EBF1ED',
          border: '#C4D5CA',
          badge: '#D8E5DC',
        },
        // Neutral borders
        border: {
          DEFAULT: '#E5E0D6',
          subtle: '#EDE8DF',
          strong: '#C9C2B4',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        serif: [
          '"Playfair Display"',
          'Georgia',
          'serif',
        ],
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      boxShadow: {
        'subtle': '0 1px 3px 0 rgba(30, 35, 40, 0.04), 0 1px 2px -1px rgba(30, 35, 40, 0.03)',
        'card': '0 2px 8px -2px rgba(30, 35, 40, 0.06), 0 1px 4px -1px rgba(30, 35, 40, 0.04)',
        'modal': '0 8px 30px -4px rgba(30, 35, 40, 0.12)',
      },
      minHeight: {
        'touch': '48px',
      },
      minWidth: {
        'touch': '48px',
      },
    },
  },
  plugins: [],
};

