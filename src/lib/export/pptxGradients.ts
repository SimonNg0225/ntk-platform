// ============================================================
//  漸層注入 — 繞過 pptxgenjs（只支援 solid fill）的限制
//  ------------------------------------------------------------
//  做法：pack 用 gradLinear()/gradRadial() 攞一個「sentinel」純色當 fill，
//  出檔後喺 PizZip 階段（同 theme patch 一樣）將該 sentinel 的
//  <a:solidFill> 換成 OOXML <a:gradFill>。保持向量、可編輯、檔細。
//  sentinel 用 FE 前綴（pack 調色盤從不使用 FE 開頭 — 有測試守住）。
//  注意：非 reentrant —— buildPptxFile 內「reset → 生成 → inject」順序使用。
// ============================================================

export interface GradStop {
  /** 0–100（百分比位置） */
  pos: number
  /** 6 位 hex（無 #） */
  color: string
}
export type GradDef =
  | { kind: 'linear'; angle: number; stops: GradStop[] } // angle：度，順時針，0=左→右，90=上→下
  | { kind: 'radial'; stops: GradStop[] }

let GRADS: GradDef[] = []

/** 每次 build 開頭呼叫，清空登記。 */
export function resetGradients(): void {
  GRADS = []
}

function sentinelFor(i: number): string {
  return 'FE' + i.toString(16).padStart(4, '0').toUpperCase()
}

/** 登記漸層，回傳當 fill color 用的 sentinel hex。 */
export function registerGradient(def: GradDef): string {
  const i = GRADS.length
  GRADS.push(def)
  return sentinelFor(i)
}

/** 線性漸層 → sentinel。angle：度（90 = 上→下）。 */
export function gradLinear(angle: number, stops: GradStop[]): string {
  return registerGradient({ kind: 'linear', angle, stops })
}

/** 放射漸層（中心 → 外）→ sentinel。stops[0] = 中心。 */
export function gradRadial(stops: GradStop[]): string {
  return registerGradient({ kind: 'radial', stops })
}

function gradXml(def: GradDef): string {
  const gsLst = def.stops
    .map((s) => {
      const pos = Math.round(Math.min(100, Math.max(0, s.pos)) * 1000)
      return `<a:gs pos="${pos}"><a:srgbClr val="${s.color}"/></a:gs>`
    })
    .join('')
  if (def.kind === 'radial') {
    return `<a:gradFill rotWithShape="1"><a:gsLst>${gsLst}</a:gsLst><a:path path="circle"><a:fillToRect l="50000" t="50000" r="50000" b="50000"/></a:path></a:gradFill>`
  }
  const ang = Math.round(((((def.angle % 360) + 360) % 360) * 60000))
  return `<a:gradFill rotWithShape="1"><a:gsLst>${gsLst}</a:gsLst><a:lin ang="${ang}" scaled="1"/></a:gradFill>`
}

interface ZipFileObj {
  asText(): string
}
interface ZipLike {
  files: Record<string, unknown>
  file(name: string): ZipFileObj | null
  file(name: string, data: string): unknown
}

/**
 * 將所有 slide XML 內登記咗的 sentinel solid fill 換成 gradFill。
 * 回傳被替換的次數（俾測試 / 偵錯用）。
 * 收 unknown（PizZip 型別冇宣告 .files；內部按 ZipLike 結構 narrow）。
 */
export function injectGradients(zipUnknown: unknown): number {
  const zip = zipUnknown as ZipLike
  if (GRADS.length === 0) return 0
  let total = 0
  const slideNames = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
  for (const name of slideNames) {
    const f = zip.file(name)
    if (!f) continue
    let xml = f.asText()
    let changed = false
    for (let i = 0; i < GRADS.length; i++) {
      const needle = `<a:solidFill><a:srgbClr val="${sentinelFor(i)}"/></a:solidFill>`
      if (xml.includes(needle)) {
        xml = xml.split(needle).join(gradXml(GRADS[i]))
        changed = true
        total++
      }
    }
    if (changed) zip.file(name, xml)
  }
  return total
}
