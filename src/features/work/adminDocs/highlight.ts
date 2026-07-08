// ============================================================
//  行政文件 — 範本欄位彩色標示引擎（純邏輯 + 薄 render wrapper）
//  ------------------------------------------------------------
//  目的：在 docx-preview 渲染出來的 HTML 上面，把每個 `{標籤}` 的
//  位置用同色 <mark> 包住，做到「視覺化彩色預覽」。
//
//  - TAG_COLORS / colorForIndex：欄位 ↔ 顏色配對（穩定循環）。
//  - highlightTagsInElement：純 DOM 操作（可單元測試，jsdom）。
//  - renderWithHighlights：薄 wrapper（render 失敗照 throw 給上層 fallback）。
// ============================================================

/**
 * 8 隻柔和背景色盤。
 * 用 rgba 低透明度淺色 —— docx-preview 渲染出來的文件頁係白底黑字，
 * 淺透明背景不會蓋過黑字（light）；dark mode 下整個預覽容器通常仍係
 * 白頁（docx-preview 自帶頁面樣式），同樣讀到字。透明度低亦令重疊／
 * 相鄰標籤不會太濃。色相覆蓋 amber/sky/emerald/violet/rose/teal/
 * orange/indigo 系，方便逐欄分辨。
 */
export const TAG_COLORS: string[] = [
  'rgba(245, 158, 11, 0.5)', // amber
  'rgba(56, 189, 248, 0.5)', // sky
  'rgba(16, 185, 129, 0.5)', // emerald
  'rgba(139, 92, 246, 0.45)', // violet
  'rgba(244, 63, 94, 0.45)', // rose
  'rgba(20, 184, 166, 0.5)', // teal（工作模式主色系）
  'rgba(249, 115, 22, 0.5)', // orange
  'rgba(99, 102, 241, 0.45)', // indigo
]

/**
 * 由 index 安全取色（無論正負都循環落 0..n-1）。
 * `((i % n) + n) % n` 處理負數 index。
 */
export function colorForIndex(i: number): string {
  const n = TAG_COLORS.length
  return TAG_COLORS[((i % n) + n) % n]
}

const TAG_RE = /\{([^{}]+)\}/g
const HL_CLASS = 'adoc-tag-hl'

/**
 * 在 `el` 內所有 text node 搜尋 `{標籤}`，若標籤在 `tagColors`，
 * 就把該段 `{標籤}` 拆出來用 <mark class="adoc-tag-hl"> 包住上色；
 * 其餘文字原樣保留。不在 `tagColors` 的 `{x}` 不郁。
 *
 * 重點：
 * - 先用 TreeWalker collect 全部所有 text node 再改 DOM（不要邊行邊改，
 *   因為插入新節點會打亂 walker 的遍歷）。
 * - 已經在 mark.adoc-tag-hl 中的 text node 跳過，避免重覆包。
 * - 只拆「真正命中」的 text node（命中數 = 0 就不郁，慳 DOM 操作）。
 */
export function highlightTagsInElement(
  el: HTMLElement,
  tagColors: Map<string, string>,
): void {
  if (!el || tagColors.size === 0) return

  const doc = el.ownerDocument
  // 第一步：collect 候選 text node（先讀後寫）。
  const targets: Text[] = []
  const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    const text = node as Text
    if (
      text.nodeValue &&
      text.nodeValue.indexOf('{') !== -1 &&
      !isInsideHighlight(text)
    ) {
      targets.push(text)
    }
    node = walker.nextNode()
  }

  // 第二步：逐個 text node 重建（命中的標籤 → <mark>，其餘 → 文字）。
  for (const text of targets) {
    const value = text.nodeValue ?? ''
    const frag = buildHighlightedFragment(doc, value, tagColors)
    if (frag) {
      text.parentNode?.replaceChild(frag, text)
    }
  }
}

/** 該 text node 係咪已經在一個 .adoc-tag-hl <mark> 中。 */
function isInsideHighlight(text: Text): boolean {
  let p: Node | null = text.parentNode
  while (p) {
    if (
      p.nodeType === 1 &&
      (p as Element).classList?.contains(HL_CLASS)
    ) {
      return true
    }
    p = p.parentNode
  }
  return false
}

/**
 * 由一段文字砌 DocumentFragment：命中（在 tagColors）的 `{標籤}` 變
 * <mark>，其餘文字保留做 text node。若無任何命中標籤 → 回 null
 * （代表這個 text node 不用改）。
 */
function buildHighlightedFragment(
  doc: Document,
  value: string,
  tagColors: Map<string, string>,
): DocumentFragment | null {
  TAG_RE.lastIndex = 0
  let m: RegExpExecArray | null
  let lastIndex = 0
  let matched = false
  const frag = doc.createDocumentFragment()

  while ((m = TAG_RE.exec(value)) !== null) {
    const tag = m[1].trim()
    const color = tagColors.get(tag)
    if (color == null) continue // 不在 map 的 {x} 留返做純文字

    matched = true
    // 命中前的純文字
    if (m.index > lastIndex) {
      frag.appendChild(doc.createTextNode(value.slice(lastIndex, m.index)))
    }
    const mark = doc.createElement('mark')
    mark.className = HL_CLASS
    mark.setAttribute('data-tag', tag)
    mark.setAttribute(
      'style',
      // 加粗 + 細邊框令彩色在密集黑字／表格上都清楚查看到。
      `background:${color};border-radius:3px;padding:0 2px;font-weight:600;box-shadow:0 0 0 1px rgba(0,0,0,0.10)`,
    )
    mark.textContent = m[0] // 連大括號原文（例如「{name}」）
    frag.appendChild(mark)
    lastIndex = m.index + m[0].length
  }

  if (!matched) return null
  // 收尾純文字
  if (lastIndex < value.length) {
    frag.appendChild(doc.createTextNode(value.slice(lastIndex)))
  }
  return frag
}

/**
 * 渲染 .docx blob 入 `container`，再在上方套彩色標示。
 * - 動態 import docx-preview（同既有用法一致，慳首屏 bundle）。
 * - render 失敗不吞錯，照 throw，給上層退「純清單」fallback。
 */
export async function renderWithHighlights(
  container: HTMLElement,
  blob: Blob,
  tagColors: Map<string, string>,
): Promise<void> {
  container.innerHTML = ''
  const { renderAsync } = await import('docx-preview')
  await renderAsync(blob, container)
  highlightTagsInElement(container, tagColors)
}
