import { useMemo, useRef, useState } from 'react'
import { Inbox, Upload, Camera, Sparkles, Check, Loader2, ListPlus, Replace } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  SegmentedControl,
  Textarea,
  Tooltip,
} from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { useSettings } from '../../../context/SettingsContext'
import { useCollection } from '../../../lib/store'
import { complete, isAIConfigured, type AIMessage, type AIModel } from '../../../lib/aiClient'
import { extractFromFile } from '../docDigest/extract'
import { topicsCol } from '../../../data/collections'
import { getSubjectPack } from '../../../data/subjects'
import { buildImportSystem, parseTopics, type ImportedTopic } from './importPrompts'
import { smartApplyTopics } from './applyTopics'

type Mode = 'file' | 'text' | 'photo'
const MODE_OPTS: { id: Mode; label: string }[] = [
  { id: 'file', label: '上載檔' },
  { id: 'text', label: '貼文字' },
  { id: 'photo', label: '影相' },
]
const MODEL_OPTS: { id: AIModel; label: string }[] = [
  { id: 'gemini-2.5-flash', label: 'Flash' },
  { id: 'gemini-2.5-pro', label: 'Pro' },
]

export default function TopicImport() {
  const toast = useToast()
  const { subjectPackId } = useSettings()
  const subjectName = subjectPackId !== 'custom' ? getSubjectPack(subjectPackId)?.name : undefined
  const existing = useCollection(topicsCol)

  const [mode, setMode] = useState<Mode>('file')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [model, setModel] = useState<AIModel>('gemini-2.5-flash')
  const [busy, setBusy] = useState(false)
  const [imported, setImported] = useState<ImportedTopic[] | null>(null)
  const fileInput = useRef<HTMLInputElement | null>(null)

  const hasInput = mode === 'text' ? text.trim().length > 0 : file !== null

  // 預覽：按 area 分組
  const grouped = useMemo(() => {
    if (!imported) return []
    const m = new Map<string, ImportedTopic[]>()
    for (const it of imported) {
      const key = it.area || '（未分類）'
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(it)
    }
    return [...m.entries()]
  }, [imported])

  async function extract() {
    if (busy || !hasInput) return
    setBusy(true)
    try {
      let content = ''
      let images: AIMessage['images']
      if (mode === 'text') {
        content = text.trim()
      } else if (file) {
        const ex = await extractFromFile(file)
        content = ex.text
        if (ex.image) images = [ex.image]
        if (!content && !ex.image) throw new Error('檔案抽唔到文字（可能係掃描件），試吓影相。')
      }
      const raw = await complete({
        system: buildImportSystem(subjectName),
        messages: [{ role: 'user', content: content || '（請閱讀附圖課程文件）', images }],
        model,
        temperature: 0.2,
      })
      setImported(parseTopics(raw))
      toast.success('已抽取課題，請預覽再載入')
    } catch (e) {
      toast.error((e as Error).message || '抽取失敗，請再試。')
    } finally {
      setBusy(false)
    }
  }

  function loadAppend() {
    if (!imported) return
    const maxOrder = existing.reduce((m, t) => Math.max(m, t.order), 0)
    imported.forEach((it, i) =>
      topicsCol.add({ part: it.part, area: it.area, topic: it.topic, order: maxOrder + i + 1 }),
    )
    toast.success(`已附加 ${imported.length} 個課題`)
    setImported(null)
    setText('')
    setFile(null)
  }

  function loadSmart() {
    if (!imported) return
    const r = smartApplyTopics(imported)
    toast.success(
      `智能切換完成：保留 ${r.matched} · 新增 ${r.added}` +
        (r.kept ? ` · 留存 ${r.kept}` : '') +
        (r.removed ? ` · 清走 ${r.removed}` : ''),
    )
    setImported(null)
    setText('')
    setFile(null)
  }

  if (!isAIConfigured) {
    return (
      <EmptyState
        icon={Inbox}
        title="課題匯入未啟用"
        hint="要設定好 Supabase 並部署 gemini Edge Function 先用到。"
      />
    )
  }

  return (
    <div className="space-y-5">
      <header className="min-w-0">
        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
          <Inbox size={13} className="shrink-0" />
          課程設定 · Topics
        </p>
        <h1 className="mt-1 font-serif text-[26px] font-semibold leading-none tracking-tight text-slate-800 dark:text-slate-100 sm:text-[30px]">
          課題匯入
        </h1>
        <p className="mt-2 text-[13px] text-slate-500 dark:text-slate-400">
          上載官方課程指引 / 補充資料 / syllabus，AI 抽出課題，一鍵載入做你科嘅課題（題庫、進度、出題、指引都會用）。
        </p>
      </header>

      <Card padded className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SegmentedControl options={MODE_OPTS} value={mode} onChange={(m) => { setMode(m); setFile(null) }} />
          <Tooltip label="Flash 快 · Pro 強">
            <SegmentedControl size="sm" options={MODEL_OPTS} value={model} onChange={setModel} />
          </Tooltip>
        </div>

        {mode === 'text' ? (
          <Textarea
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="貼上官方課程指引／課題清單…"
          />
        ) : (
          <div>
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              accept={mode === 'photo' ? 'image/*' : '.pdf,.docx,.doc,.txt'}
              {...(mode === 'photo' ? { capture: 'environment' as const } : {})}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-black/[0.12] bg-slate-50/60 px-4 py-8 text-center transition hover:border-accent/40 hover:bg-accent-soft/40 dark:border-white/[0.12] dark:bg-slate-800/40"
            >
              {mode === 'photo' ? <Camera size={22} className="text-accent" /> : <Upload size={22} className="text-accent" />}
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                {file ? file.name : mode === 'photo' ? '影相 / 揀相片' : '揀 PDF / Word 課程文件'}
              </span>
            </button>
          </div>
        )}

        <div className="flex justify-end">
          <Button icon={busy ? Loader2 : Sparkles} onClick={extract} loading={busy} disabled={!hasInput}>
            {busy ? '抽取中…' : '抽取課題'}
          </Button>
        </div>
      </Card>

      {imported && (
        <Card padded className="space-y-4 ring-1 ring-accent/20">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent" icon={Check}>
              {imported.length} 個課題
            </Badge>
            <span className="flex-1 text-[13px] text-slate-500 dark:text-slate-400">預覽 — 確認後載入</span>
            <Button variant="secondary" size="sm" icon={ListPlus} onClick={loadAppend}>
              附加
            </Button>
            <Button size="sm" icon={Replace} onClick={loadSmart}>
              智能切換
            </Button>
          </div>
          <div className="space-y-3">
            {grouped.map(([area, items]) => (
              <div key={area}>
                <p className="mb-1 text-[11px] font-semibold text-accent-strong dark:text-accent">{area}</p>
                <ul className="space-y-0.5">
                  {items.map((it, i) => (
                    <li key={i} className="flex gap-2 text-[13px] text-slate-700 dark:text-slate-200">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent/50" />
                      {it.topic}
                      {it.part && <span className="text-[11px] text-slate-400">· {it.part}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      )}

      <p className="text-[11px] text-slate-400">
        現時課題：{existing.length} 個。「附加」會加喺後面；「智能切換」會按課題名保留連繫（題庫/進度唔甩號），冇用嘅先清走。
      </p>
    </div>
  )
}
