import { useRef, useState } from 'react'
import { Button, Field, Input, Select } from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { useAuth } from '../../../context/AuthContext'
import { isAIConfigured } from '../../../lib/aiClient'
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  extractTags,
  extractText,
} from './docxEngine'
import {
  injectTags,
  suggestFields,
  type SuggestedField,
} from './docxAi'
import { addTemplate, type AdminDocFieldType } from './adminDocStore'
import {
  FileUp,
  FilePlus2,
  Tag,
  Trash2,
  CircleAlert,
  Sparkles,
  Check,
  X,
  Wand2,
} from 'lucide-react'

// ============================================================
//  行政文件 — 上載 .docx 範本（Phase 1 + Phase 2 AI 輔助）
//  ------------------------------------------------------------
//  流程：揀 .docx → file.arrayBuffer() → extractTags 認 {標籤}
//  → 逐個標籤確認（tag 唯讀 / label 可改 / type 揀）+ 範本名
//  → addTemplate（base64 + fields）。
//  Phase 2：認到標籤少／冇 → 可撳「AI 建議欄位」→ suggestFields →
//  逐項接受／改／棄；接受時 best-effort injectTags 自動加 {標籤}（保守、
//  做唔到就提示手動加）。⚠️ 手動 {標籤} 永遠係可靠後路。
// ============================================================

// 單個範本大小 guard（base64 後 ~1.33×；localStorage 通常 ~5MB / origin）。
const MAX_DOCX_BYTES = 1_000_000 // ~1MB 原始檔

const FIELD_TYPE_OPTIONS: { value: AdminDocFieldType; label: string }[] = [
  { value: 'text', label: '單行文字' },
  { value: 'multiline', label: '多行文字' },
  { value: 'date', label: '日期' },
]

interface DraftField {
  tag: string
  label: string
  type: AdminDocFieldType
}

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

  // 上載到嘅檔（base64 + 原檔名），未揀 = null。
  const [docx, setDocx] = useState<{ base64: string; fileName: string } | null>(
    null,
  )
  const [name, setName] = useState('')
  const [fields, setFields] = useState<DraftField[]>([])
  // 已解析但「認唔到標籤」→ true（顯示引導文案）。
  const [parsedNoTags, setParsedNoTags] = useState(false)
  const [busy, setBusy] = useState(false)

  // ── Phase 2 AI 建議欄位狀態 ──
  const [aiBusy, setAiBusy] = useState(false)
  // AI 建議（未接受）：逐項可改／接受／棄。
  const [suggestions, setSuggestions] = useState<SuggestedField[]>([])
  // 已試過 AI 建議（用嚟調文案：第二次撳係「重新建議」）。
  const [suggested, setSuggested] = useState(false)

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
      // 預填範本名 = 去 .docx 副檔名嘅檔名。
      const baseName = file.name.replace(/\.docx$/i, '')
      setDocx({ base64, fileName: file.name })
      setName((prev) => prev || baseName)
      setFields(
        tags.map((tag) => ({ tag, label: tag, type: 'text' as const })),
      )
      setParsedNoTags(tags.length === 0)
      // 換檔 → 清走上一份嘅 AI 建議狀態。
      setSuggestions([])
      setSuggested(false)
    } catch {
      toast.error('讀取檔案失敗，請再試一次。')
    } finally {
      setBusy(false)
    }
  }

  function updateField(tag: string, patch: Partial<DraftField>) {
    setFields((prev) =>
      prev.map((f) => (f.tag === tag ? { ...f, ...patch } : f)),
    )
  }

  function removeField(tag: string) {
    setFields((prev) => prev.filter((f) => f.tag !== tag))
  }

  function reset() {
    setDocx(null)
    setName('')
    setFields([])
    setParsedNoTags(false)
    setSuggestions([])
    setSuggested(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Phase 2：撳「AI 建議欄位」→ 餵範本純文字畀 AI ──
  async function handleSuggest() {
    if (!docx || !aiReady) return
    setAiBusy(true)
    try {
      const buf = base64ToArrayBuffer(docx.base64)
      const text = extractText(buf)
      const result = await suggestFields(text)
      if (result.length === 0) {
        toast.error('AI 暫時建議唔到欄位，可手動喺 Word 加 {標籤} 後重新上載。')
        setSuggested(true)
        return
      }
      // 已存在（已認到 / 已接受）嘅 tag 唔再重複建議。
      const existing = new Set(fields.map((f) => f.tag))
      const fresh = result.filter((s) => !existing.has(s.tag))
      if (fresh.length === 0) {
        toast.info('AI 建議嘅欄位都已經喺清單入面喇。')
      } else {
        setSuggestions(fresh)
        toast.success(`AI 建議咗 ${fresh.length} 個欄位，請逐項確認。`)
      }
      setSuggested(true)
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'AI 建議欄位失敗，請再試一次。',
      )
    } finally {
      setAiBusy(false)
    }
  }

  function updateSuggestion(tag: string, patch: Partial<SuggestedField>) {
    setSuggestions((prev) =>
      prev.map((s) => (s.tag === tag ? { ...s, ...patch } : s)),
    )
  }

  function dismissSuggestion(tag: string) {
    setSuggestions((prev) => prev.filter((s) => s.tag !== tag))
  }

  // 接受一個建議欄位：加入 fields，並 best-effort 試喺 docx 自動加 {tag}。
  function acceptSuggestion(s: SuggestedField) {
    if (!docx) return
    const tag = s.tag.trim()
    if (!tag) return
    if (fields.some((f) => f.tag === tag)) {
      toast.info('呢個標籤已經喺清單。')
      dismissSuggestion(s.tag)
      return
    }

    // best-effort 自動加標籤（保守；做唔到就提示手動加）。
    let injectedOk = false
    if (s.anchor) {
      try {
        const buf = base64ToArrayBuffer(docx.base64)
        const res = injectTags(buf, [{ tag, anchor: s.anchor }])
        if (res.injected.includes(tag)) {
          setDocx({ ...docx, base64: res.base64 })
          injectedOk = true
        }
      } catch {
        injectedOk = false
      }
    }

    setFields((prev) => [
      ...prev,
      { tag, label: s.label.trim() || tag, type: s.type },
    ])
    setParsedNoTags(false)
    dismissSuggestion(s.tag)

    if (injectedOk) {
      toast.success(`已加入「${s.label || tag}」並自動寫入範本 {${tag}}。`)
    } else {
      toast.info(
        `已加入欄位「${s.label || tag}」。請喺 Word 範本對應位置加上 {${tag}}（自動加唔到，手動最可靠）。`,
      )
    }
  }

  // 全部接受（逐個行 acceptSuggestion 嘅邏輯，但合併寫檔減少重砌）。
  function acceptAll() {
    if (!docx || suggestions.length === 0) return
    const existing = new Set(fields.map((f) => f.tag))
    const toAdd = suggestions.filter(
      (s) => s.tag.trim() && !existing.has(s.tag.trim()),
    )
    if (toAdd.length === 0) {
      setSuggestions([])
      return
    }

    // 一次過 inject（保守、合併寫檔）。
    let injectedSet = new Set<string>()
    let nextBase64 = docx.base64
    try {
      const buf = base64ToArrayBuffer(docx.base64)
      const res = injectTags(
        buf,
        toAdd
          .filter((s) => s.anchor)
          .map((s) => ({ tag: s.tag.trim(), anchor: s.anchor })),
      )
      injectedSet = new Set(res.injected)
      if (res.injected.length > 0) nextBase64 = res.base64
    } catch {
      injectedSet = new Set()
    }

    setDocx({ ...docx, base64: nextBase64 })
    setFields((prev) => [
      ...prev,
      ...toAdd.map((s) => ({
        tag: s.tag.trim(),
        label: s.label.trim() || s.tag.trim(),
        type: s.type,
      })),
    ])
    setParsedNoTags(false)
    setSuggestions([])

    const manual = toAdd.filter((s) => !injectedSet.has(s.tag.trim())).length
    if (manual === 0) {
      toast.success(`已接受 ${toAdd.length} 個欄位並自動寫入範本標籤。`)
    } else {
      toast.info(
        `已接受 ${toAdd.length} 個欄位；其中 ${manual} 個未能自動加標籤，請喺 Word 對應位置手動加 {標籤}。`,
      )
    }
  }

  function handleSave() {
    if (!docx) return
    const trimmedName = name.trim()
    if (!trimmedName) {
      toast.error('請輸入範本名稱。')
      return
    }
    if (fields.length === 0) {
      toast.error('此範本未見任何 {標籤}，請喺 Word 加標籤後重新上載。')
      return
    }
    setBusy(true)
    try {
      addTemplate({
        name: trimmedName,
        base64: docx.base64,
        fields: fields.map((f) => ({
          tag: f.tag,
          label: f.label.trim() || f.tag,
          type: f.type,
        })),
      })
      toast.success(`範本「${trimmedName}」已儲存 🎉`)
      onSaved()
    } catch (e) {
      // adminDocStore.persist 滿配額會拋友善 Error。
      toast.error(
        e instanceof Error ? e.message : '儲存失敗，請刪除舊範本後再試。',
      )
    } finally {
      setBusy(false)
    }
  }

  // 標籤少／冇 → 顯示 AI 建議入口（少：≤2 個亦可補；冇：主推）。
  const showAiEntry = !!docx && fields.length <= 2

  return (
    <div className="space-y-5">
      {/* ───────── 上載區（未揀檔 / 已揀檔都顯示，方便換檔）───────── */}
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
              系統會自動認出範本入面嘅 {'{標籤}'} 做填寫欄位
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
                  {fields.length > 0
                    ? `認到 ${fields.length} 個欄位`
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

      {/* ───────── 認唔到標籤：引導去 Word 加 + AI 建議入口 ───────── */}
      {docx && parsedNoTags && (
        <div className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <CircleAlert size={18} className="mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium">範本未見 {'{標籤}'}</p>
            <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-300/90">
              你可以撳下面「AI 建議欄位」自動分析範本，或喺 Word 入面將要填嘅位置改成大括號標籤（例如{' '}
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono dark:bg-amber-500/20">
                {'{學生姓名}'}
              </code>
              、
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono dark:bg-amber-500/20">
                {'{日期}'}
              </code>
              ）後重新上載。手動 {'{標籤}'} 永遠最可靠。
            </p>
          </div>
        </div>
      )}

      {/* ───────── Phase 2：AI 建議欄位入口 ───────── */}
      {showAiEntry && (
        <div className="space-y-3 rounded-xl border border-accent/20 bg-accent-soft/40 p-3.5 dark:border-accent/25 dark:bg-accent/10">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white">
              <Sparkles size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                AI 建議欄位
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {fields.length === 0
                  ? '範本未認到標籤，可由 AI 分析內容、建議要填嘅欄位，並嘗試自動加 {標籤}。'
                  : '認到嘅標籤較少，可由 AI 幫手補建議其他欄位。'}
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
              {aiBusy
                ? 'AI 分析中…'
                : suggested
                  ? '重新建議欄位'
                  : 'AI 建議欄位'}
            </Button>
          ) : (
            <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              {!isAIConfigured
                ? 'AI 助手未啟用（需設定 Supabase + 部署 gemini Edge Function，見 docs/SETUP.md）。你仍可喺 Word 手動加 {標籤} 後重新上載。'
                : '請先喺左下角用 Google 登入，先可以用 AI 建議欄位。手動加 {標籤} 亦可。'}
            </p>
          )}

          {/* AI 建議清單（逐項接受／改／棄） */}
          {suggestions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  AI 建議（共 {suggestions.length} 個，請確認）
                </p>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={acceptAll}>
                    全部接受
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSuggestions([])}
                  >
                    全部略過
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {suggestions.map((s) => (
                  <div
                    key={s.tag}
                    className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800"
                  >
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_110px] sm:items-end">
                      <Field label="標籤">
                        <Input
                          value={s.tag}
                          onChange={(e) =>
                            updateSuggestion(s.tag, { tag: e.target.value })
                          }
                          className="font-mono"
                          maxLength={40}
                        />
                      </Field>
                      <Field label="顯示名稱">
                        <Input
                          value={s.label}
                          onChange={(e) =>
                            updateSuggestion(s.tag, { label: e.target.value })
                          }
                          placeholder={s.tag}
                          maxLength={40}
                        />
                      </Field>
                      <Field label="類型">
                        <Select
                          value={s.type}
                          onChange={(e) =>
                            updateSuggestion(s.tag, {
                              type: e.target.value as AdminDocFieldType,
                            })
                          }
                        >
                          {FIELD_TYPE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>
                    {s.anchor && (
                      <p className="mt-1.5 truncate text-[11px] text-slate-400 dark:text-slate-500">
                        錨點：{s.anchor}
                      </p>
                    )}
                    <div className="mt-2 flex justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={X}
                        onClick={() => dismissSuggestion(s.tag)}
                      >
                        略過
                      </Button>
                      <Button
                        size="sm"
                        icon={Check}
                        onClick={() => acceptSuggestion(s)}
                      >
                        接受
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
                接受時會嘗試自動喺範本加 {'{標籤}'}（保守處理）；自動加唔到嘅，請依提示喺
                Word 對應位置手動加，最可靠。
              </p>
            </div>
          )}
        </div>
      )}

      {/* ───────── 範本名 + 欄位清單 ───────── */}
      {docx && fields.length > 0 && (
        <div className="space-y-4">
          <Field label="範本名稱" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：家長通知書"
              maxLength={60}
            />
          </Field>

          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
              <Tag size={13} className="text-accent" />
              欄位清單（共 {fields.length} 個）
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              標籤對應範本內 {'{ }'} 的位置；你可改顯示名稱同類型。
            </p>
            <div className="space-y-2">
              {fields.map((f) => (
                <div
                  key={f.tag}
                  className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px_auto] sm:items-end"
                >
                  <Field label="標籤">
                    <Input
                      value={`{${f.tag}}`}
                      readOnly
                      disabled
                      className="font-mono"
                    />
                  </Field>
                  <Field label="顯示名稱">
                    <Input
                      value={f.label}
                      onChange={(e) =>
                        updateField(f.tag, { label: e.target.value })
                      }
                      placeholder={f.tag}
                      maxLength={40}
                    />
                  </Field>
                  <Field label="類型">
                    <Select
                      value={f.type}
                      onChange={(e) =>
                        updateField(f.tag, {
                          type: e.target.value as AdminDocFieldType,
                        })
                      }
                    >
                      {FIELD_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <div className="flex justify-end sm:pb-0.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      onClick={() => removeField(f.tag)}
                      aria-label={`移除欄位 ${f.label || f.tag}`}
                    >
                      移除
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ───────── 動作列 ───────── */}
      <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          取消
        </Button>
        <Button
          onClick={handleSave}
          disabled={!docx || fields.length === 0 || busy}
          loading={busy && !!docx}
          icon={FilePlus2}
        >
          儲存範本
        </Button>
      </div>
    </div>
  )
}
