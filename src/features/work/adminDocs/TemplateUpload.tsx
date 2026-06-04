import { lazy, Suspense, useRef, useState } from 'react'
import { Button } from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { useAuth } from '../../../context/AuthContext'
import { isAIConfigured } from '../../../lib/aiClient'
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  extractTags,
  extractText,
} from './docxEngine'
import { suggestFields, type SuggestedField } from './docxAi'
import { autoTagFields, detectTemplateFields } from './docxTableInject'
import TemplatePreview, { type PreviewField } from './TemplatePreview'
import type { PdfPreviewField } from './PdfTemplatePreview'
import { extractPdfFields } from './pdfEngine'

// 動態載入：PdfTemplatePreview 會 import pdfPreview（pdfjs-dist，依賴瀏覽器
// DOMMatrix / canvas）。lazy 令 pdfjs 唔入 feature 模組圖（preloadAllFeatures /
// SSR 安全），到真正要顯示 PDF 預覽先載。
const PdfTemplatePreview = lazy(() => import('./PdfTemplatePreview'))
import {
  FileUp,
  FilePlus2,
  CircleAlert,
  Loader2,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react'

// ============================================================
//  行政文件 — 上載 .docx 範本（兩步：upload → preview）
//  ------------------------------------------------------------
//  step='upload'：揀 .docx → file.arrayBuffer() → extractTags：
//    · 已有標籤 → 直接入 TemplatePreview（fields = 既有 tags，anchor=''）。
//    · 冇／少標籤 → 顯示「AI 識別欄位」掣（gate isAIConfigured + 登入）→
//      suggestFields(extractText) → fields = 建議（帶 anchor）→ 入 preview。
//  step='preview'：交畀 TemplatePreview（兩欄視覺化編輯 + 儲存）。
//  ⚠️ 手動 {標籤} 永遠係可靠後路：上載已含標籤嘅檔即直接見彩色預覽。
// ============================================================

// 單個範本大小 guard（base64 後 ~1.33×；localStorage 通常 ~5MB / origin）。
const MAX_DOCX_BYTES = 1_000_000 // ~1MB 原始檔（Word）
// PDF 體積通常較大（含字型 / 圖），畀鬆啲；仍要顧 localStorage 配額。
const MAX_PDF_BYTES = 3_000_000 // ~3MB 原始檔（PDF）

type Step = 'upload' | 'preview' | 'pdf-preview'

export default function TemplateUpload({
  onSaved,
  onCancel,
}: {
  /** 儲存成功後通知 host（通常關閉 modal + 回範本庫）。 */
  onSaved: () => void
  onCancel: () => void
}) {
  const toast = useToast()
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')

  // 上載到嘅檔（base64 + 原檔名），未揀 = null。
  const [docx, setDocx] = useState<{ base64: string; fileName: string } | null>(
    null,
  )
  // 上載到嘅 PDF（base64 + 抽出嘅欄位），未揀 = null；走獨立 pdf-preview step。
  const [pdf, setPdf] = useState<{
    base64: string
    fields: PdfPreviewField[]
  } | null>(null)
  // 預填範本名（去 .docx 副檔名）。
  const [name, setName] = useState('')
  // 既有標籤（extractTags 認到）；用嚟「已有標籤 → 直接預覽」。
  const [existingTags, setExistingTags] = useState<string[]>([])
  // 入 TemplatePreview 嘅初始欄位（既有 / AI 建議）。
  const [previewFields, setPreviewFields] = useState<PreviewField[]>([])
  const [busy, setBusy] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)

  const aiReady = isAIConfigured && !!user

  // 上載分流：按副檔名 / MIME 判 .pdf vs .docx，各走獨立管線。
  async function handleFile(file: File) {
    const lowerName = file.name.toLowerCase()
    const isPdf =
      lowerName.endsWith('.pdf') || file.type === 'application/pdf'
    const isDocx =
      lowerName.endsWith('.docx') ||
      file.type ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

    if (isPdf) {
      await handlePdf(file)
      return
    }
    if (isDocx) {
      await handleDocx(file)
      return
    }
    toast.error('請揀 Word（.docx）或 PDF（.pdf）檔。舊 .doc 暫不支援。')
  }

  // ── PDF 管線：讀 AcroForm 欄位 → 0 欄位友善提示；否則入 PdfTemplatePreview ──
  async function handlePdf(file: File) {
    if (file.size > MAX_PDF_BYTES) {
      toast.error(
        `PDF 太大（${(file.size / 1024 / 1024).toFixed(1)}MB），請用 3MB 以內嘅範本。`,
      )
      return
    }
    setBusy(true)
    try {
      const buf = await file.arrayBuffer()
      let pdfFields
      try {
        // extractPdfFields 會 detach buffer（pdf-lib load）→ 故先取 base64 再抽。
        // 為穩陣，base64 用獨立 copy（toBase64 內部唔 detach）。
        pdfFields = await extractPdfFields(buf.slice(0))
      } catch (e) {
        // 壞檔 / 加密 PDF → extractPdfFields 拋友善中文 Error。
        toast.error(
          e instanceof Error
            ? e.message
            : '無法讀取此 PDF，請確認係有效檔案。',
        )
        return
      }

      if (pdfFields.length === 0) {
        toast.error(
          '此 PDF 冇填寫欄位（需 fillable PDF 或改用 Word 範本）。',
        )
        return
      }

      const base64 = arrayBufferToBase64(buf)
      const baseName = file.name.replace(/\.pdf$/i, '')
      // PdfField → PdfPreviewField（tag=name、label 預設=name、帶 type/options/rects）。
      const previewFields: PdfPreviewField[] = pdfFields.map((f) => ({
        tag: f.name,
        label: f.name,
        type: f.type,
        ...(f.options ? { options: f.options } : {}),
        rects: f.rects,
      }))
      setPdf({ base64, fields: previewFields })
      setName((prev) => prev || baseName)
      setStep('pdf-preview')
    } catch {
      toast.error('讀取 PDF 失敗，請再試一次。')
    } finally {
      setBusy(false)
    }
  }

  // ── Word 管線（原邏輯，完全不變）──
  async function handleDocx(file: File) {
    if (file.size > MAX_DOCX_BYTES) {
      toast.error(
        `檔案太大（${(file.size / 1024 / 1024).toFixed(1)}MB），請用 1MB 以內嘅範本。`,
      )
      return
    }

    setBusy(true)
    try {
      const buf = await file.arrayBuffer()
      let tags: string[] = []
      try {
        tags = extractTags(buf)
      } catch (e) {
        // 壞檔 / 標籤錯（未閉合 {）→ docxtemplater 喺解析就拋。
        toast.error(
          e instanceof Error
            ? e.message
            : '無法讀取此範本，請確認係有效嘅 .docx 且 { } 成對。',
        )
        setBusy(false)
        return
      }

      const base64 = arrayBufferToBase64(buf)
      const baseName = file.name.replace(/\.docx$/i, '')
      setDocx({ base64, fileName: file.name })
      setName((prev) => prev || baseName)
      setExistingTags(tags)

      if (tags.length > 0) {
        // 已有標籤 → 直接入 TemplatePreview（既有 tag，anchor=''，全部 placed）。
        setPreviewFields(
          tags.map((tag) => ({
            tag,
            label: tag,
            type: 'text' as const,
            anchor: '',
          })),
        )
        setStep('preview')
      }
      // 冇標籤 → 留喺 upload step，顯示 AI 入口 / 手動引導。
    } catch {
      toast.error('讀取檔案失敗，請再試一次。')
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setDocx(null)
    setPdf(null)
    setName('')
    setExistingTags([])
    setPreviewFields([])
    setStep('upload')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── 撳「AI 識別欄位」→ 餵範本純文字畀 AI → autoTagFields 落原檔 → 入 TemplatePreview ──
  async function handleSuggest() {
    if (!docx) return
    setAiBusy(true)
    try {
      const buf = base64ToArrayBuffer(docx.base64)

      // 1. 結構偵測（免 AI、即時、對表格表單最準）。
      const fields: SuggestedField[] = detectTemplateFields(buf)
      const have = new Set(fields.map((f) => f.tag))

      // 2. AI 補充（best-effort）：接咗 AI 先試，補非表格 / inline 欄位；
      //    AI 失敗或截斷都唔阻 —— 已有結構偵測結果兜底。
      if (aiReady) {
        try {
          const ai = await suggestFields(extractText(buf))
          for (const s of ai) {
            if (!have.has(s.tag)) {
              have.add(s.tag)
              fields.push(s)
            }
          }
        } catch {
          /* AI 失敗唔阻流程 */
        }
      }

      if (fields.length === 0) {
        toast.error('偵測唔到欄位 —— 可喺 Word 將要填嘅位置改成 {標籤} 後重新上載。')
        return
      }

      // 同既有標籤去重（既有優先）。
      const seen = new Set(existingTags)
      const suggested = fields.filter((s) => {
        if (seen.has(s.tag)) return false
        seen.add(s.tag)
        return true
      })

      // ── 自動落標籤：inline（底線／空括號／冒號）＋ 表格格（label 格右鄰／
      //    下方空格）兩段式合併。安全：autoTagFields 內部各步重砌＋sanity，
      //    任何失敗只係「冇加到」、唔會整爛 docx。 ──
      let taggedBase64 = docx.base64
      try {
        const injected = autoTagFields(buf, suggested)
        taggedBase64 = injected.base64
      } catch {
        // 理論上 autoTagFields 唔會拋（內部保守）；萬一拋就退回原檔，
        // 仍可入 preview（已落標籤 = 0，全部靠 TemplatePreview 手動補）。
        taggedBase64 = docx.base64
      }

      // 已把標籤實際寫入 docx；故所有欄位 anchor 留空（TemplatePreview
      // 唔再重跑 inject，直接以 extractTags 判斷 placed / 未對應）。
      // 既有標籤（罕有同時有）放前。
      const merged: PreviewField[] = [
        ...existingTags.map((tag) => ({
          tag,
          label: tag,
          type: 'text' as const,
          anchor: '',
        })),
        ...suggested.map((s) => ({
          tag: s.tag,
          label: s.label || s.tag,
          type: s.type,
          anchor: '',
        })),
      ]

      // 用已落標籤嘅檔做 preview 來源（與儲存內容一致）。
      setDocx({ base64: taggedBase64, fileName: docx.fileName })
      setPreviewFields(merged)
      setStep('preview')
      toast.success(`偵測咗 ${suggested.length} 個欄位，請喺預覽核對。`)
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'AI 識別欄位失敗，請再試一次。',
      )
    } finally {
      setAiBusy(false)
    }
  }

  // ───────── step='pdf-preview'：交畀 PdfTemplatePreview（PDF 路徑，lazy）─────────
  if (step === 'pdf-preview' && pdf) {
    return (
      <Suspense
        fallback={
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 size={16} className="animate-spin" />
            載入 PDF 預覽中…
          </div>
        }
      >
        <PdfTemplatePreview
          originalBase64={pdf.base64}
          initialFields={pdf.fields}
          initialName={name}
          onBack={reset}
          onSaved={onSaved}
        />
      </Suspense>
    )
  }

  // ───────── step='preview'：交畀 TemplatePreview（docx 路徑）─────────
  if (step === 'preview' && docx) {
    return (
      <TemplatePreview
        originalBase64={docx.base64}
        initialFields={previewFields}
        initialName={name}
        onBack={reset}
        onSaved={onSaved}
      />
    )
  }

  // ───────── step='upload' ─────────
  const showAiEntry = !!docx && existingTags.length === 0

  return (
    <div className="space-y-5">
      {/* ───────── 上載區 ───────── */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx,.pdf"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
          }}
        />
        {!docx ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 px-6 py-10 text-center transition hover:border-accent hover:bg-accent-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800/40 dark:hover:border-accent"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
              <FileUp size={22} />
            </span>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {busy ? '讀取中…' : '揀範本（Word .docx 或 PDF .pdf）'}
            </span>
            <span className="max-w-xs text-xs text-slate-400 dark:text-slate-500">
              Word：自動認出 {'{標籤}'} 做欄位（認唔到可用 AI 識別）；PDF：直接讀出填寫欄位
            </span>
          </button>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                <FilePlus2 size={18} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                  {docx.fileName}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {existingTags.length > 0
                    ? `認到 ${existingTags.length} 個欄位`
                    : '未認到標籤'}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon={Trash2}
              onClick={reset}
              disabled={busy}
            >
              換檔
            </Button>
          </div>
        )}
      </div>

      {/* ───────── 認唔到標籤：引導 + AI 識別入口 ───────── */}
      {showAiEntry && (
        <>
          <div className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <CircleAlert size={18} className="mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">範本未見 {'{標籤}'}</p>
              <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-300/90">
                你可以撳下面「自動偵測欄位」由表格結構自動標出填寫位置（免 AI）；或喺 Word
                入面將要填嘅位置改成大括號標籤（例如{' '}
                <code className="rounded bg-amber-100 px-1 py-0.5 font-mono dark:bg-amber-500/20">
                  {'{學生姓名}'}
                </code>
                ）後重新上載。手動 {'{標籤}'} 永遠最可靠。
              </p>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-accent/20 bg-accent-soft/40 p-3.5 dark:border-accent/25 dark:bg-accent/10">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white">
                <Sparkles size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  自動偵測欄位
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  由表格結構自動標出要填欄位（免 AI、即時）；接咗 AI 仲會補充非表格欄位。再喺視覺化預覽核對與調整。
                </p>
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              icon={Wand2}
              loading={aiBusy}
              onClick={handleSuggest}
              disabled={aiBusy}
            >
              {aiBusy ? '偵測中…' : '自動偵測欄位'}
            </Button>
            {!aiReady && (
              <p className="text-xs leading-relaxed text-slate-400 dark:text-slate-500">
                {!isAIConfigured
                  ? '（未接 AI：表格結構偵測照用；AI 補充非表格欄位則需設定 Supabase + gemini）'
                  : '（未登入：表格結構偵測照用；登入後 AI 會補充非表格欄位）'}
              </p>
            )}
          </div>
        </>
      )}

      {/* ───────── 動作列（upload step 只有取消；預覽／儲存在 TemplatePreview）───────── */}
      <div className="flex justify-end border-t border-slate-200 pt-4 dark:border-slate-700">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          取消
        </Button>
      </div>
    </div>
  )
}
