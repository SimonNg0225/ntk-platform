import { useRef, useState } from 'react'
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
import { suggestFields } from './docxAi'
import { autoTagFields } from './docxTableInject'
import TemplatePreview, { type PreviewField } from './TemplatePreview'
import {
  FileUp,
  FilePlus2,
  CircleAlert,
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
const MAX_DOCX_BYTES = 1_000_000 // ~1MB 原始檔

type Step = 'upload' | 'preview'

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
  // 預填範本名（去 .docx 副檔名）。
  const [name, setName] = useState('')
  // 既有標籤（extractTags 認到）；用嚟「已有標籤 → 直接預覽」。
  const [existingTags, setExistingTags] = useState<string[]>([])
  // 入 TemplatePreview 嘅初始欄位（既有 / AI 建議）。
  const [previewFields, setPreviewFields] = useState<PreviewField[]>([])
  const [busy, setBusy] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)

  const aiReady = isAIConfigured && !!user

  async function handleFile(file: File) {
    // 副檔名 / MIME 友善檢查（accept 已限，仍防手動拖入）。
    const isDocx =
      file.name.toLowerCase().endsWith('.docx') ||
      file.type ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    if (!isDocx) {
      toast.error('請揀 .docx 檔（Word 文件）。舊 .doc / PDF 暫不支援。')
      return
    }
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
    setName('')
    setExistingTags([])
    setPreviewFields([])
    setStep('upload')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── 撳「AI 識別欄位」→ 餵範本純文字畀 AI → autoTagFields 落原檔 → 入 TemplatePreview ──
  async function handleSuggest() {
    if (!docx || !aiReady) return
    setAiBusy(true)
    try {
      const buf = base64ToArrayBuffer(docx.base64)
      const text = extractText(buf)
      const result = await suggestFields(text)
      if (result.length === 0) {
        toast.error('AI 暫時建議唔到欄位，可手動喺 Word 加 {標籤} 後重新上載。')
        return
      }

      // AI 建議去重（同既有標籤合併，既有優先）。
      const seen = new Set(existingTags)
      const suggested = result.filter((s) => {
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
      toast.success(`AI 識別咗 ${result.length} 個欄位，請喺預覽核對。`)
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'AI 識別欄位失敗，請再試一次。',
      )
    } finally {
      setAiBusy(false)
    }
  }

  // ───────── step='preview'：交畀 TemplatePreview ─────────
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
          accept=".docx"
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
              {busy ? '讀取中…' : '揀 Word 範本（.docx）'}
            </span>
            <span className="max-w-xs text-xs text-slate-400 dark:text-slate-500">
              系統會自動認出範本入面嘅 {'{標籤}'} 做填寫欄位；認唔到可用 AI 識別
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
                你可以撳下面「AI 識別欄位」自動分析範本、視覺化標出填寫位置；或喺 Word
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
                  AI 識別欄位
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  由 AI 分析範本內容、自動標出要填嘅欄位，再喺視覺化預覽核對與調整。
                </p>
              </div>
            </div>

            {aiReady ? (
              <Button
                variant="secondary"
                size="sm"
                icon={Wand2}
                loading={aiBusy}
                onClick={handleSuggest}
                disabled={aiBusy}
              >
                {aiBusy ? 'AI 分析中…' : 'AI 識別欄位'}
              </Button>
            ) : (
              <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                {!isAIConfigured
                  ? 'AI 助手未啟用（需設定 Supabase + 部署 gemini Edge Function，見 docs/SETUP.md）。你仍可喺 Word 手動加 {標籤} 後重新上載。'
                  : '請先喺左下角用 Google 登入，先可以用 AI 識別欄位。手動加 {標籤} 亦可。'}
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
