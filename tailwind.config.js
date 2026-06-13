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
        // 襯線（行銷首頁標題 / 作業簿風）：拉丁 Fraunces，中文 Noto Serif HK
        serif: ['Fraunces', '"Noto Serif HK"', 'Georgia', '"Songti TC"', 'serif'],
        mono: ['ui-monospace', '"SF Mono"', 'Menlo', 'monospace'],
      },
      fontSize: {
        // Apple / SF Pro 風字距：字越大、負字距越多（招牌 tight tracking）。
        // 細字（2xs/xs/sm）保持 0，太細加負字距反而難讀。
        '2xs': ['var(--fs-2xs)', { lineHeight: 'var(--lh-2xs)' }],
        xs: ['var(--fs-xs)', { lineHeight: 'var(--lh-xs)' }],
        sm: ['var(--fs-sm)', { lineHeight: 'var(--lh-sm)' }],
        base: ['var(--fs-base)', { lineHeight: 'var(--lh-base)', letterSpacing: '-0.006em' }],
        lg: ['var(--fs-lg)', { lineHeight: 'var(--lh-lg)', letterSpacing: '-0.011em' }],
        xl: ['var(--fs-xl)', { lineHeight: 'var(--lh-xl)', letterSpacing: '-0.015em' }],
        '2xl': ['var(--fs-2xl)', { lineHeight: 'var(--lh-2xl)', letterSpacing: '-0.019em' }],
        '3xl': ['var(--fs-3xl)', { lineHeight: 'var(--lh-3xl)', letterSpacing: '-0.022em' }],
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
