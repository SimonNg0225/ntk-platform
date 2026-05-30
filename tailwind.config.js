/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // 主題色由 CSS 變數提供，會隨「學習 / 工作」模式而變
        accent: 'var(--accent)',
        'accent-soft': 'var(--accent-soft)',
        'accent-strong': 'var(--accent-strong)',
        // 介面表面色（深色模式自動切換）
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
      },
      fontFamily: {
        sans: [
          '"Noto Sans HK"',
          'system-ui',
          '-apple-system',
          '"PingFang HK"',
          '"Microsoft JhengHei"',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}
