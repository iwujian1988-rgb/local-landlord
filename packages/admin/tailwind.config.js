/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: '#FDF8F3',
        accent: '#F5D78E',
        accentDk: '#E8C77D',
        accentSoft: '#FDF2E0',
        textPrimary: '#4A4038',
        textSecondary: '#8B7E74',
        textHint: '#B5A99A',
        success: '#7BA37B',
        warning: '#E8B87D',
        error: '#C97B7B',
      },
      fontFamily: {
        sans: [
          "'Noto Sans SC'",
          "'PingFang SC'",
          "'Hiragino Sans GB'",
          'sans-serif',
        ],
      },
      fontSize: {
        xs: '13px',
        sm: '15px',
        base: '17px',
        lg: '20px',
        xl: '24px',
        '2xl': '28px',
        '3xl': '36px',
      },
      borderRadius: {
        DEFAULT: '12px',
        lg: '20px',
        xl: '28px',
        full: '999px',
      },
      boxShadow: {
        soft: '0 4px 24px rgba(74, 64, 56, 0.08)',
        card: '0 8px 32px rgba(74, 64, 56, 0.12)',
      },
    },
  },
  plugins: [],
}
