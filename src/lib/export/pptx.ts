import type { Deck, Slide } from './types'
import { safeFilename } from './file'

// ============================================================
//  匯出 PowerPoint (.pptx) — 專業模板級（純 code、零成本）
//  ------------------------------------------------------------
//  · 3 個主題（配色）：海軍藍商務 / 學術綠 / 暖橙
//  · Slide master：頂部 accent 色條 + 頁尾品牌 + 頁碼
//  · 版式模板：封面 / 章節分隔（無列點嗰版）/ 標題 + 列點
//  · icons：lucide 風單線 SVG + 染色磚，按標題關鍵字自動配
//  · 中文由 PowerPoint 字體處理，無需嵌字型
//  動態 import pptxgenjs，唔拖慢首屏。
// ============================================================

export type SlideThemeId = 'navy' | 'academic' | 'warm'

export const SLIDE_THEMES: { id: SlideThemeId; name: string; swatch: string }[] = [
  { id: 'navy', name: '海軍藍商務', swatch: '#4F46E5' },
  { id: 'academic', name: '學術綠', swatch: '#0D9488' },
  { id: 'warm', name: '暖橙', swatch: '#EA580C' },
]

interface Theme {
  bg: string // 內容版底色
  coverBg: string // 封面 / 章節 深底
  accent: string
  accentDark: string
  ink: string // 主文字
  inkSoft: string // 次文字
  onDark: string // 深底上文字
  hair: string // 分隔線
}

const THEME: Record<SlideThemeId, Theme> = {
  navy: { bg: 'FFFFFF', coverBg: '111827', accent: '4F46E5', accentDark: '3730A3', ink: '1E293B', inkSoft: '64748B', onDark: 'FFFFFF', hair: 'E2E8F0' },
  academic: { bg: 'FFFFFF', coverBg: '0F3D38', accent: '0D9488', accentDark: '0F766E', ink: '1E293B', inkSoft: '64748B', onDark: 'FFFFFF', hair: 'E2E8F0' },
  warm: { bg: 'FFFDFB', coverBg: '7C2D12', accent: 'EA580C', accentDark: 'C2410C', ink: '292524', inkSoft: '78716C', onDark: 'FFFFFF', hair: 'EEE7E1' },
}

// ───────── lucide 風單線 icon（白色，放喺 accent 染色磚上）─────────
const ICON_INNER: Record<string, string> = {
  intro: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5l5 3.5-5 3.5z"/>',
  concept: '<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5.9 1.3 1 2.1h5a3.7 3.7 0 0 1 1-2.1A6 6 0 0 0 12 3z"/>',
  example: '<path d="M12 7c-1.8-1.3-4.5-1.3-6.5 0v11c2-1.3 4.7-1.3 6.5 0 1.8-1.3 4.5-1.3 6.5 0V7c-2-1.3-4.7-1.3-6.5 0z"/><path d="M12 7v11"/>',
  practice: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 12.5l2.5 2.5 4.5-5.5"/>',
  summary: '<path d="M10 6h10"/><path d="M10 12h10"/><path d="M10 18h10"/><path d="M4 6l1.2 1.2L7.5 5"/><path d="M4 12l1.2 1.2L7.5 11"/><path d="M4 18l1.2 1.2L7.5 17"/>',
  data: '<path d="M4 19V5"/><path d="M4 19h16"/><rect x="7" y="11" width="3" height="5"/><rect x="12" y="8" width="3" height="8"/><rect x="17" y="6" width="3" height="10"/>',
  default: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v4l2.5 2"/>',
}

function iconUri(key: string): string {
  const inner = ICON_INNER[key] ?? ICON_INNER.default
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`
  const b64 = typeof btoa === 'function' ? btoa(svg) : Buffer.from(svg).toString('base64')
  return 'data:image/svg+xml;base64,' + b64
}

// 按標題關鍵字揀 icon（教學邏輯：導入→概念→例子→練習→總結）
function pickIcon(title: string, i: number): string {
  const t = title
  if (/導入|引入|簡介|概覽|目標|開始/.test(t)) return 'intro'
  if (/概念|定義|原理|理論|是甚麼|乜嘢|重點/.test(t)) return 'concept'
  if (/例子|個案|案例|示範|應用|情境/.test(t)) return 'example'
  if (/練習|活動|試做|問題|思考|討論/.test(t)) return 'practice'
  if (/總結|重溫|回顧|小結|結論|延伸/.test(t)) return 'summary'
  if (/數據|圖表|統計|趨勢|比較|數字/.test(t)) return 'data'
  const cycle = ['intro', 'concept', 'example', 'practice', 'summary']
  return cycle[i % cycle.length]
}

const BRAND = 'EziTeach · 教學易'

export async function downloadPptx(
  deck: Deck,
  name?: string,
  themeId: SlideThemeId = 'navy',
  coverPhoto?: { dataUri: string; credit: string },
): Promise<void> {
  const PptxGenJS = (await import('pptxgenjs')).default
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE' // 16:9 = 13.33 x 7.5 in
  const t = THEME[themeId] ?? THEME.navy

  // ── slide master：內容版統一裝飾（頂部色條 + 頁尾品牌 + 頁碼）──
  pptx.defineSlideMaster({
    title: 'CONTENT',
    background: { color: t.bg },
    objects: [
      { rect: { x: 0, y: 0, w: '100%', h: 0.14, fill: { color: t.accent } } },
      { text: { text: BRAND, options: { x: 0.5, y: 7.04, w: 6, h: 0.32, fontSize: 9, color: t.inkSoft } } },
    ],
    slideNumber: { x: 12.4, y: 7.04, w: 0.6, h: 0.32, fontSize: 9, color: t.inkSoft, align: 'right' },
  })

  // ── 封面 ──
  const cover = pptx.addSlide()
  cover.background = { color: t.coverBg }
  if (coverPhoto?.dataUri) {
    // 全幅相片 + 深色 scrim（保白字可讀）
    cover.addImage({ data: coverPhoto.dataUri, x: 0, y: 0, w: 13.33, h: 7.5, sizing: { type: 'cover', w: 13.33, h: 7.5 } })
    cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 7.5, fill: { color: t.coverBg, transparency: 42 } })
  }
  cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.28, h: 7.5, fill: { color: t.accent } })
  cover.addShape(pptx.ShapeType.rect, { x: 1.0, y: 2.55, w: 1.1, h: 0.13, fill: { color: t.accent } })
  cover.addText('教學簡報', { x: 1.0, y: 1.7, w: 11, h: 0.5, fontSize: 14, color: t.accent, charSpacing: 3, bold: true })
  cover.addText(deck.title, { x: 0.95, y: 2.85, w: 11.4, h: 1.8, fontSize: 40, bold: true, color: t.onDark, valign: 'top', lineSpacingMultiple: 1.02 })
  if (deck.subtitle) {
    cover.addText(deck.subtitle, { x: 1.0, y: 4.7, w: 11, h: 0.8, fontSize: 20, color: 'CBD5E1' })
  }
  cover.addText(BRAND, { x: 1.0, y: 6.7, w: 8, h: 0.4, fontSize: 11, color: '94A3B8' })
  if (coverPhoto?.credit) {
    cover.addText(coverPhoto.credit, { x: 7.0, y: 7.04, w: 6.0, h: 0.3, fontSize: 8, color: 'CBD5E1', align: 'right' })
  }

  // ── 內容 / 章節 ──
  deck.slides.forEach((s: Slide, i: number) => {
    const isSection = s.bullets.length === 0
    if (isSection) {
      const sec = pptx.addSlide()
      sec.background = { color: t.coverBg }
      sec.addText(String(i + 1).padStart(2, '0'), { x: 0.9, y: 1.5, w: 5, h: 2.6, fontSize: 120, bold: true, color: t.accent, transparency: 35 })
      sec.addShape(pptx.ShapeType.rect, { x: 1.0, y: 4.0, w: 0.9, h: 0.12, fill: { color: t.accent } })
      sec.addText(s.title, { x: 1.0, y: 4.25, w: 11, h: 1.4, fontSize: 34, bold: true, color: t.onDark, valign: 'top' })
      if (s.notes) sec.addNotes(s.notes)
      return
    }

    const slide = pptx.addSlide({ masterName: 'CONTENT' })
    // icon 染色磚
    slide.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 0.5, w: 0.72, h: 0.72, fill: { color: t.accent }, rectRadius: 0.1, line: { type: 'none' } })
    slide.addImage({ data: iconUri(pickIcon(s.title, i)), x: 0.66, y: 0.66, w: 0.4, h: 0.4 })
    // 標題
    slide.addText(s.title, { x: 1.45, y: 0.5, w: 11.3, h: 0.78, fontSize: 26, bold: true, color: t.accentDark, valign: 'middle' })
    // header 分隔線
    slide.addShape(pptx.ShapeType.line, { x: 0.5, y: 1.5, w: 12.33, h: 0, line: { color: t.hair, width: 1 } })
    // 左側 accent 直紋
    slide.addShape(pptx.ShapeType.rect, { x: 0.62, y: 1.95, w: 0.06, h: Math.min(4.7, 0.62 * s.bullets.length + 0.4), fill: { color: t.accent } })
    // 列點
    slide.addText(
      s.bullets.map((b) => ({
        text: b,
        options: { bullet: { code: '25AA', indent: 16 }, breakLine: true, paraSpaceAfter: 10 },
      })),
      { x: 1.0, y: 1.9, w: s.chart ? 5.4 : 11.6, h: 4.9, fontSize: 18, color: t.ink, valign: 'top', lineSpacingMultiple: 1.18 },
    )
    // 圖表（選填）— 右半版（addChart，零成本）
    if (s.chart) {
      const ch = s.chart
      const colors = [t.accent, t.accentDark, '94A3B8', 'A5B4FC', 'CBD5E1']
      if (ch.type === 'pie') {
        slide.addChart(
          pptx.ChartType.pie,
          [{ name: ch.series[0].name, labels: ch.categories, values: ch.series[0].values }],
          { x: 6.9, y: 1.95, w: 5.9, h: 4.4, chartColors: colors, showLegend: true, legendPos: 'r', legendFontSize: 9, showPercent: true, dataLabelColor: 'FFFFFF', dataLabelFontSize: 9 },
        )
      } else {
        slide.addChart(
          ch.type === 'line' ? pptx.ChartType.line : pptx.ChartType.bar,
          ch.series.map((se) => ({ name: se.name, labels: ch.categories, values: se.values })),
          { x: 6.9, y: 1.95, w: 5.9, h: 4.4, chartColors: colors, showLegend: ch.series.length > 1, legendPos: 'b', legendFontSize: 9, catAxisLabelColor: t.inkSoft, valAxisLabelColor: t.inkSoft, catAxisLabelFontSize: 9, valAxisLabelFontSize: 9, barDir: 'col', showValue: false },
        )
      }
    }
    if (s.notes) slide.addNotes(s.notes)
  })

  await pptx.writeFile({ fileName: safeFilename(name ?? deck.title, 'pptx') })
}
