// ============================================================
//  匯出 PowerPoint (.pptx) — 教學簡報引擎（純 code、零成本）
//  ------------------------------------------------------------
//  · 5 套模板 pack（pptxPacks）× 6 款版式（pptxLayouts）
//  · CJK metrics（pptxText）：行高估算 + 長題階梯 + 預混色
//  · 無 slide master／placeholder — 每版背景、頁尾、頁碼 engine 自己畫
//  · 出檔後用 pizzip patch theme1.xml：a:ea 字體軌補 Microsoft JhengHei
//    （chart 文字 + 冇 fontFace 嘅 run 先有正確中文字體）
//  pptxgenjs 同 pizzip 都係動態 import，唔拖慢首屏。
// ============================================================

import type { Deck, Slide, SlideLayout } from './types'
import { downloadBlob, safeFilename } from './file'
import { CORE_PACKS, FONT, pickKicker, type FrameCtx, type Pack, type SlideImage, type SlidePackId } from './pptxPacks'
import { GALLERY_PACKS_1 } from './pptxPacksGallery1'
import { GALLERY_PACKS_2 } from './pptxPacksGallery2'
import { GALLERY_PACKS_3 } from './pptxPacksGallery3'
import { GALLERY_PACKS_4 } from './pptxPacksGallery4'
import { GALLERY_PACKS_5 } from './pptxPacksGallery5'
import { GALLERY_PACKS_6 } from './pptxPacksGallery6'
import { GALLERY_PACKS_7 } from './pptxPacksGallery7'
import { renderBullets, renderCards, renderCompare, renderEmphasisFrame, renderQuote, renderStats, renderSteps, renderTakeaway } from './pptxLayouts'
import { resetGradients, injectGradients } from './pptxGradients'

export type { SlidePackId, SlideImage } from './pptxPacks'

/** 全部 pack（6 核心 + 28 gallery）；揀選 UI 按此排序 */
const PACK_LIST: Pack[] = [
  ...CORE_PACKS,
  ...GALLERY_PACKS_1,
  ...GALLERY_PACKS_2,
  ...GALLERY_PACKS_3,
  ...GALLERY_PACKS_4,
  ...GALLERY_PACKS_5,
  ...GALLERY_PACKS_6,
  ...GALLERY_PACKS_7,
]
const PACKS = Object.fromEntries(PACK_LIST.map((p) => [p.id, p])) as Record<SlidePackId, Pack>

/**
 * 揀選卡 UI 用嘅 pack 清單。swatches 連 #，可直接入 style；
 * bg/ink/accent 係引擎 token（純 hex，冇 #）俾 <PackPreview> 砌代表性封面縮圖
 * （唔係真 pptx engine render — 純前端 token-driven mock）；dark = 深底 pack。
 */
export interface SlidePackOption {
  id: SlidePackId
  name: string
  hint: string
  swatches: [string, string, string]
  /** 引擎 token（純 hex，冇 #）：背景色 */
  bg: string
  /** 引擎 token（純 hex，冇 #）：墨／文字色 */
  ink: string
  /** 引擎 token（純 hex，冇 #）：點睛色 */
  accent: string
  /** 深底 pack（縮圖按此調對比） */
  dark: boolean
  /** 標題顯示字體（縮圖 faux 標題用） */
  displayFont: string
}

export const SLIDE_PACKS: SlidePackOption[] = PACK_LIST.map((p) => ({
  id: p.id,
  name: p.name,
  hint: p.hint,
  swatches: p.swatches,
  bg: p.bg,
  ink: p.ink,
  accent: p.accent,
  dark: p.dark,
  displayFont: p.displayFont,
}))

export interface PptxOptions {
  /** 模板 pack，預設墨韻 */
  pack?: SlidePackId
  coverPhoto?: SlideImage
  /** deck.slides index → 內頁配相 */
  slidePhotos?: Record<number, SlideImage>
  /** 頁尾品牌字 */
  brand?: string
}

const BRAND = 'EziTeach · 教學易'
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

/**
 * 決定一版實際行邊款版式：bullets 留空 = 章節；其他 layout 嘅
 * 資料唔合格一律靜默回退 'bullets'（永不 throw — 舊紀錄照出）。
 */
function effectiveLayout(s: Slide): SlideLayout {
  const bullets = s.bullets ?? []
  if (s.layout === 'section' || bullets.length === 0) return 'section'
  switch (s.layout) {
    case 'stats':
      return s.stats && s.stats.length >= 2 && s.stats.length <= 4 && s.stats.every((t) => t.value && t.label) ? 'stats' : 'bullets'
    case 'compare': {
      const c = s.compare
      return c && c.leftTitle && c.rightTitle && c.left?.length >= 2 && c.right?.length >= 2 ? 'compare' : 'bullets'
    }
    case 'steps':
      return s.steps && s.steps.length >= 2 && s.steps.length <= 5 && s.steps.every((t) => t.title) ? 'steps' : 'bullets'
    case 'quote':
      // 超長引文做唔大 — 降級行 bullets 路
      return s.quote?.text && [...s.quote.text].length <= 80 ? 'quote' : 'bullets'
    case 'cards':
      return s.cards && s.cards.length >= 2 && s.cards.length <= 6 && s.cards.every((c) => c.title) ? 'cards' : 'bullets'
    default:
      return 'bullets'
  }
}

/**
 * 修正非法負 extent：OOXML 嘅 <a:ext cx/cy> 必須 ≥ 0，但斜線／向上線經 pptxgenjs
 * 可能出負值，令 PowerPoint「無法讀取」。將負 ext 轉成正 ext + 對應 flip + 平移 off
 * （外觀不變）。逐 slide XML 套用。
 */
function normalizeNegExt(xml: string): string {
  return xml.replace(
    /<a:xfrm([^>]*)><a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(-?\d+)" cy="(-?\d+)"\/><\/a:xfrm>/g,
    (full, attrs: string, xs: string, ys: string, cxs: string, cys: string) => {
      let x = parseInt(xs, 10)
      let y = parseInt(ys, 10)
      let cx = parseInt(cxs, 10)
      let cy = parseInt(cys, 10)
      if (cx >= 0 && cy >= 0) return full
      let flipH = /flipH="1"/.test(attrs)
      let flipV = /flipV="1"/.test(attrs)
      if (cx < 0) {
        x += cx
        cx = -cx
        flipH = !flipH
      }
      if (cy < 0) {
        y += cy
        cy = -cy
        flipV = !flipV
      }
      let a = attrs.replace(/\s*flip[HV]="[01]"/g, '')
      if (flipH) a += ' flipH="1"'
      if (flipV) a += ' flipV="1"'
      return `<a:xfrm${a}><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>`
    },
  )
}

/** §6 theme patch：theme1.xml 嘅空 a:ea 軌 + Hant script 表換做 CJK 字體 */
async function patchThemeAndPackage(buf: ArrayBuffer): Promise<Blob | Uint8Array> {
  const PizZip = (await import('pizzip')).default
  const zip = new PizZip(buf)
  const themePath = 'ppt/theme/theme1.xml'
  try {
    const xml = zip.file(themePath)?.asText()
    if (xml) {
      let patched = xml.split('<a:ea typeface=""/>').join(`<a:ea typeface="${FONT}"/>`)
      patched = patched.split('typeface="新細明體"').join(`typeface="${FONT}"`)
      if (patched !== xml) zip.file(themePath, patched)
    }
  } catch {
    // 搵唔到目標就照原樣出檔（唔好 throw）
  }
  // 漸層注入：將 pack 登記咗的 sentinel solid fill 換成 OOXML gradFill
  try {
    injectGradients(zip)
  } catch {
    // 注入失敗就照原樣出檔（漸層變番 sentinel 純色，唔好 throw）
  }
  // 修正非法負 extent（斜線／向上線），否則 PowerPoint 讀唔到檔
  try {
    const names = Object.keys((zip as unknown as { files: Record<string, unknown> }).files)
    for (const name of names) {
      if (!/^ppt\/slides\/slide\d+\.xml$/.test(name)) continue
      const sx = zip.file(name)?.asText()
      if (!sx) continue
      const fixed = normalizeNegExt(sx)
      if (fixed !== sx) zip.file(name, fixed)
    }
  } catch {
    // 正規化失敗就照原樣出檔（唔好 throw）
  }
  if (isBrowser()) {
    return zip.generate({ type: 'blob', mimeType: PPTX_MIME })
  }
  return zip.generate({ type: 'uint8array' }) as unknown as Uint8Array
}

/**
 * 砌成個 .pptx 檔：封面 → 逐版 dispatch（章節 / 內容框 + 版式）→ theme patch。
 * 瀏覽器回 Blob、Node 回 Uint8Array。
 */
export async function buildPptxFile(deck: Deck, opts: PptxOptions = {}): Promise<Blob | Uint8Array> {
  resetGradients() // 清空今次 build 的漸層登記（非 reentrant：一次一份）
  const PptxGenJS = (await import('pptxgenjs')).default
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE' // 16:9 = 13.33 × 7.5 吋
  // theme 級只寫到 latin 軌；a:ea 軌靠出檔後 patch
  pptx.theme = { headFontFace: FONT, bodyFontFace: FONT }

  const pack: Pack = PACKS[opts.pack ?? 'inkwell'] ?? PACKS.inkwell
  const brand = opts.brand ?? BRAND

  // ── 封面 ──
  pack.cover(pptx.addSlide(), deck, brand, opts.coverPhoto)

  // ── 內容 / 章節 ──
  let sectionNo = 0
  let contentSeq = 0 // 內容版序（0-based，唔計章節）— 版面節奏 + 逐版母題用
  deck.slides.forEach((s, i) => {
    const slide = pptx.addSlide()
    const layout = effectiveLayout(s)

    if (layout === 'section') {
      sectionNo += 1 // 章節序 = 章節喺 deck 入面嘅次序，唔係 slide index
      pack.section(slide, sectionNo, s.title)
      if (s.notes) slide.addNotes(s.notes)
      return
    }

    const seq = contentSeq++
    // chart 同 photo 同版 → chart 優先（可編輯係賣點）；配圖只限 bullets 版式
    const photo = layout === 'bullets' && !s.chart ? opts.slidePhotos?.[i] : undefined
    const ctx: FrameCtx = {
      title: s.title,
      subtitle: s.subtitle,
      kicker: pickKicker(s.title, i, Boolean(s.chart)),
      pageNo: i + 2, // 真實版號（封面 = 1）
      pageTotal: deck.slides.length + 1,
      brand,
      layout,
      hasPhoto: Boolean(photo),
      hasChart: Boolean(s.chart),
      seq,
    }
    const fullBody = pack.contentFrame(slide, ctx)
    // 逐版母題（喺 frame 之後、內容之前）— pack 自選，缺省冇
    pack.deco?.(slide, ctx)
    // 重點版強調：AI 標 emphasis 嘅版畫 accent L-frame，造輕重節奏
    if (s.emphasis) renderEmphasisFrame(slide, pack)

    // 包底帶：預留版底 0.74"，版式喺收窄咗嘅 body 入面排
    const takeaway = s.takeaway?.trim()
    const body = takeaway ? { ...fullBody, h: fullBody.h - 0.74 } : fullBody

    // pack 招牌版式覆寫優先（例：月台 transit 的 steps = 地鐵線路圖）；缺省行共用 renderX
    const override = pack.overrides?.[layout]
    if (override) {
      override(slide, body, pack, s)
    } else {
      switch (layout) {
        case 'stats':
          renderStats(slide, body, pack, s)
          break
        case 'compare':
          renderCompare(slide, body, pack, s)
          break
        case 'steps':
          renderSteps(slide, body, pack, s)
          break
        case 'quote':
          renderQuote(slide, body, pack, s)
          break
        case 'cards':
          renderCards(slide, body, pack, s)
          break
        default:
          renderBullets(slide, body, pack, s, photo, seq)
      }
    }
    if (takeaway) {
      renderTakeaway(slide, pack, takeaway, {
        x: fullBody.x,
        y: fullBody.y + fullBody.h - 0.54,
        w: fullBody.w,
        h: 0.54,
      })
    }
    if (s.notes) slide.addNotes(s.notes)
  })

  const buf = (await pptx.write({ outputType: 'arraybuffer' })) as ArrayBuffer
  return patchThemeAndPackage(buf)
}

/** 砌檔 + 觸發瀏覽器下載（safeFilename 防唔合法字元） */
export async function downloadPptx(deck: Deck, name?: string, opts?: PptxOptions): Promise<void> {
  const file = await buildPptxFile(deck, opts)
  const blob = file instanceof Blob ? file : new Blob([file as BlobPart], { type: PPTX_MIME })
  downloadBlob(blob, safeFilename(name ?? deck.title, 'pptx'))
}
