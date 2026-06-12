import { useMemo, useRef, useState } from 'react'
import {
  FileSearch,
  Sparkles,
  Upload,
  Camera,
  CheckSquare,
  CalendarPlus,
  Trash2,
  Clock,
  FileText,
  Printer,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  SectionTitle,
  SegmentedControl,
  Textarea,
  Tooltip,
  cx,
} from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { useConfirm } from '../../../context/ConfirmContext'
import { useCollection } from '../../../lib/store'
import { complete, isAIConfigured, type AIMessage, type AIModel } from '../../../lib/aiClient'
import { tasksCol, eventsCol } from '../../../data/collections'
import { downloadDocx, printDoc, type ExportBlock, type ExportDoc } from '../../../lib/export'
import { docDigestCol, type DigestAction, type DigestRecord } from './digestStore'
import { buildDigestSystem, parseDigest } from './prompts'
import { extractFromFile } from './extract'

type Mode = 'text' | 'file' | 'photo'

const MODE_OPTIONS: { id: Mode; label: string }[] = [
  { id: 'text', label: '貼文字' },
  { id: 'file', label: '上載檔' },
  { id: 'photo', label: '影相' },
]
const MODEL_OPTIONS: { id: AIModel; label: string }[] = [
  { id: 'gemini-2.5-flash', label: 'Flash' },
  { id: 'gemini-2.5-pro', label: 'Pro' },
]

const CAT_TONE: Record<string, Parameters<typeof Badge>[0]['tone']> = {
  校務通告: 'blue',
  家長通告: 'green',
  會議文件: 'accent',
  行政表格: 'amber',
  政策指引: 'rose',
  課程相關: 'accent',
  其他: 'slate',
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
  } catch {
    return ''
  }
}

export default function DocDigest() {
  const toast = useToast()
  const confirm = useConfirm()
  const records = useCollection(docDigestCol)
  const history = useMemo(
    () => [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [records],
  )

  const [mode, setMode] = useState<Mode>('text')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [model, setModel] = useState<AIModel>('gemini-2.5-flash')
  const [busy, setBusy] = useState(false)
  const [current, setCurrent] = useState<DigestRecord | null>(null)
  const fileInput = useRef<HTMLInputElement | null>(null)

  const hasInput = mode === 'text' ? text.trim().length > 0 : file !== null

  async function run() {
    if (busy || !hasInput) return
    setBusy(true)
    try {
      let inputText = ''
      let image: AIMessage['images'] = undefined
      let sourceType: DigestRecord['sourceType'] = 'text'

      if (mode === 'text') {
        inputText = text.trim()
      } else if (file) {
        const ex = await extractFromFile(file)
        inputText = ex.text
        if (ex.image) image = [ex.image]
        sourceType = ex.sourceType
        if (!inputText && !ex.image) {
          throw new Error('呢個檔抽唔到文字（可能係掃描件）。試吓改用「影相」。')
        }
      }

      const system = buildDigestSystem(new Date().toISOString().slice(0, 10))
      const messages: AIMessage[] = [
        { role: 'user', content: inputText || '（請閱讀附圖嘅文件）', images: image },
      ]
      const raw = await complete({ messages, system, model, temperature: 0.2, source: 'doc-digest' })
      const result = parseDigest(raw)

      const rec = docDigestCol.add({
        createdAt: new Date().toISOString(),
        title: result.title,
        category: result.category,
        summary: result.summary,
        actions: result.actions,
        sourceType,
        snippet: (inputText || '（圖片文件）').slice(0, 500),
        model,
      })
      setCurrent(rec)
      setText('')
      setFile(null)
      toast.success('速讀完成')
    } catch (e) {
      toast.error((e as Error).message || '速讀失敗，請再試。')
    } finally {
      setBusy(false)
    }
  }

  function addTodo(a: DigestAction) {
    tasksCol.add({
      text: a.date ? `${a.text}（${a.date}）` : a.text,
      done: false,
      createdAt: new Date().toISOString(),
    })
    toast.success('已加入待辦')
  }

  function addEvent(a: DigestAction) {
    if (!a.date) return
    eventsCol.add({ title: a.text, date: a.date, allDay: true })
    toast.success('已加入行事曆')
  }

  async function del(id: string) {
    const ok = await confirm({
      title: '刪除呢個速讀記錄？',
      tone: 'danger',
      confirmText: '刪除',
    })
    if (!ok) return
    docDigestCol.remove(id)
    if (current?.id === id) setCurrent(null)
  }

  if (!isAIConfigured) {
    return (
      <EmptyState
        icon={FileSearch}
        title="文件速讀未啟用"
        hint="要設定好 Supabase 並部署 gemini Edge Function 先用到。步驟見 docs/SETUP.md。"
      />
    )
  }

  return (
    <div className="space-y-5">
      {/* masthead */}
      <header className="min-w-0">
        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
          <FileSearch size={13} className="shrink-0" />
          行政速讀 · Doc Digest
        </p>
        <h1 className="mt-1 text-[26px] font-semibold leading-none tracking-tight text-slate-800 dark:text-slate-100 sm:text-[30px]">
          文件速讀
        </h1>
        <p className="mt-2 text-[13px] text-slate-500 dark:text-slate-400">
          貼上、上載或影低行政文件，AI 即刻幫你歸類、抽重點、列出要跟進事項。
        </p>
      </header>

      {/* 輸入 */}
      <Card padded className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SegmentedControl
            options={MODE_OPTIONS}
            value={mode}
            onChange={(m) => {
              setMode(m)
              setFile(null)
            }}
          />
          <Tooltip label="Flash 快 · Pro 強">
            <SegmentedControl size="sm" options={MODEL_OPTIONS} value={model} onChange={setModel} />
          </Tooltip>
        </div>

        {mode === 'text' ? (
          <Textarea
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="貼上通告 / 會議文件 / 政策內容…"
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
              {mode === 'photo' ? (
                <Camera size={22} className="text-accent" />
              ) : (
                <Upload size={22} className="text-accent" />
              )}
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                {file ? file.name : mode === 'photo' ? '影相 / 揀相片' : '揀 PDF / Word 檔'}
              </span>
              {!file && (
                <span className="text-[11px] text-slate-400">
                  {mode === 'photo' ? '手機可即影紙本通告' : '掃描件抽唔到字 → 改用影相'}
                </span>
              )}
            </button>
          </div>
        )}

        <div className="flex justify-end">
          <Button icon={Sparkles} onClick={run} loading={busy} disabled={!hasInput}>
            {busy ? '速讀中…' : '速讀'}
          </Button>
        </div>
      </Card>

      {/* 結果 */}
      {current && <ResultCard rec={current} onAddTodo={addTodo} onAddEvent={addEvent} />}

      {/* 歷史 */}
      {history.length > 0 && (
        <div>
          <SectionTitle icon={Clock}>歷史</SectionTitle>
          <div className="space-y-2">
            {history.map((r) => (
              <Card
                key={r.id}
                hover
                onClick={() => setCurrent(r)}
                className={cx('p-3', current?.id === r.id && 'ring-1 ring-accent/30')}
              >
                <div className="flex items-start gap-2.5">
                  <Badge tone={CAT_TONE[r.category] ?? 'slate'}>{r.category}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                      {r.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                      {fmtDate(r.createdAt)} · {r.summary.length} 重點
                      {r.actions.length > 0 && ` · ${r.actions.length} 跟進`}
                    </p>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <IconButton label="刪除" size="sm" tone="danger" onClick={() => void del(r.id)}>
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {history.length === 0 && !current && (
        <EmptyState
          icon={FileText}
          title="未有速讀記錄"
          hint="貼上或上載第一份行政文件，試吓 AI 速讀。"
        />
      )}
    </div>
  )
}

function digestToDoc(rec: DigestRecord): ExportDoc {
  const blocks: ExportBlock[] = []
  if (rec.summary.length > 0) {
    blocks.push({ kind: 'heading', text: '重點', level: 1 })
    blocks.push({ kind: 'bullets', items: rec.summary })
  }
  if (rec.actions.length > 0) {
    blocks.push({ kind: 'heading', text: '要跟進', level: 1 })
    blocks.push({
      kind: 'bullets',
      items: rec.actions.map((a) => (a.date ? `${a.text}（${a.date}）` : a.text)),
    })
  }
  return { title: rec.title, subtitle: rec.category, blocks }
}

function ResultCard({
  rec,
  onAddTodo,
  onAddEvent,
}: {
  rec: DigestRecord
  onAddTodo: (a: DigestAction) => void
  onAddEvent: (a: DigestAction) => void
}) {
  const toast = useToast()
  const dlWord = async () => {
    try {
      await downloadDocx(digestToDoc(rec))
      toast.success('已下載 Word')
    } catch (e) {
      toast.error((e as Error).message || '下載失敗')
    }
  }
  const dlPdf = () => {
    try {
      printDoc(digestToDoc(rec))
    } catch (e) {
      toast.error((e as Error).message || '列印失敗')
    }
  }
  return (
    <Card padded className="space-y-4 ring-1 ring-accent/20">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={CAT_TONE[rec.category] ?? 'slate'}>{rec.category}</Badge>
        <h2 className="min-w-0 flex-1 text-base font-semibold tracking-tight text-slate-800 dark:text-slate-100">
          {rec.title}
        </h2>
        <Button variant="secondary" size="sm" icon={FileText} onClick={dlWord}>
          Word
        </Button>
        <Button variant="secondary" size="sm" icon={Printer} onClick={dlPdf}>
          PDF
        </Button>
      </div>

      {rec.summary.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500">重點</p>
          <ul className="space-y-1.5">
            {rec.summary.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-700 dark:text-slate-200">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/60" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {rec.actions.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
            要跟進
          </p>
          <div className="space-y-2">
            {rec.actions.map((a, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-black/[0.06] bg-slate-50/60 px-3 py-2 dark:border-white/[0.08] dark:bg-slate-800/40"
              >
                <span className="min-w-0 flex-1 text-sm text-slate-700 dark:text-slate-200">
                  {a.text}
                </span>
                {a.date && (
                  <Badge tone="amber" icon={Clock}>
                    {a.date}
                  </Badge>
                )}
                <Button variant="secondary" size="sm" icon={CheckSquare} onClick={() => onAddTodo(a)}>
                  待辦
                </Button>
                {a.date && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={CalendarPlus}
                    onClick={() => onAddEvent(a)}
                  >
                    行事曆
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {rec.summary.length === 0 && rec.actions.length === 0 && (
        <p className="text-sm text-slate-400">AI 抽唔到明顯重點，試吓換 Pro 模型或補多啲內容。</p>
      )}
    </Card>
  )
}
