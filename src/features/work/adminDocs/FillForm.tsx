import { useEffect, useRef, useState } from 'react'
import { Button, Field, Input, Textarea } from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { useAuth } from '../../../context/AuthContext'
import { isAIConfigured } from '../../../lib/aiClient'
import { base64ToArrayBuffer, fillDocx } from './docxEngine'
import { draftContent } from './docxAi'
import type { AdminDocTemplate } from './adminDocStore'
import {
  Download,
  FileCheck2,
  Eye,
  Loader2,
  Sparkles,
  Wand2,
} from 'lucide-react'

// ============================================================
//  行政文件 — 填寫表單 + 預覽 + 下載（Phase 1 + Phase 2 AI 草擬）
//  ------------------------------------------------------------
//  按 template.fields 出表單（text=Input / multiline=Textarea / date=date）
//  →「生成文件」fillDocx → Blob：
//    (a) docx-preview renderAsync 入預覽容器（失敗只警告、唔阻下載）；
//    (b)「下載 .docx」Blob→anchor download（檔名 = 範本名.docx）。
//  fillDocx 拋錯 → toast.error。
//  Phase 2：「AI 草擬內容」—— 輸入指示（如「家長通知：下週三停課」）→
//  draftContent 餵欄位 label + 指示 → 回 { tag: 內容 } 填入表單（可再改）。
//  ⚠️ AI 草擬只填空欄，唔覆蓋用戶已填內容；未接 AI 時 gate 住、Phase 1
//  手動填寫不受影響。
// ============================================================

export default function FillForm({
  template,
  onBack,
}: {
  template: AdminDocTemplate
  onBack: () => void
}) {
  const toast = useToast()
  const { user } = useAuth()
  const previewRef = useRef<HTMLDivElement>(null)

  // 各欄位值（key = tag）。
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(template.fields.map((f) => [f.tag, ''])),
  )
  // 已生成嘅 Blob（畀下載用）。
  const [blob, setBlob] = useState<Blob | null>(null)
  const [generating, setGenerating] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [previewFailed, setPreviewFailed] = useState(false)

  // ── Phase 2 AI 草擬狀態 ──
  const [aiOpen, setAiOpen] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [drafting, setDrafting] = useState(false)

  const aiReady = isAIConfigured && !!user

  // 換範本（理論上 host 會 remount，但保險）→ 清空狀態。
  useEffect(() => {
    setValues(Object.fromEntries(template.fields.map((f) => [f.tag, ''])))
    setBlob(null)
    setPreviewFailed(false)
    setAiOpen(false)
    setInstruction('')
    if (previewRef.current) previewRef.current.innerHTML = ''
  }, [template.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function invalidateOutput() {
    // 改咗欄位 → 舊預覽 / Blob 過時，清走以免下載到舊版。
    if (blob) {
      setBlob(null)
      if (previewRef.current) previewRef.current.innerHTML = ''
      setPreviewFailed(false)
    }
  }

  function setVal(tag: string, v: string) {
    setValues((prev) => ({ ...prev, [tag]: v }))
    invalidateOutput()
  }

  async function handleGenerate() {
    setGenerating(true)
    let outBlob: Blob
    try {
      const buf = base64ToArrayBuffer(template.base64)
      outBlob = fillDocx(buf, values)
    } catch (e) {
      // fillDocx 拋友善 Error（標籤錯 / 壞檔）。
      toast.error(
        e instanceof Error ? e.message : '生成文件失敗，請檢查範本標籤。',
      )
      setGenerating(false)
      return
    }
    setBlob(outBlob)
    toast.success('文件已生成，可預覽核對或下載。')
    setGenerating(false)

    // 預覽係輔助：render 失敗只警告、唔阻下載。
    void renderPreview(outBlob)
  }

  // ── Phase 2：AI 草擬內容 → 填入表單（只填空欄，唔覆蓋已填）──
  async function handleDraft() {
    if (!aiReady) return
    if (!instruction.trim()) {
      toast.error('請先輸入草擬指示，例如：家長通知，下週三因校舍維修停課。')
      return
    }
    setDrafting(true)
    try {
      const result = await draftContent(template.fields, instruction)
      const keys = Object.keys(result).filter((k) => result[k]?.trim())
      if (keys.length === 0) {
        toast.info('AI 暫時草擬唔到內容，可改下指示再試，或自行輸入。')
        return
      }
      // 只填「目前空白」嘅欄位，保留用戶已輸入內容。
      let filled = 0
      setValues((prev) => {
        const next = { ...prev }
        for (const k of keys) {
          if (k in next && !(next[k] ?? '').trim()) {
            next[k] = result[k]
            filled++
          }
        }
        return next
      })
      invalidateOutput()
      if (filled > 0) {
        toast.success(`AI 已草擬 ${filled} 個欄位，可再修改後生成文件。`)
      } else {
        toast.info('相關欄位你已填咗內容，AI 冇覆蓋。可清空欄位再草擬。')
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'AI 草擬失敗，請再試一次。',
      )
    } finally {
      setDrafting(false)
    }
  }

  async function renderPreview(b: Blob) {
    const container = previewRef.current
    if (!container) return
    setPreviewing(true)
    setPreviewFailed(false)
    container.innerHTML = ''
    try {
      // 動態 import：docx-preview 體積較大，到要預覽先載。
      const { renderAsync } = await import('docx-preview')
      await renderAsync(b, container)
    } catch {
      setPreviewFailed(true)
      container.innerHTML = ''
    } finally {
      setPreviewing(false)
    }
  }

  function handleDownload() {
    if (!blob) return
    const safeName = sanitizeFileName(template.name) || '文件'
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${safeName}.docx`
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    // 釋放：畀瀏覽器完成下載後 revoke。
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="space-y-5">
      {/* ───────── Phase 2：AI 草擬內容 ───────── */}
      <div className="rounded-xl border border-accent/20 bg-accent-soft/40 dark:border-accent/25 dark:bg-accent/10">
        <button
          type="button"
          onClick={() => setAiOpen((o) => !o)}
          className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          aria-expanded={aiOpen}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white">
            <Sparkles size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              AI 草擬內容
            </span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              講低要寫乜，AI 幫你填好各欄（只填空欄，可再改）
            </span>
          </span>
          <span className="text-xs font-medium text-accent">
            {aiOpen ? '收起' : '展開'}
          </span>
        </button>

        {aiOpen && (
          <div className="space-y-3 border-t border-accent/15 px-3.5 pb-3.5 pt-3 dark:border-accent/20">
            {aiReady ? (
              <>
                <Field label="草擬指示">
                  <Textarea
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    placeholder="例如：家長通知，下週三（6 月 10 日）因校舍維修全日停課，請家長安排照顧。"
                    rows={3}
                    disabled={drafting}
                  />
                </Field>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    icon={Wand2}
                    loading={drafting}
                    onClick={handleDraft}
                    disabled={drafting || !instruction.trim()}
                  >
                    {drafting ? 'AI 草擬中…' : 'AI 草擬'}
                  </Button>
                </div>
              </>
            ) : (
              <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                {!isAIConfigured
                  ? 'AI 助手未啟用（需設定 Supabase + 部署 gemini Edge Function，見 docs/SETUP.md）。你仍可直接逐欄手動填寫。'
                  : '請先喺左下角用 Google 登入，先可以用 AI 草擬。手動填寫不受影響。'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ───────── 表單：逐欄輸入 ───────── */}
      <div className="space-y-4">
        {template.fields.map((f) => (
          <Field key={f.tag} label={f.label || f.tag}>
            {f.type === 'multiline' ? (
              <Textarea
                value={values[f.tag] ?? ''}
                onChange={(e) => setVal(f.tag, e.target.value)}
                placeholder={`請輸入${f.label || f.tag}`}
                rows={3}
              />
            ) : f.type === 'date' ? (
              <Input
                type="date"
                value={values[f.tag] ?? ''}
                onChange={(e) => setVal(f.tag, e.target.value)}
              />
            ) : (
              <Input
                value={values[f.tag] ?? ''}
                onChange={(e) => setVal(f.tag, e.target.value)}
                placeholder={`請輸入${f.label || f.tag}`}
              />
            )}
          </Field>
        ))}
      </div>

      {/* ───────── 動作列 ───────── */}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
        <Button variant="secondary" onClick={onBack}>
          返回範本庫
        </Button>
        <div className="flex-1" />
        <Button
          onClick={handleGenerate}
          loading={generating}
          icon={FileCheck2}
        >
          生成文件
        </Button>
        <Button
          variant={blob ? 'primary' : 'secondary'}
          onClick={handleDownload}
          disabled={!blob}
          icon={Download}
        >
          下載 .docx
        </Button>
      </div>

      {/* ───────── 預覽區（生成後出現）───────── */}
      {blob && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
            <Eye size={13} className="text-accent" />
            預覽（近似核對；最終格式以 Word 開啟為準）
          </p>

          {previewFailed && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              預覽未能載入，但文件已生成 —— 仍可按「下載 .docx」用 Word 開啟核對。
            </div>
          )}

          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900/40">
            {previewing && (
              <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-white/70 text-sm text-slate-500 backdrop-blur-sm dark:bg-slate-900/60 dark:text-slate-400">
                <Loader2 size={16} className="animate-spin" />
                載入預覽中…
              </div>
            )}
            {/* docx-preview 會將文件渲染入此容器；自身有頁面樣式，畀佢捲動。 */}
            <div
              ref={previewRef}
              className="admin-doc-preview max-h-[60vh] overflow-auto p-3 sm:p-4"
            />
          </div>
        </div>
      )}
    </div>
  )
}

/** 去掉檔名非法字元（Windows / 通用），保留中英數字與常見符號。 */
function sanitizeFileName(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
}
