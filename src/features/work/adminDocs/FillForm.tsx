import { useEffect, useRef, useState } from 'react'
import { Button, Field, Input, Select, Textarea } from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { useAuth } from '../../../context/AuthContext'
import { isAIConfigured } from '../../../lib/aiClient'
import { base64ToArrayBuffer, fillDocx } from './docxEngine'
import { draftContent } from './docxAi'
import { fillPdf } from './pdfEngine'
import { templateKind, type AdminDocTemplate } from './adminDocStore'
import {
  Download,
  FileCheck2,
  Eye,
  Loader2,
  Sparkles,
  Wand2,
} from 'lucide-react'

// ============================================================
//  行政文件 — 填寫表單 + 預覽 + 下載
//  ------------------------------------------------------------
//  dispatcher：按 template.kind 分支 —— 'pdf' 走 FillFormPdf（fillPdf + pdf.js
//  預覽 + 下載 .pdf）；'docx' / 缺省走 FillFormDocx（原邏輯，完全不變）。
// ============================================================

export default function FillForm({
  template,
  onBack,
}: {
  template: AdminDocTemplate
  onBack: () => void
}) {
  if (templateKind(template) === 'pdf') {
    return <FillFormPdf template={template} onBack={onBack} />
  }
  return <FillFormDocx template={template} onBack={onBack} />
}

// ============================================================
//  Word 填寫（Phase 1 + Phase 2 AI 草擬）— 原邏輯，完全不變
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

function FillFormDocx({
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
  // 輸出文件標題（= 下載檔名）；預設 = 範本名，可逐次自訂。
  const [docTitle, setDocTitle] = useState(template.name)
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
    setDocTitle(template.name)
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
    // 必填提示：漏填欄位 docxtemplater 會靜默留空白，故喺度主動提醒（唔阻生成）。
    const empties = template.fields.filter((f) => !(values[f.tag] ?? '').trim())
    if (empties.length > 0) {
      const names = empties.map((f) => f.label || f.tag).slice(0, 5).join('、')
      toast.info(
        `文件已生成 — ⚠ 有 ${empties.length} 個欄位未填，會留空白：${names}${empties.length > 5 ? ' …' : ''}`,
      )
    } else {
      toast.success('文件已生成，可預覽核對或下載。')
    }
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
    const safeName =
      sanitizeFileName(docTitle) || sanitizeFileName(template.name) || '文件'
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
        <Field
          label="文件標題"
          hint="即下載檔名；預設用範本名，可自訂（例：家長通知書_5A_6月20日）"
        >
          <Input
            value={docTitle}
            onChange={(e) => setDocTitle(e.target.value)}
            placeholder={template.name}
          />
        </Field>
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

// ============================================================
//  PDF 填寫（kind='pdf'）— fillPdf + pdf.js 預覽 + 下載 .pdf
//  ------------------------------------------------------------
//  按 template.fields 出表單：
//    text → Input、multiline → Textarea、checkbox → 切換、
//    dropdown → Select（用 field.options；空選項退 Input）。
//  「生成 PDF」→ fillPdf（async）→ Blob：
//    (a) renderPdfWithFieldBoxes 渲染填好版入預覽（失敗只警告、唔阻下載）；
//    (b)「下載 PDF」Blob→anchor download（檔名 = 標題.pdf）。
//  fillPdf 拋錯 → toast.error。版面 100% 保留（唔 flatten）。
//  ⚠️ docx 路徑（FillFormDocx）完全獨立、不受影響。
// ============================================================

// checkbox「勾」時寫入嘅值（對齊 pdfEngine 嘅 TRUTHY，'yes' 屬之）。
const CHECKBOX_ON = 'yes'
const CHECKBOX_OFF = 'no'

function FillFormPdf({
  template,
  onBack,
}: {
  template: AdminDocTemplate
  onBack: () => void
}) {
  const toast = useToast()
  const previewRef = useRef<HTMLDivElement>(null)

  // 各欄位值（key = tag = PDF field name）。checkbox 預設未勾。
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      template.fields.map((f) => [
        f.tag,
        f.type === 'checkbox' ? CHECKBOX_OFF : '',
      ]),
    ),
  )
  const [docTitle, setDocTitle] = useState(template.name)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [generating, setGenerating] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [previewFailed, setPreviewFailed] = useState(false)

  // 換範本 → 清空狀態（host 通常 remount，仍保險）。
  useEffect(() => {
    setValues(
      Object.fromEntries(
        template.fields.map((f) => [
          f.tag,
          f.type === 'checkbox' ? CHECKBOX_OFF : '',
        ]),
      ),
    )
    setDocTitle(template.name)
    setBlob(null)
    setPreviewFailed(false)
    if (previewRef.current) previewRef.current.innerHTML = ''
  }, [template.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function invalidateOutput() {
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
      outBlob = await fillPdf(buf, values)
    } catch (e) {
      // fillPdf 拋友善 Error（壞檔 / 加密 / 儲存失敗）。
      toast.error(
        e instanceof Error ? e.message : '生成 PDF 失敗，請重新上載範本後再試。',
      )
      setGenerating(false)
      return
    }
    setBlob(outBlob)

    // 必填提示：漏填欄位會留空（checkbox 唔計）；主動提醒，唔阻生成。
    const empties = template.fields.filter(
      (f) => f.type !== 'checkbox' && !(values[f.tag] ?? '').trim(),
    )
    if (empties.length > 0) {
      const names = empties.map((f) => f.label || f.tag).slice(0, 5).join('、')
      toast.info(
        `PDF 已生成 — ⚠ 有 ${empties.length} 個欄位未填，會留空白：${names}${empties.length > 5 ? ' …' : ''}`,
      )
    } else {
      toast.success('PDF 已生成，可預覽核對或下載。')
    }
    setGenerating(false)

    // 預覽係輔助：render 失敗只警告、唔阻下載。
    void renderFilledPreview(outBlob)
  }

  // 用 pdf.js 渲染「填好版」PDF（唔疊欄位框，純睇結果）。
  async function renderFilledPreview(b: Blob) {
    const container = previewRef.current
    if (!container) return
    setPreviewing(true)
    setPreviewFailed(false)
    container.innerHTML = ''
    try {
      // 動態 import：pdfjs-dist 體積大 + 依賴瀏覽器 API（DOMMatrix / canvas），
      // 到要預覽先載 —— 令 pdfjs 唔入 feature 模組圖（preloadAllFeatures / SSR 安全）。
      const { renderPdfWithFieldBoxes } = await import('./pdfPreview')
      const buf = await b.arrayBuffer()
      // 傳空欄位陣列 + 空色表 → 只渲染頁面、唔疊彩色框（填好嘅值已喺頁面上）。
      await renderPdfWithFieldBoxes(container, buf, [], new Map())
    } catch {
      setPreviewFailed(true)
      container.innerHTML = ''
    } finally {
      setPreviewing(false)
    }
  }

  function handleDownload() {
    if (!blob) return
    const safeName =
      sanitizeFileName(docTitle) || sanitizeFileName(template.name) || '文件'
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${safeName}.pdf`
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="space-y-5">
      {/* ───────── 說明 ───────── */}
      <div className="flex items-start gap-2.5 rounded-xl border border-accent/20 bg-accent-soft/40 px-3.5 py-3 text-sm text-slate-600 dark:border-accent/25 dark:bg-accent/10 dark:text-slate-300">
        <FileCheck2 size={16} className="mt-0.5 shrink-0 text-accent" />
        <p className="leading-relaxed">
          逐欄填寫後撳「生成 PDF」，系統會將內容填入原 PDF 表單，
          <span className="font-medium text-accent-strong dark:text-accent">
            版面原樣保留
          </span>
          ，可預覽核對再下載。
        </p>
      </div>

      {/* ───────── 表單：逐欄輸入（按 PDF 欄位類型）───────── */}
      <div className="space-y-4">
        <Field
          label="文件標題"
          hint="即下載檔名；預設用範本名，可自訂（例：學生資料表_5A_陳大文）"
        >
          <Input
            value={docTitle}
            onChange={(e) => setDocTitle(e.target.value)}
            placeholder={template.name}
          />
        </Field>

        {template.fields.map((f) => {
          const label = f.label || f.tag
          // checkbox：標題列右側放切換，唔用 Field 包（自有 layout）。
          if (f.type === 'checkbox') {
            const checked = isCheckboxOn(values[f.tag])
            return (
              <div
                key={f.tag}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 dark:border-slate-700 dark:bg-slate-800"
              >
                <span className="min-w-0 text-sm font-medium text-slate-700 dark:text-slate-200">
                  {label}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={checked}
                  aria-label={label}
                  onClick={() =>
                    setVal(f.tag, checked ? CHECKBOX_OFF : CHECKBOX_ON)
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                    checked
                      ? 'bg-accent'
                      : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                      checked ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            )
          }

          return (
            <Field key={f.tag} label={label}>
              {f.type === 'multiline' ? (
                <Textarea
                  value={values[f.tag] ?? ''}
                  onChange={(e) => setVal(f.tag, e.target.value)}
                  placeholder={`請輸入${label}`}
                  rows={3}
                />
              ) : f.type === 'dropdown' ? (
                f.options && f.options.length > 0 ? (
                  <Select
                    value={values[f.tag] ?? ''}
                    onChange={(e) => setVal(f.tag, e.target.value)}
                  >
                    <option value="">— 請選擇 —</option>
                    {f.options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </Select>
                ) : (
                  // 下拉但冇選項（罕有）→ 退純文字輸入。
                  <Input
                    value={values[f.tag] ?? ''}
                    onChange={(e) => setVal(f.tag, e.target.value)}
                    placeholder={`請輸入${label}`}
                  />
                )
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
                  placeholder={`請輸入${label}`}
                />
              )}
            </Field>
          )
        })}
      </div>

      {/* ───────── 動作列 ───────── */}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
        <Button variant="secondary" onClick={onBack}>
          返回範本庫
        </Button>
        <div className="flex-1" />
        <Button onClick={handleGenerate} loading={generating} icon={FileCheck2}>
          生成 PDF
        </Button>
        <Button
          variant={blob ? 'primary' : 'secondary'}
          onClick={handleDownload}
          disabled={!blob}
          icon={Download}
        >
          下載 PDF
        </Button>
      </div>

      {/* ───────── 預覽區（生成後出現）───────── */}
      {blob && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
            <Eye size={13} className="text-accent" />
            預覽（填好版；最終以 PDF 開啟為準）
          </p>

          {previewFailed && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              預覽未能載入，但 PDF 已生成 —— 仍可按「下載 PDF」開啟核對。
            </div>
          )}

          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900/40">
            {previewing && (
              <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-white/70 text-sm text-slate-500 backdrop-blur-sm dark:bg-slate-900/60 dark:text-slate-400">
                <Loader2 size={16} className="animate-spin" />
                載入預覽中…
              </div>
            )}
            <div
              ref={previewRef}
              className="max-h-[60vh] overflow-auto p-2 sm:p-3"
            />
          </div>
        </div>
      )}
    </div>
  )
}

/** checkbox 值是否「已勾」（對齊 pdfEngine TRUTHY 子集，足夠 UI 用）。 */
function isCheckboxOn(v: string | undefined): boolean {
  if (!v) return false
  return ['yes', 'true', '1', 'on'].includes(v.trim().toLowerCase())
}
