// src/features/work/slides/pptx/spec.ts
import type { Slide } from '../types'
import type { Theme } from '../themes'

// ── 序列化繪製指令（純資料，方便測試；export.ts 再落 PptxGenJS）──
export type SlideOp =
  | { kind: 'fill'; color: string }
  | {
      kind: 'text'; text: string
      x: number; y: number; w: number; h: number
      fontSize: number; bold?: boolean; italic?: boolean
      color: string; align: 'left' | 'center'; fontFace: string
    }
  | {
      kind: 'bullets'; items: string[]
      x: number; y: number; w: number; h: number
      fontSize: number; color: string; fontFace: string; bullet: boolean
    }
  | {
      kind: 'table'; rows: string[][]
      x: number; y: number; w: number
      fontSize: number; color: string; headColor: string; fontFace: string
    }
  // 'shape' op 預留畀 Phase 3 主題裝飾（buildSlideOps 暫未產生）
  | { kind: 'shape'; x: number; y: number; w: number; h: number; color: string }
  | { kind: 'image'; src: string; x: number; y: number; w: number; h: number }

// ── 版面常數（16:9 = 10in × 5.625in）──
const MX = 0.6
const CW = 8.8
const HEAD_Y = 0.4
const HEAD_H = 0.9
const BODY_Y = 1.6
const BODY_H = 3.6

// PptxGenJS 色彩要 6 位 hex（無 #）；非法值回退黑色
export function hex(c: string): string {
  const v = c.replace('#', '').toUpperCase()
  return /^([0-9A-F]{6}|[0-9A-F]{3})$/.test(v) ? v : '000000'
}

// CSS font stack → PptxGenJS 單一字體名（PowerPoint 缺字時自動替換）
export function pptxFace(stack: string): string {
  const first = stack.split(',')[0].trim()
  return first.replace(/^["']|["']$/g, '')
}

export function buildSlideOps(slide: Slide, theme: Theme): SlideOp[] {
  const p = theme.tokens.palette
  const disp = pptxFace(theme.tokens.fonts.display)
  const body = pptxFace(theme.tokens.fonts.body)
  const ops: SlideOp[] = [{ kind: 'fill', color: hex(p.bg) }]
  const c = slide.content

  const heading = (text: string): SlideOp => ({
    kind: 'text', text, x: MX, y: HEAD_Y, w: CW, h: HEAD_H,
    fontSize: 28, bold: true, color: hex(p.primary), align: 'left', fontFace: disp,
  })
  const bulletsOp = (items: string[], x = MX, w = CW): SlideOp => ({
    kind: 'bullets', items, x, y: BODY_Y, w, h: BODY_H,
    fontSize: 18, color: hex(p.text), fontFace: body, bullet: true,
  })

  switch (c.type) {
    case 'title':
      ops.push({ kind: 'text', text: c.heading, x: MX, y: 2.1, w: CW, h: 1.2, fontSize: 40, bold: true, color: hex(p.primary), align: 'center', fontFace: disp })
      if (c.subheading) ops.push({ kind: 'text', text: c.subheading, x: MX, y: 3.3, w: CW, h: 0.8, fontSize: 20, color: hex(p.muted), align: 'center', fontFace: body })
      break
    case 'section':
      if (c.kicker) ops.push({ kind: 'text', text: c.kicker, x: MX, y: 1.9, w: CW, h: 0.5, fontSize: 16, color: hex(p.muted), align: 'center', fontFace: body })
      ops.push({ kind: 'text', text: c.heading, x: MX, y: 2.5, w: CW, h: 1.0, fontSize: 32, bold: true, color: hex(p.primary), align: 'center', fontFace: disp })
      break
    case 'bullets':
      ops.push(heading(c.heading), bulletsOp(c.items))
      break
    case 'twoCol':
      ops.push(heading(c.heading))
      ops.push(bulletsOp(c.left, MX, 4.2))
      ops.push(bulletsOp(c.right, MX + 4.4, 4.2))
      break
    case 'imageText':
      // imageSide 留待 Phase 3 圖片 UI；有 imageRef 時內文收窄避免與右側圖片重疊
      ops.push(heading(c.heading))
      ops.push({ kind: 'text', text: c.body, x: MX, y: BODY_Y, w: slide.imageRef?.src ? 5.4 : CW, h: BODY_H, fontSize: 18, color: hex(p.text), align: 'left', fontFace: body })
      break
    case 'quote':
      ops.push({ kind: 'text', text: `「${c.text}」`, x: MX, y: 2.0, w: CW, h: 1.6, fontSize: 30, italic: true, bold: true, color: hex(p.text), align: 'center', fontFace: disp })
      if (c.attribution) ops.push({ kind: 'text', text: `— ${c.attribution}`, x: MX, y: 3.7, w: CW, h: 0.6, fontSize: 16, color: hex(p.muted), align: 'center', fontFace: body })
      break
    case 'compare':
      ops.push(heading(c.heading))
      ops.push({ kind: 'table', rows: c.rows.map((r) => [r.label, r.a, r.b]), x: MX, y: BODY_Y, w: CW, fontSize: 16, color: hex(p.text), headColor: hex(p.primary), fontFace: body })
      break
    case 'timeline':
      ops.push(heading(c.heading))
      ops.push(bulletsOp(c.steps.map((s, i) => `${i + 1}. ${s.label}${s.detail ? ` — ${s.detail}` : ''}`)))
      break
    case 'quiz':
      ops.push(heading(c.question))
      ops.push(bulletsOp(c.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`)))
      break
    case 'summary':
      ops.push(heading(c.heading))
      ops.push(bulletsOp(c.points.map((pt) => `✓ ${pt}`)))
      break
    default: {
      // 編譯期守欄：若日後加咗新 SlideType 但漏咗喺度處理，TS 會報錯
      const _exhaustive: never = c
      void _exhaustive
    }
  }
  if (slide.imageRef?.src) {
    ops.push({ kind: 'image', src: slide.imageRef.src, x: 6.2, y: 1.6, w: 3.2, h: 3.2 })
  }
  return ops
}
