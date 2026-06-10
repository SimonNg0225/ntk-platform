// 一小批通用教學插圖（內聯 SVG → data URL）；風格中性、適配各 theme。
// 之後可逐步擴充；用 encodeURIComponent 包成 utf8 data URL（HTML <img> 同 PptxGenJS 都食到）。

interface Illustration { id: string; label: string; src: string }

const svg = (inner: string): string =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`,
  )

export const BUILTIN_ILLUSTRATIONS: Illustration[] = [
  { id: 'book', label: '書本', src: svg('<path d="M20 28h32a8 8 0 0 1 8 8v60a8 8 0 0 0-8-8H20z"/><path d="M100 28H68a8 8 0 0 0-8 8v60a8 8 0 0 1 8-8h32z"/>') },
  { id: 'bulb', label: '燈泡', src: svg('<path d="M46 86a26 26 0 1 1 28 0c-4 3-6 7-6 12H52c0-5-2-9-6-12z"/><path d="M52 104h16M54 96h12"/>') },
  { id: 'chart', label: '圖表', src: svg('<path d="M24 24v72h72"/><path d="M40 80V60M58 80V44M76 80V52M94 80V36"/>') },
  { id: 'target', label: '目標', src: svg('<circle cx="60" cy="60" r="36"/><circle cx="60" cy="60" r="20"/><circle cx="60" cy="60" r="5" fill="currentColor"/>') },
  { id: 'chat', label: '對話', src: svg('<path d="M24 32h72v48H56L40 96V80H24z"/><path d="M40 50h40M40 62h28"/>') },
  { id: 'gear', label: '齒輪', src: svg('<circle cx="60" cy="60" r="16"/><path d="M60 20v12M60 88v12M20 60h12M88 60h12M32 32l8 8M80 80l8 8M88 32l-8 8M40 80l-8 8"/>') },
]
