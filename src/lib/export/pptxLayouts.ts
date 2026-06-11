// ============================================================
//  pptx 版式 renderer — 6 款內容版式（pack-agnostic，只問 pack 攞 tokens）
//  ------------------------------------------------------------
//  · bullets — row 引擎：每點 = pack marker + 獨立 text box（嚴禁 bullet API）
//  · stats   — 2-4 個大數字 tile
//  · compare — 兩欄對比（髮線／tint 卡／浮面板／A·B 網格）
//  · steps   — 2-4 步橫排 / 5 步直排 timeline
//  · quote   — 大引文 + pack 引號裝飾
//  · section — 由 pack.section() 處理（pptx.ts dispatch）
//  行高 = pt × 1.32 / 72；row 推進用 estimateLines，寧鬆勿迫，
//  超估自動降一級 pt（唔俾爆框，fit:'shrink' 只做最後兜底）。
// ============================================================

import type PptxGenJS from 'pptxgenjs'
import type { Slide, SlideChart } from './types'
import { estimateLines, lineHeightIn, mix, clampText } from './pptxText'
import {
  FONT,
  tx,
  hline,
  vline,
  addCoverImage,
  photoCreditOnImage,
  type Pack,
  type Rect,
  type SlideImage,
} from './pptxPacks'

// ───────── row 引擎 ─────────

interface RowOpts {
  x: number
  y: number
  w: number
  maxY: number
  pt: number
  gap: number
  color: string
  /** 序號 marker 起始編號（compare 兩欄各自由 1 數起） */
  startNo?: number
}

/** 估算一組 row 嘅總高（行高 + 間距），用嚟揀字級 */
function rowsHeight(items: string[], pt: number, gap: number, textW: number): number {
  const lineH = lineHeightIn(pt)
  const linesTotal = items.reduce((acc, t) => acc + estimateLines(t, pt, textW), 0)
  return linesTotal * lineH + Math.max(0, items.length - 1) * gap
}

/** 超估自動降級：總高超出可用高就減 pt（下限 13）兼收緊 gap（下限 0.16） */
function fitRowsPt(items: string[], basePt: number, baseGap: number, w: number, indent: number, maxH: number): { pt: number; gap: number } {
  let pt = basePt
  let gap = baseGap
  while (rowsHeight(items, pt, gap, w - indent) > maxH && pt > 13) {
    pt -= 1
    gap = Math.max(0.16, gap - 0.04)
  }
  return { pt, gap }
}

/** 手砌列點：marker 同內文分開擺，marker 對齊首行視覺中心 */
function drawRows(slide: PptxGenJS.Slide, pack: Pack, items: string[], o: RowOpts): number {
  const m = pack.marker
  const indent = m.indent
  const lineH = lineHeightIn(o.pt)
  let y = o.y
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const lines = estimateLines(item, o.pt, o.w - indent)
    const h = lines * lineH
    if (y + h > o.maxY + 0.05) break // 防爆框（fitRowsPt 已盡量避免行到呢度）
    if (m.kind === 'number') {
      tx(slide, `${(o.startNo ?? 1) + i}.`, {
        x: o.x,
        y,
        w: indent - 0.08,
        h: lineH,
        fontSize: o.pt,
        color: m.color,
        fontFace: pack.displayFont,
        italic: pack.displayItalic,
      })
    } else if (m.kind === 'dash') {
      tx(slide, '—', { x: o.x, y, w: indent - 0.06, h: lineH, fontSize: o.pt, color: m.color, bold: true })
    } else if (m.kind === 'circle') {
      slide.addShape('ellipse', {
        x: o.x + 0.02,
        y: y + (lineH - m.size) / 2,
        w: m.size,
        h: m.size,
        fill: { type: 'none' },
        line: { color: m.color, width: m.linePt },
      })
    } else if (m.kind === 'roundSquare') {
      slide.addShape('roundRect', {
        x: o.x + 0.02,
        y: y + (lineH - m.size) / 2,
        w: m.size,
        h: m.size,
        rectRadius: m.radius,
        fill: { color: m.color },
        line: { type: 'none' },
      })
    } else if (m.kind === 'dot') {
      slide.addShape('ellipse', {
        x: o.x + 0.02,
        y: y + (lineH - m.size) / 2,
        w: m.size,
        h: m.size,
        fill: { color: m.color },
        line: { type: 'none' },
      })
    } else if (m.kind === 'triangle') {
      // ▶ 指向右（pptxgenjs triangle 默認向上，轉 90°）
      slide.addShape('triangle', {
        x: o.x + 0.02,
        y: y + (lineH - m.size) / 2,
        w: m.size,
        h: m.size,
        rotate: 90,
        fill: { color: m.color },
        line: { type: 'none' },
      })
    } else {
      slide.addShape('rect', {
        x: o.x + 0.02,
        y: y + (lineH - m.size) / 2,
        w: m.size,
        h: m.size,
        fill: { color: m.color },
        line: { type: 'none' },
      })
    }
    tx(slide, item, {
      x: o.x + indent,
      y,
      w: o.w - indent,
      h: h + 0.04,
      fontSize: o.pt,
      color: o.color,
      lineSpacingMultiple: 1.32,
      fit: 'shrink',
    })
    y += h + o.gap
  }
  return y
}

// ───────── chart 面板（bullets 版右欄）─────────

function renderChartPanel(slide: PptxGenJS.Slide, pack: Pack, chart: SlideChart, body: Rect): void {
  const rect: Rect = { x: 6.6, y: body.y - 0.05, w: 5.85, h: body.h + 0.05 }
  if (chart.type === 'pie') {
    slide.addChart('pie', [{ name: chart.series[0]?.name ?? '系列', labels: chart.categories, values: chart.series[0]?.values ?? [] }], {
      x: rect.x,
      y: rect.y,
      w: rect.w,
      h: rect.h,
      chartColors: pack.chartColors,
      chartArea: { roundedCorners: false },
      showLegend: true,
      legendPos: 'r',
      legendFontSize: 10,
      legendColor: pack.ink, // QA：inkSoft 喺深底 pack 讀唔到
      legendFontFace: FONT,
      showPercent: true,
      // label 拉出扇形外（落喺版底色上），用 pack 主文字色 — 淺色扇形白字隱形嘅問題一次過解決
      dataLabelPosition: 'outEnd',
      dataLabelColor: pack.ink,
      dataLabelFontSize: 10,
      dataLabelFontFace: FONT,
    })
  } else {
    slide.addChart(
      chart.type === 'line' ? 'line' : 'bar',
      chart.series.map((se) => ({ name: se.name, labels: chart.categories, values: se.values })),
      {
        x: rect.x,
        y: rect.y,
        w: rect.w,
        h: rect.h,
        chartColors: pack.chartColors,
        chartArea: { roundedCorners: false },
        barDir: 'col',
        barGapWidthPct: 120,
        catAxisLabelColor: pack.inkSoft,
        valAxisLabelColor: pack.inkSoft,
        catAxisLabelFontSize: 9,
        valAxisLabelFontSize: 9,
        catAxisLabelFontFace: FONT,
        valAxisLabelFontFace: FONT,
        catAxisLineColor: pack.chartGridColor,
        // 單位直接寫入 y 軸刻度（例 80%），唔好做孤兒浮字
        ...(chart.unit ? { valAxisLabelFormatCode: `General"${chart.unit.replace(/"/g, '')}"` } : {}),
        valGridLine: { style: 'solid', color: pack.chartGridColor, size: 0.5 },
        catGridLine: { style: 'none' },
        showLegend: chart.series.length > 1,
        legendPos: 'b',
        legendFontSize: 9,
        legendColor: pack.inkSoft,
        legendFontFace: FONT,
        showValue: false,
      },
    )
  }
}

// ───────── 相片面板（split 配圖版右欄，per-pack 形態）─────────

function renderPhotoPanel(slide: PptxGenJS.Slide, pack: Pack, photo: SlideImage): void {
  if (pack.splitPhoto === 'circle') {
    // 青瓷：圓相嵌白底（唔 full-bleed），署名喺圓相下方
    addCoverImage(slide, photo, { x: 8.15, y: 1.3, w: 4.9, h: 4.9 }, true)
    tx(slide, photo.credit, { x: 8.15, y: 6.32, w: 4.9, h: 0.26, fontSize: 8, color: pack.faint, align: 'center' })
    return
  }
  const frame: Rect = { x: 7.9, y: 0, w: 5.43, h: 7.5 }
  addCoverImage(slide, photo, frame)
  if (pack.splitPhoto === 'bleedHair') {
    vline(slide, 7.9, 0, 7.5, pack.hair)
  } else if (pack.splitPhoto === 'bleedScrim') {
    // 夜讀：深底 scrim 統一暗調（shape fill transparency 正常 work）
    slide.addShape('rect', { x: frame.x, y: frame.y, w: frame.w, h: frame.h, fill: { color: pack.bg, transparency: 35 }, line: { type: 'none' } })
  } else if (pack.splitPhoto === 'bleedMotif') {
    // 騎縫 accent 圓角方 motif — 貼住版底先似出血，半天吊會似跌咗嘢
    slide.addShape('roundRect', { x: 7.45, y: 6.68, w: 0.9, h: 0.82, rectRadius: 0.12, fill: { color: pack.accent }, line: { type: 'none' } })
  }
  photoCreditOnImage(slide, photo.credit, frame)
}

// ───────── bullets（預設 + chart / 配圖 變奏）─────────

/** 版面節奏：兩欄列點（同款 bullets 連續版輪替用，破單欄重複感） */
function renderBulletsTwoCol(slide: PptxGenJS.Slide, body: Rect, pack: Pack, bullets: string[]): void {
  const colW = (body.w - 0.5) / 2
  const half = Math.ceil(bullets.length / 2)
  const cols = [bullets.slice(0, half), bullets.slice(half)]
  cols.forEach((col, i) => {
    const x = body.x + i * (colW + 0.5)
    const { pt, gap } = fitRowsPt(col, 16, 0.2, colW, pack.marker.indent, body.h - 0.1)
    drawRows(slide, pack, col, { x, y: body.y + 0.1, w: colW, maxY: body.y + body.h, pt, gap, color: pack.ink, startNo: i === 0 ? 1 : half + 1 })
  })
}

/** 版面節奏：大首點 lede（accent 短線 + 首點放大）+ 其餘列點 */
function renderBulletsLede(slide: PptxGenJS.Slide, body: Rect, pack: Pack, bullets: string[]): void {
  const lede = bullets[0].trim()
  const rest = bullets.slice(1)
  const ledePt = 20
  const ledeLines = Math.min(2, estimateLines(lede, ledePt, body.w))
  const ledeH = ledeLines * lineHeightIn(ledePt)
  hline(slide, body.x, body.y + 0.08, 0.7, pack.accent, 2.5)
  tx(slide, lede, { x: body.x, y: body.y + 0.22, w: body.w, h: ledeH + 0.12, fontSize: ledePt, bold: true, color: pack.ink, lineSpacingMultiple: 1.15, fit: 'shrink' })
  if (rest.length === 0) return
  const restY = body.y + 0.22 + ledeH + 0.34
  const { pt, gap } = fitRowsPt(rest, 15, 0.18, body.w, pack.marker.indent, body.y + body.h - restY)
  drawRows(slide, pack, rest, { x: body.x, y: restY, w: body.w, maxY: body.y + body.h, pt, gap, color: pack.ink, startNo: 2 })
}

export function renderBullets(slide: PptxGenJS.Slide, body: Rect, pack: Pack, s: Slide, photo?: SlideImage, seq = 0): void {
  const bullets = s.bullets ?? []
  const hasChart = Boolean(s.chart)
  const hasPhoto = Boolean(photo) && !hasChart // chart 優先（spec §5.2）
  if (hasPhoto && photo) renderPhotoPanel(slide, pack, photo)

  const n = bullets.length
  if (n === 0) return

  // >6 點（AI 走樣）→ 對半兩欄
  if (n > 6) {
    const colW = (body.w - 0.4) / 2
    const half = Math.ceil(n / 2)
    const cols = [bullets.slice(0, half), bullets.slice(half)]
    cols.forEach((col, i) => {
      const x = body.x + i * (colW + 0.4)
      const { pt, gap } = fitRowsPt(col, 14, 0.16, colW, pack.marker.indent, body.h)
      drawRows(slide, pack, col, { x, y: body.y, w: colW, maxY: body.y + body.h, pt, gap, color: pack.ink, startNo: i === 0 ? 1 : half + 1 })
    })
    return
  }

  // 版面節奏：同款 bullets 連續版輪替構圖（v=seq%3），破除一頁跟一頁太似。
  // chart／配相版維持單欄（佈局已被佔用）。
  if (!hasChart && !hasPhoto) {
    const v = seq % 3
    if (v === 2 && n >= 4) {
      renderBulletsTwoCol(slide, body, pack, bullets)
      return
    }
    if (v === 1 && n >= 3) {
      renderBulletsLede(slide, body, pack, bullets)
      return
    }
  }

  // 字級／間距自適應：點少 → 大字鬆排，點多 → 收緊
  const ladder = pack.bulletPt[Math.min(Math.max(n, 2), 6) - 2]
  const sparse = n <= 3 && !hasChart && !hasPhoto // ≤3 點都算疏（QA：頂置下半空似漏嘢）
  let basePt = n <= 2 && sparse ? Math.min(22, ladder + 2) : ladder // 2 點先加大一檔
  const baseGap = n <= 2 ? 0.4 : n === 3 ? 0.28 : n === 4 ? 0.22 : n === 5 ? 0.18 : 0.16
  let textW = body.w
  if (hasChart) {
    textW = Math.min(5.2, body.w)
    basePt = Math.min(basePt, 15)
  } else if (hasPhoto) {
    basePt = Math.min(basePt, 16)
  }
  // 起始 y：4 點微調，5-6 點頂住起；疏版用光學中心（中線偏上）俾個版有錨點
  let startY = body.y + (n <= 2 ? 0.4 : n <= 4 ? 0.05 : 0)
  const { pt, gap } = fitRowsPt(bullets, basePt, baseGap, textW, pack.marker.indent, body.y + body.h - startY)
  if (sparse) {
    const blockH = rowsHeight(bullets, pt, gap, textW - pack.marker.indent)
    const factor = n <= 2 ? 0.34 : 0.2 // 3 點輕推就夠，唔好變咗死板置中
    startY = body.y + Math.min(1.6, Math.max(0.3, (body.h - blockH) * factor))
  }
  drawRows(slide, pack, bullets, { x: body.x, y: startY, w: textW, maxY: body.y + body.h, pt, gap, color: pack.ink })

  if (hasChart && s.chart) renderChartPanel(slide, pack, s.chart, body)
}

// ───────── stats（2-4 個大數字 tile）─────────

/**
 * stat value 專用字級：display 字體（Georgia italic / Arial bold）嘅 latin 闊過內文，
 * 用獨立系數（latin 0.7em / CJK 1.05em，總係數 1.08）保證單行收得落。
 */
function statValuePt(value: string, availW: number): number {
  let em = 0
  for (const ch of value) em += (ch.codePointAt(0) ?? 0) <= 0xff ? 0.7 : 1.05
  for (const pt of [44, 40, 36, 32, 28, 24, 22, 20]) {
    if (((em * pt) / 72) * 1.08 <= availW) return pt
  }
  return 20
}

export function renderStats(slide: PptxGenJS.Slide, body: Rect, pack: Pack, s: Slide): void {
  const items = (s.stats ?? []).slice(0, 4)
  if (items.length < 2) return
  const n = items.length
  const gutter = 0.2
  const colW = (body.w - gutter * (n - 1)) / n
  const top = body.y + 0.2
  const tileH = 2.5 // 收矮卡身：QA 一致投訴 2.9 下半截齊齊吉

  if (pack.tileStyle === 'whiteOnTint') {
    // 曙光：tint 大底 + 每項白卡
    slide.addShape('roundRect', {
      x: body.x - 0.05,
      y: top - 0.15,
      w: body.w + 0.1,
      h: tileH + 0.4,
      rectRadius: 0.12,
      fill: { color: pack.panel },
      line: { type: 'none' },
    })
  }

  // 全行統一字級（以最長 value 為準）+ 共同 baseline — 四格大細高低一致
  const insetAll = pack.tileStyle === 'hairline' ? 0.05 : pack.tileStyle === 'whiteOnTint' ? 0.34 : 0.25
  const values = items.map((st) => clampText(st.value.trim(), 10))
  const uniformPt = Math.min(...values.map((v) => statValuePt(v, colW - insetAll * 2)))

  items.forEach((st, i) => {
    const tileX = body.x + i * (colW + gutter)
    if (pack.tileStyle === 'tintCard') {
      slide.addShape('roundRect', { x: tileX, y: top, w: colW, h: tileH, rectRadius: pack.cardRadius, fill: { color: pack.panel }, line: { type: 'none' } })
    } else if (pack.tileStyle === 'panel') {
      slide.addShape('roundRect', { x: tileX, y: top, w: colW, h: tileH, rectRadius: pack.cardRadius, fill: { color: pack.panel }, line: { type: 'none' } })
    } else if (pack.tileStyle === 'cellBorder') {
      slide.addShape('rect', { x: tileX, y: top, w: colW, h: tileH, fill: { type: 'none' }, line: { color: pack.hair, width: 0.75 } })
    } else if (pack.tileStyle === 'whiteOnTint') {
      slide.addShape('roundRect', {
        x: tileX + 0.1,
        y: top + 0.05,
        w: colW - 0.2,
        h: tileH - 0.1,
        rectRadius: 0.12,
        fill: { color: 'FFFFFF' },
        line: { type: 'none' },
        shadow: { type: 'outer', color: pack.ink, opacity: 0.12, blur: 8, offset: 2, angle: 90 },
      })
    }
    const inset = insetAll
    tx(slide, values[i], {
      x: tileX + inset,
      y: top + 0.3,
      w: colW - inset * 2,
      h: 0.95,
      fontSize: uniformPt,
      bold: true,
      color: pack.statColor,
      fontFace: pack.displayFont,
      italic: pack.displayItalic,
      valign: 'bottom',
      fit: 'shrink',
    })
    tx(slide, clampText(st.label.trim(), 20), {
      x: tileX + inset,
      y: top + 1.4,
      w: colW - inset * 2,
      h: 0.85,
      fontSize: 14,
      bold: true,
      color: pack.ink,
      lineSpacingMultiple: 1.25,
    })
  })

  if (pack.tileStyle === 'hairline') {
    // 墨韻／純字系：欄間直髮線
    for (let i = 1; i < n; i++) {
      vline(slide, body.x + i * (colW + gutter) - gutter / 2, top + 0.15, tileH - 0.3, pack.hair)
    }
  }

  // 下方補充行（bullets 頭 1-2 點，次文字色）
  if (s.bullets.length > 0) {
    const supY = top + tileH + 0.25
    if (supY <= 6.0) {
      const summary = clampText(s.bullets.slice(0, 2).join('　·　'), 110)
      tx(slide, summary, { x: body.x, y: supY, w: body.w, h: Math.min(0.8, 6.8 - supY), fontSize: 13, color: pack.inkSoft, lineSpacingMultiple: 1.3, fit: 'shrink' })
    }
  }
}

// ───────── compare（兩欄對比）─────────

export function renderCompare(slide: PptxGenJS.Slide, body: Rect, pack: Pack, s: Slide): void {
  const c = s.compare
  if (!c) return
  const colW = 5.5
  const leftX = body.x
  const rightX = body.x + 6.03
  const style = pack.compareStyle
  const carded = style === 'cards' || style === 'panels'
  const inset = carded ? 0.3 : 0

  if (carded) {
    // radius 0 嘅 pack 用直角 rect（roundRect + rectRadius:0 會跌返去 pptxgenjs 預設圓角）
    const shape = pack.cardRadius > 0 ? 'roundRect' : 'rect'
    const radiusOpt = pack.cardRadius > 0 ? { rectRadius: pack.cardRadius } : {}
    // 右欄可用 panelAlt 做 A/B 對照（粉彩）；缺省兩卡同色
    slide.addShape(shape, { x: leftX - 0.05, y: body.y, w: 5.6, h: body.h, ...radiusOpt, fill: { color: pack.panel }, line: { type: 'none' } })
    slide.addShape(shape, { x: rightX - 0.05, y: body.y, w: 5.6, h: body.h, ...radiusOpt, fill: { color: pack.panelAlt ?? pack.panel }, line: { type: 'none' } })
  }
  if (style === 'hairline') {
    // 墨韻：中間一條直髮線就係全部結構
    vline(slide, 6.665, body.y + 0.05, body.h - 0.35, pack.hair)
  }

  const headerY = body.y + (style === 'abGrid' ? 0.32 : 0.08)
  if (style === 'abGrid') {
    const letters: [string, number][] = [
      ['A', leftX],
      ['B', rightX],
    ]
    letters.forEach(([letter, x]) => {
      slide.addShape('rect', { x, y: body.y + 0.08, w: 0.1, h: 0.1, fill: { color: pack.accent }, line: { type: 'none' } })
      tx(slide, letter, { x: x + 0.18, y: body.y + 0.02, w: 0.6, h: 0.24, fontSize: 9, bold: true, color: pack.accent, charSpacing: 2, fontFace: pack.displayFont })
    })
  }

  const sides: { title: string; points: string[]; x: number }[] = [
    { title: c.leftTitle, points: c.left, x: leftX },
    { title: c.rightTitle, points: c.right, x: rightX },
  ]
  sides.forEach((side) => {
    tx(slide, clampText(side.title.trim(), 12), { x: side.x + inset, y: headerY, w: colW - inset * 2, h: 0.4, fontSize: 17, bold: true, color: pack.ink })
    hline(slide, side.x + inset, headerY + 0.5, colW - inset * 2, carded ? mix(pack.ink, pack.panel, 0.16) : pack.hair, 0.75, pack.structDash)
    const startY = headerY + 0.68
    const maxY = body.y + body.h - (carded ? 0.15 : 0)
    const { pt, gap } = fitRowsPt(side.points, 15, 0.2, colW - inset * 2, pack.marker.indent, maxY - startY)
    // 兩邊點數唔對稱：短嗰邊保持頂對齊，唔拉伸
    drawRows(slide, pack, side.points, { x: side.x + inset, y: startY, w: colW - inset * 2, maxY, pt, gap, color: pack.ink, startNo: 1 })
  })
}

// ───────── steps（2-4 步橫排 / 5 步直排）─────────

/** 步驟節點（pack 序號形態），cx/cy = 中心 */
function drawStepNode(slide: PptxGenJS.Slide, pack: Pack, cx: number, cy: number, no: number, scale = 1): void {
  const node = pack.stepNode
  const size = node.size * scale
  if (node.kind === 'bare') {
    // 墨韻：display 字體序號喺線上方，唔畫 shape
    tx(slide, String(no), {
      x: cx - 0.4,
      y: cy - 0.62,
      w: 0.8,
      h: 0.45,
      fontSize: Math.round(20 * scale),
      color: node.color,
      fontFace: pack.displayFont,
      italic: pack.displayItalic,
      align: 'center',
      valign: 'bottom',
    })
    return
  }
  const x = cx - size / 2
  const y = cy - size / 2
  if (node.kind === 'circleOutline') {
    slide.addShape('ellipse', { x, y, w: size, h: size, fill: { color: pack.bg }, line: { color: node.color, width: 1.5 } })
  } else if (node.kind === 'roundSquareFill') {
    slide.addShape('roundRect', { x, y, w: size, h: size, rectRadius: 0.1 * scale, fill: { color: node.color }, line: { type: 'none' } })
  } else {
    slide.addShape('rect', { x, y, w: size, h: size, fill: { color: node.color }, line: { type: 'none' } })
  }
  tx(slide, String(no), {
    x,
    y,
    w: size,
    h: size,
    fontSize: scale < 1 ? 11 : 13,
    bold: true,
    color: node.numColor,
    fontFace: pack.displayFont,
    align: 'center',
    valign: 'middle',
  })
}

export function renderSteps(slide: PptxGenJS.Slide, body: Rect, pack: Pack, s: Slide): void {
  const items = (s.steps ?? []).slice(0, 5)
  if (items.length < 2) return
  const n = items.length

  if (n <= 4) {
    // 橫排：n 等分欄 + 連接線橫貫節點中心
    const colW = body.w / n
    const lineY = body.y + 0.75
    const firstC = body.x + colW * 0.5
    const lastC = body.x + colW * (n - 0.5)
    hline(slide, firstC, lineY, lastC - firstC, pack.hair, 0.75, pack.structDash)
    items.forEach((st, i) => {
      const cx = body.x + colW * (i + 0.5)
      const colX = body.x + colW * i + 0.1
      const colTextW = colW - 0.2
      drawStepNode(slide, pack, cx, lineY, i + 1)
      const title = clampText(st.title.trim(), 14)
      const titleY = lineY + 0.5
      const titleLines = estimateLines(title, 16, colTextW)
      tx(slide, title, { x: colX, y: titleY, w: colTextW, h: titleLines * lineHeightIn(16) + 0.06, fontSize: 16, bold: true, color: pack.ink, align: 'center', lineSpacingMultiple: 1.2 })
      if (st.desc) {
        const descY = titleY + titleLines * lineHeightIn(16) + 0.12
        tx(slide, clampText(st.desc.trim(), 42), {
          x: colX,
          y: descY,
          w: colTextW,
          h: Math.max(0.3, body.y + body.h - descY - 0.1),
          fontSize: 14,
          color: pack.inkSoft,
          align: 'center',
          lineSpacingMultiple: 1.3,
          fit: 'shrink',
        })
      }
    })
    return
  }

  // 5 步：直排 timeline（rail 只去到尾節點，唔拖尾）
  // 成個區塊向中靠（縮排 + 限闊）— 全闊版面下靠死左邊會似得半版嘢
  const lineX = body.x + 1.25
  const rowH = (body.h - 0.2) / n
  const firstCy = body.y + 0.1 + 0.18
  const lastCy = body.y + 0.1 + (n - 1) * rowH + 0.18
  vline(slide, lineX, firstCy, lastCy - firstCy, pack.hair, 0.75, pack.structDash)
  const textX = lineX + 0.55
  const textW = Math.min(8.6, body.x + body.w - textX)
  items.forEach((st, i) => {
    const rowY = body.y + 0.1 + i * rowH
    const cy = rowY + 0.18
    if (pack.stepNode.kind === 'bare') {
      // 墨韻直排：序號擺喺線左
      tx(slide, String(i + 1), {
        x: lineX - 0.45 - 0.1,
        y: rowY - 0.02,
        w: 0.34, // 收窄令序號右緣同節點圓保持 ≥0.06" 呼吸位
        h: 0.34,
        fontSize: 14,
        color: pack.stepNode.color,
        fontFace: pack.displayFont,
        italic: pack.displayItalic,
        align: 'right',
      })
      slide.addShape('ellipse', { x: lineX - 0.045, y: cy - 0.045, w: 0.09, h: 0.09, fill: { color: pack.stepNode.color }, line: { type: 'none' } })
    } else {
      drawStepNode(slide, pack, lineX, cy, i + 1, 0.75)
    }
    tx(slide, clampText(st.title.trim(), 14), { x: textX, y: rowY, w: textW, h: 0.32, fontSize: 14, bold: true, color: pack.ink })
    if (st.desc) {
      tx(slide, clampText(st.desc.trim(), 44), {
        x: textX,
        y: rowY + 0.32,
        w: textW,
        h: Math.max(0.28, rowH - 0.38),
        fontSize: 12,
        color: pack.inkSoft,
        lineSpacingMultiple: 1.25,
        fit: 'shrink',
      })
    }
  })
}

// ───────── cards（2-6 張並列概念卡）─────────

export function renderCards(slide: PptxGenJS.Slide, body: Rect, pack: Pack, s: Slide): void {
  const items = (s.cards ?? []).slice(0, 6)
  if (items.length < 2) return
  const n = items.length
  const cols = n <= 3 ? n : n === 4 ? 2 : 3
  const rows = Math.ceil(n / cols)
  const gutter = 0.25
  const cardW = (body.w - gutter * (cols - 1)) / cols
  const cardH = Math.min(rows === 1 ? 3.2 : 2.05, (body.h - gutter * (rows - 1)) / rows)
  const top = body.y + 0.1
  // 邊框卡（白底 + 髮線框）定 tint 卡，跟 pack 系統行
  const bordered = pack.tileStyle === 'hairline' || pack.tileStyle === 'cellBorder'

  items.forEach((card, i) => {
    const cx = body.x + (i % cols) * (cardW + gutter)
    const cy = top + Math.floor(i / cols) * (cardH + gutter)
    if (bordered) {
      slide.addShape('rect', { x: cx, y: cy, w: cardW, h: cardH, fill: { color: pack.bg }, line: { color: pack.hair, width: 0.75 } })
    } else if (pack.cardRadius > 0) {
      slide.addShape('roundRect', { x: cx, y: cy, w: cardW, h: cardH, rectRadius: pack.cardRadius, fill: { color: pack.panel }, line: { type: 'none' } })
    } else {
      slide.addShape('rect', { x: cx, y: cy, w: cardW, h: cardH, fill: { color: pack.panel }, line: { type: 'none' } })
    }
    // accent 頂邊（研討 deck 卡片標誌）— 內縮對齊卡框/圓角，唔好戴歪帽
    const barInset = bordered ? 0.01 : Math.max(0.01, pack.cardRadius * 0.9)
    slide.addShape('rect', { x: cx + barInset, y: cy, w: cardW - barInset * 2, h: 0.035, fill: { color: pack.accent }, line: { type: 'none' } })
    const inset = 0.22
    tx(slide, clampText(card.title, 12), {
      x: cx + inset,
      y: cy + 0.2,
      w: cardW - inset * 2,
      h: 0.55,
      fontSize: 16,
      bold: true,
      color: pack.ink,
      lineSpacingMultiple: 1.15,
    })
    if (card.desc) {
      tx(slide, clampText(card.desc, 36), {
        x: cx + inset,
        y: cy + 0.78,
        w: cardW - inset * 2,
        h: cardH - 0.95,
        fontSize: 12,
        color: pack.inkSoft,
        lineSpacingMultiple: 1.3,
        fit: 'shrink',
      })
    }
  })
}

// ───────── emphasis（重點版強調）─────────

/**
 * 重點版強調：accent「L-frame」（頂色帶 + 左脊）。
 * AI 標 emphasis 嘅版先畫，令成套有明確輕重節奏。
 * 只擺最邊位（x0 / y0），唔壓內容區（x≥0.9, y≥0.5）。
 */
export function renderEmphasisFrame(slide: PptxGenJS.Slide, pack: Pack): void {
  slide.addShape('rect', { x: 0, y: 0, w: 13.333, h: 0.16, fill: { color: pack.accent }, line: { type: 'none' } })
  slide.addShape('rect', { x: 0, y: 0, w: 0.16, h: 7.5, fill: { color: pack.accent }, line: { type: 'none' } })
}

// ───────── takeaway（版底包底帶）─────────

export function renderTakeaway(slide: PptxGenJS.Slide, pack: Pack, text: string, band: Rect): void {
  if (pack.id === 'seminar' || pack.dark) {
    // 深色實帶 + 白字（研討 deck「包底」）
    const fill = pack.id === 'seminar' ? '0A2C51' : pack.panel
    slide.addShape('rect', { x: band.x, y: band.y, w: band.w, h: band.h, fill: { color: fill }, line: { type: 'none' } })
    tx(slide, clampText(text, 46), {
      x: band.x + 0.25,
      y: band.y,
      w: band.w - 0.5,
      h: band.h,
      fontSize: 13,
      bold: true,
      color: pack.dark && pack.id !== 'seminar' ? pack.ink : 'FFFFFF',
      valign: 'middle',
      fit: 'shrink',
    })
    return
  }
  // 淺色 pack：tint 帶 + accent 左邊條 + 墨色字
  slide.addShape('rect', { x: band.x, y: band.y, w: band.w, h: band.h, fill: { color: pack.panel }, line: { type: 'none' } })
  slide.addShape('rect', { x: band.x, y: band.y, w: 0.05, h: band.h, fill: { color: pack.accent }, line: { type: 'none' } })
  tx(slide, clampText(text, 46), {
    x: band.x + 0.28,
    y: band.y,
    w: band.w - 0.56,
    h: band.h,
    fontSize: 13,
    bold: true,
    color: pack.ink,
    valign: 'middle',
    fit: 'shrink',
  })
}

// ───────── quote（大引文）─────────

/** 簡單亮度判斷（俾引號徽章揀字色） */
function isLightColor(hex: string): boolean {
  const h = hex.replace('#', '')
  return parseInt(h.slice(0, 2), 16) + parseInt(h.slice(2, 4), 16) + parseInt(h.slice(4, 6), 16) > 380
}

export function renderQuote(slide: PptxGenJS.Slide, body: Rect, pack: Pack, s: Slide): void {
  const q = s.quote
  if (!q?.text) return
  const text = clampText(q.text.trim(), 80)
  const pt = [...text].length > 40 ? 22 : 26
  const lines = estimateLines(text, pt, 10)
  const textH = (lines * pt * 1.5) / 72 + 0.15

  // 成個 quote 組（徽章 + 引文 + 署名）計總高，喺 body 內光學置中（中線偏上）
  const markH = pack.quoteMark.kind === 'glyph' ? 0.95 : 0.78
  const attrH = q.attribution ? 0.62 : 0
  const blockH = markH + textH + attrH
  const topY = body.y + Math.max(0, (body.h - blockH) * 0.42)

  const m = pack.quoteMark
  if (m.kind === 'glyph') {
    tx(slide, '“', { x: 1.55, y: topY - 0.2, w: 1.2, h: 1.05, fontSize: 60, bold: true, color: m.color, fontFace: pack.displayFont, italic: pack.displayItalic })
  } else if (m.kind === 'circle') {
    // 圈內配引號 — 空心淨圈會似漏咗嘢
    const size = Math.max(m.size, 0.5)
    slide.addShape('ellipse', { x: 1.6, y: topY, w: size, h: size, fill: { type: 'none' }, line: { color: m.color, width: m.linePt } })
    tx(slide, '“', { x: 1.6, y: topY + 0.07, w: size, h: size, fontSize: 26, bold: true, color: m.color, align: 'center', valign: 'middle', fontFace: 'Georgia' })
  } else {
    // 方／圓角方：統一做 0.5" 徽章 + 對比色引號（token size 太細會似污漬）
    const size = Math.max(m.size, 0.5)
    const glyphColor = isLightColor(m.color) ? pack.ink : 'FFFFFF'
    if (m.kind === 'roundSquare') {
      slide.addShape('roundRect', { x: 1.6, y: topY, w: size, h: size, rectRadius: m.radius, fill: { color: m.color }, line: { type: 'none' } })
    } else {
      slide.addShape('rect', { x: 1.6, y: topY, w: size, h: size, fill: { color: m.color }, line: { type: 'none' } })
    }
    tx(slide, '“', { x: 1.6, y: topY + 0.09, w: size, h: size, fontSize: 30, bold: true, color: glyphColor, align: 'center', valign: 'middle', fontFace: 'Georgia' })
  }

  // 引文靠左唔置中（編輯紀律），行距 1.5 鬆排
  const textY = topY + markH
  tx(slide, text, {
    x: 1.6,
    y: textY,
    w: 10,
    h: textH,
    fontSize: pt,
    color: pack.ink,
    lineSpacingMultiple: 1.5,
    fit: 'shrink',
  })
  if (q.attribution) {
    const attrY = Math.min(textY + textH + 0.3, body.y + body.h - 0.35)
    tx(slide, `── ${clampText(q.attribution.trim(), 16)}`, { x: 1.6, y: attrY, w: 9, h: 0.32, fontSize: 12, color: pack.inkSoft })
  }
}
