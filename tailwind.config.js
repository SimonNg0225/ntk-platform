/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // 既有（不可改名/移除，全站功能靠 bg-accent/bg-surface…）
        accent: 'var(--accent)',
        'accent-soft': 'var(--accent-soft)',
        'accent-strong': 'var(--accent-strong)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        // 新增 token
        'surface-3': 'var(--surface-3)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        fg: 'var(--text)',
        'fg-secondary': 'var(--text-secondary)',
        'fg-muted': 'var(--text-muted)',
        'fg-inverse': 'var(--text-inverse)',
      },
      fontFamily: {
        // Inter 排第一（拉丁/數字），中文落 Noto / 系統字
        sans: [
          'Inter',
          '"Noto Sans HK"',
          'system-ui',
          '-apple-system',
          '"PingFang HK"',
          '"Microsoft JhengHei"',
          '"Segoe UI"',
          'sans-serif',
        ],
        mono: ['ui-monospace', '"SF Mono"', 'Menlo', 'monospace'],
        // Fraunces：文學感 serif，目前只有個人日誌用（masthead / 日期 / 標題 / 大數字）。
        serif: ['Fraunces', 'Georgia', '"Times New Roman"', 'serif'],
      },
      fontSize: {
        '2xs': ['var(--fs-2xs)', { lineHeight: 'var(--lh-2xs)' }],
        xs: ['var(--fs-xs)', { lineHeight: 'var(--lh-xs)' }],
        sm: ['var(--fs-sm)', { lineHeight: 'var(--lh-sm)' }],
        base: ['var(--fs-base)', { lineHeight: 'var(--lh-base)' }],
        lg: ['var(--fs-lg)', { lineHeight: 'var(--lh-lg)' }],
        xl: ['var(--fs-xl)', { lineHeight: 'var(--lh-xl)' }],
        '2xl': ['var(--fs-2xl)', { lineHeight: 'var(--lh-2xl)' }],
        '3xl': ['var(--fs-3xl)', { lineHeight: 'var(--lh-3xl)' }],
      },
      borderRadius: {
        // 收細：殘留嘅舊 rounded-2xl/3xl 自動專業化
        lg: '10px',
        xl: '12px',
        '2xl': '14px',
        '3xl': '16px',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        overlay: 'var(--shadow-overlay)',
      },
      borderColor: { DEFAULT: 'var(--border)' },
      ringColor: { DEFAULT: 'var(--ring)' },
    },
  },
  plugins: [],
}
