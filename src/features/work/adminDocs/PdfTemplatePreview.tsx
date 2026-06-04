import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Button, Field, Input } from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { addTemplate } from './adminDocStore'
import { colorForIndex } from './highlight'
import { renderPdfWithFieldBoxes } from './pdfPreview'
import type { PdfFieldRect, PdfFieldType } from './pdfEngine'
import {
  ArrowLeft,
  CheckSquare,
  ChevronDownSquare,
  FileWarning,
  Loader2,
  Save,
  Tag,
  Type,
  WrapText,
} from 'lucide-react'

// ============================================================
//  行政文件 — PDF 範本「視覺化兩欄預覽」（平行 TemplatePreview）
//  ------------------------------------------------------------
//  PDF 欄位由 AcroForm 直接嚟（pdf-lib 已抽好），唔使 injectTags、唔改原檔。
//  左／主欄：pdf.js 渲染原 PDF 每頁 + 按 widget 座標疊彩色欄位框。
//  右／側欄：欄位清單（色 swatch + 顯示名可改 + 類型顯示 + 撳一下捲到/閃對應框）。
//  底：範本名 + 儲存（呼 adminDocStore addTemplate，kind='pdf'，base64=原 PDF）。
//
//  render 失敗 → 退純清單（仍可改名/儲存）。teal/dark/375px。
// ============================================================

/** PDF 欄位類型 → 顯示中文 + 圖示。 */
const PDF_TYPE_META: Record<
  PdfFieldType,
  { label: string; icon: typeof Type }
> = {
  text: { label: '單行文字', icon: Type },
  multiline: { label: '多行文字', icon: WrapText },
  checkbox: { label: '勾選格', icon: CheckSquare },
  dropdown: { label: '下拉選單', icon: ChevronDownSquare },
}

/** 編輯中嘅 PDF 欄位（tag = PDF AcroForm field name，不可改；label 可改）。 */
export interface PdfPreviewField {
  /** PDF field name —— 填值 key，不可改。 */
  tag: string
  /** 友善顯示名（可改；預設 = tag）。 */
  label: string
  type: PdfFieldType
  /** dropdown 選項（其餘類型 undefined）。 */
  options?: string[]
  /**
   * widget 座標（連頁 index，PDF 單位）。由 extractPdfFields 帶入，
   * 畀左欄疊彩色框。缺省（空 / 未帶）→ 仍渲染頁面、只係冇彩色框。
   */
  rects?: PdfFieldRect[]
}

export default function PdfTemplatePreview({
  originalBase64,
  initialFields,
  initialName = '',
  onBack,
  onSaved,
}: {
  /** 上載原 PDF（base64）；存範本時原樣存返（版面 100% 保留）。 */
  originalBase64: string
  /** 由 extractPdfFields 抽出嘅欄位（tag=name、label、type、options）。 */
  initialFields: PdfPreviewField[]
  /** 預填範本名（通常 = 去副檔名嘅檔名）。 */
  initialName?: string
  onBack: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const containerRef = useRef<HTMLDivElement>(null)

  const [fields, setFields] = useState<PdfPreviewField[]>(initialFields)
  const [name, setName] = useState(initialName)
  const [renderFailed, setRenderFailed] = useState(false)
  const [rendering, setRendering] = useState(true)
  const [saving, setSaving] = useState(false)

  // 原 PDF buffer（base64 → ArrayBuffer），只當 base64 變先重算。
  const pdfBuffer = useMemo(
    () => base64ToArrayBuffer(originalBase64),
    [originalBase64],
  )

  // 欄位 name → 色（按清單次序穩定循環，重用 docx 嗰套配色）。
  const fieldColors = useMemo<Map<string, string>>(
    () => new Map(fields.map((f, i) => [f.tag, colorForIndex(i)])),
    [fields],
  )

  // 重渲染信號 = name→色 序列化（次序敏感）。改 label 唔影響 → 唔重渲染。
  const colorKey = useMemo(
    () => fields.map((f, i) => `${f.tag}:${colorForIndex(i)}`).join('|'),
    [fields],
  )

  // ── 渲染：pdf.js 逐頁 + 彩色欄位框；render 失敗退純清單 ──
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let cancelled = false
    setRendering(true)
    setRenderFailed(false)
    // 傳 buffer copy：pdf.js 會 detach buffer，唔好整爛 useMemo 緩存個 buffer。
    // 映射成 renderer 要嘅 { name, rects } 形狀（name = PDF field name = tag）。
    const renderable = fields.map((f) => ({
      name: f.tag,
      rects: f.rects ?? [],
    }))
    renderPdfWithFieldBoxes(
      container,
      pdfBuffer.slice(0),
      renderable,
      fieldColors,
    )
      .then(() => {
        if (!cancelled) setRendering(false)
      })
      .catch(() => {
        if (cancelled) return
        setRenderFailed(true)
        setRendering(false)
        container.innerHTML = ''
      })
    return () => {
      cancelled = true
    }
    // 依 pdfBuffer + colorKey 重渲染；fieldColors 每 render 都係新 Map
    // （內容相同時 colorKey 不變 → 唔會重複渲染）。改 label 唔觸發。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfBuffer, colorKey])

  function updateLabel(tag: string, label: string) {
    setFields((prev) => prev.map((f) => (f.tag === tag ? { ...f, label } : f)))
  }

  // 撳側欄一行 → 捲到對應 .adoc-pdf-box[data-tag] 並閃一閃（重用 adoc-tag-flash）。
  function focusTag(tag: string) {
    const container = containerRef.current
    if (!container) return
    const box = container.querySelector<HTMLElement>(
      `.adoc-pdf-box[data-tag="${cssEscape(tag)}"]`,
    )
    if (!box) return
    box.scrollIntoView({ behavior: 'smooth', block: 'center' })
    box.classList.remove('adoc-tag-flash')
    // 重新觸發動畫（強制 reflow）。
    void box.offsetWidth
    box.classList.add('adoc-tag-flash')
    window.setTimeout(() => box.classList.remove('adoc-tag-flash'), 1200)
  }

  function handleSave() {
    const trimmedName = name.trim()
    if (!trimmedName) {
      toast.error('請輸入範本名稱。')
      return
    }
    if (fields.length === 0) {
      toast.error('此 PDF 冇可填欄位，無法儲存。請改用有填寫欄位嘅 PDF。')
      return
    }
    setSaving(true)
    try {
      // kind / checkbox / dropdown / options 已正式收斂入 adminDocStore 型別。
      addTemplate({
        name: trimmedName,
        base64: originalBase64, // 原 PDF，唔改。
        kind: 'pdf',
        fields: fields.map((f) => ({
          tag: f.tag,
          label: f.label.trim() || f.tag,
          type: f.type,
          ...(f.options ? { options: f.options } : {}),
        })),
      })
      toast.success(`PDF 範本「${trimmedName}」已儲存 🎉`)
      onSaved()
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : '儲存失敗，請刪除舊範本後再試。',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* ───────── 頂部說明 ───────── */}
      <div className="flex items-start gap-2.5 rounded-xl border border-accent/20 bg-accent-soft/40 px-3.5 py-3 text-sm text-slate-600 dark:border-accent/25 dark:bg-accent/10 dark:text-slate-300">
        <Tag size={16} className="mt-0.5 shrink-0 text-accent" />
        <p className="leading-relaxed">
          左邊預覽會將每個填寫欄位位置{' '}
          <span className="font-medium text-accent-strong dark:text-accent">
            彩色標示
          </span>
          ；右邊可改顯示名稱（PDF 欄位由表單直接讀出，版面原樣保留）。核對無誤後儲存範本。
        </p>
      </div>

      {/* ───────── 兩欄：手機上下疊（lg 起左右）───────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_clamp(280px,34%,380px)]">
        {/* 左／主：PDF 彩色預覽 */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            PDF 預覽（彩色 = 填寫位置）
          </p>
          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900/40">
            {rendering && !renderFailed && (
              <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-white/70 text-sm text-slate-500 backdrop-blur-sm dark:bg-slate-900/60 dark:text-slate-400">
                <Loader2 size={16} className="animate-spin" />
                載入預覽中…
              </div>
            )}
            {renderFailed && (
              <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
                  <FileWarning size={22} />
                </span>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  預覽未能載入
                </p>
                <p className="max-w-xs text-xs text-slate-400 dark:text-slate-500">
                  仍可喺右邊清單核對欄位並儲存範本；最終以 PDF 開啟為準。
                </p>
              </div>
            )}
            {/* pdf.js 渲染容器（逐頁 canvas + 彩色框），畀佢捲動。 */}
            <div
              ref={containerRef}
              className={`max-h-[75vh] overflow-auto p-2 sm:p-3 ${
                renderFailed ? 'hidden' : ''
              }`}
            />
          </div>
        </div>

        {/* 右／側：欄位清單（PDF 欄位唔可增刪，只改顯示名） */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
              <Tag size={13} className="text-accent" />
              欄位清單（{fields.length}）
            </p>
          </div>

          <div className="space-y-2">
            {fields.length === 0 && (
              <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50/60 px-3 py-4 text-center text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                此 PDF 冇填寫欄位（AcroForm）。請改用有填寫欄位嘅 PDF，或用 Word
                範本。
              </p>
            )}
            {fields.map((f, i) => {
              const meta = PDF_TYPE_META[f.type]
              const TypeIcon = meta.icon
              return (
                <div
                  key={f.tag}
                  className="rounded-lg border border-slate-200 bg-white p-2.5 transition hover:border-accent/40 dark:border-slate-700 dark:bg-slate-800"
                >
                  <button
                    type="button"
                    onClick={() => focusTag(f.tag)}
                    disabled={renderFailed}
                    className="flex w-full items-center gap-2 text-left disabled:cursor-default"
                    title="撳一下捲到預覽對應位置"
                  >
                    <span
                      aria-hidden
                      className="h-3.5 w-3.5 shrink-0 rounded-sm ring-1 ring-inset ring-black/10 dark:ring-white/10"
                      style={{ background: colorForIndex(i) }}
                    />
                    <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {f.tag}
                    </span>
                    <Badge tone="slate" icon={TypeIcon}>
                      {meta.label}
                    </Badge>
                  </button>

                  <div className="mt-2">
                    <Input
                      aria-label={`欄位 ${f.tag} 顯示名稱`}
                      value={f.label}
                      onChange={(e) => updateLabel(f.tag, e.target.value)}
                      placeholder={f.tag}
                      maxLength={40}
                    />
                  </div>

                  {/* dropdown 選項預覽（唯讀，畀老師核對選項冇缺）。 */}
                  {f.type === 'dropdown' &&
                    f.options &&
                    f.options.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {f.options.slice(0, 8).map((opt) => (
                          <span
                            key={opt}
                            className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-700/60 dark:text-slate-400"
                          >
                            {opt}
                          </span>
                        ))}
                        {f.options.length > 8 && (
                          <span className="px-1 py-0.5 text-[10px] text-slate-400">
                            +{f.options.length - 8}
                          </span>
                        )}
                      </div>
                    )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ───────── 底部：範本名 + 動作 ───────── */}
      <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700">
        <Field label="範本名稱" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：學生資料表"
            maxLength={60}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            icon={ArrowLeft}
            onClick={onBack}
            disabled={saving}
          >
            返回
          </Button>
          <Button
            icon={Save}
            onClick={handleSave}
            loading={saving}
            disabled={saving || fields.length === 0}
          >
            儲存範本
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── 本地小工具（避免依賴 docxEngine 嘅 base64 helper，PDF 路徑自足）──

/** base64（PDF）→ ArrayBuffer。 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

/**
 * CSS attribute-selector value escape（用喺 `[data-tag="..."]`）。
 * 用 CSS.escape（瀏覽器都有）；否則保守 escape 雙引號 / 反斜線。
 */
function cssEscape(value: string): string {
  const c = (globalThis as { CSS?: { escape?: (s: string) => string } }).CSS
  if (c && typeof c.escape === 'function') return c.escape(value)
  return value.replace(/["\\]/g, '\\$&')
}
