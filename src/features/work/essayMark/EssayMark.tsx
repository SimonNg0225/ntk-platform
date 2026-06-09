import { useMemo, useRef, useState } from 'react'
import {
  PenLine,
  Sparkles,
  FileText,
  Copy,
  Upload,
  Camera,
  Trash2,
  Clock,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
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
import { fileToImage } from '../docDigest/extract'
import { downloadDocx, type ExportBlock, type ExportDoc } from '../../../lib/export'
import { essayMarkCol, type EssayRecord } from './essayStore'
import { buildEssaySystem, parseEssay, type EssaySubject } from './essayPrompts'

type InputMode = 'text' | 'photo'
const SUBJECT_OPTS: { id: EssaySubject; label: string }[] = [
  { id: 'zh', label: '中文' },
  { id: 'en', label: 'English' },
]
const INPUT_OPTS: { id: InputMode; label: string }[] = [
  { id: 'text', label: '貼文字' },
  { id: 'photo', label: '影相' },
]
const MODEL_OPTS: { id: AIModel; label: string }[] = [
  { id: 'gemini-2.5-flash', label: 'Flash' },
  { id: 'gemini-2.5-pro', label: 'Pro' },
]
const ISSUE_LABEL: Record<string, { label: string; tone: Parameters<typeof Badge>[0]['tone'] }> = {
  grammar: { label: '文法', tone: 'rose' },
  wording: { label: '用詞', tone: 'amber' },
  spelling: { label: '錯別字', tone: 'blue' },
  content: { label: '內容', tone: 'slate' },
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
  } catch {
    return ''
  }
}

export default function EssayMark() {
  const toast = useToast()
  const confirm = useConfirm()
  const records = useCollection(essayMarkCol)
  const history = useMemo(
    () => [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [records],
  )

  const [subject, setSubject] = useState<EssaySubject>('zh')
  const [mode, setMode] = useState<InputMode>('text')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [rubric, setRubric] = useState('')
  const [model, setModel] = useState<AIModel>('gemini-2.5-flash')
  const [busy, setBusy] = useState(false)
  const [current, setCurrent] = useState<EssayRecord | null>(null)
  const fileInput = useRef<HTMLInputElement | null>(null)

  const hasInput = mode === 'text' ? text.trim().length > 0 : file !== null

  async function run() {
    if (busy || !hasInput) return
    setBusy(true)
    try {
      let images: AIMessage['images']
      let title = ''
      if (mode === 'text') {
        title = text.trim().slice(0, 24)
      } else if (file) {
        images = [await fileToImage(file)]
        title = '相片作文'
      }
      const raw = await complete({
        system: buildEssaySystem(subject, rubric),
        messages: [{ role: 'user', content: mode === 'text' ? text.trim() : '（請閱讀附圖作文）', images }],
        model,
        temperature: 0.3,
      })
      const result = parseEssay(raw)
      const rec = essayMarkCol.add({
        createdAt: new Date().toISOString(),
        subject,
        title: title || '作文批改',
        model,
        ...result,
      })
      setCurrent(rec)
      setText('')
      setFile(null)
      toast.success('批改完成')
    } catch (e) {
      toast.error((e as Error).message || '批改失敗，請再試。')
    } finally {
      setBusy(false)
    }
  }

  async function del(id: string) {
    const ok = await confirm({ title: '刪除呢個批改？', tone: 'danger', confirmText: '刪除' })
    if (!ok) return
    essayMarkCol.remove(id)
    if (current?.id === id) setCurrent(null)
  }

  if (!isAIConfigured) {
    return (
      <EmptyState
        icon={PenLine}
        title="作文批改未啟用"
        hint="要設定好 Supabase 並部署 gemini Edge Function 先用到。"
      />
    )
  }

  return (
    <div className="space-y-5">
      <header className="min-w-0">
        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
          <PenLine size={13} className="shrink-0" />
          學生評估 · Essay Marking
        </p>
        <h1 className="mt-1 text-[26px] font-semibold leading-none tracking-tight text-slate-800 dark:text-slate-100 sm:text-[30px]">
          作文批改
        </h1>
        <p className="mt-2 text-[13px] text-slate-500 dark:text-slate-400">
          貼上或影低作文，AI 按評分準則打分、標出病句、寫總評。
        </p>
      </header>

      <Card padded className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SegmentedControl options={SUBJECT_OPTS} value={subject} onChange={setSubject} />
          <div className="flex items-center gap-2">
            <SegmentedControl options={INPUT_OPTS} value={mode} onChange={(m) => { setMode(m); setFile(null) }} />
            <Tooltip label="Flash 快 · Pro 強">
              <SegmentedControl size="sm" options={MODEL_OPTS} value={model} onChange={setModel} />
            </Tooltip>
          </div>
        </div>

        {mode === 'text' ? (
          <Textarea
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="貼上學生作文…"
          />
        ) : (
          <div>
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              accept="image/*"
              capture="environment"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-black/[0.12] bg-slate-50/60 px-4 py-8 text-center transition hover:border-accent/40 hover:bg-accent-soft/40 dark:border-white/[0.12] dark:bg-slate-800/40"
            >
              <Camera size={22} className="text-accent" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                {file ? file.name : '影相 / 揀相片'}
              </span>
              {!file && <span className="text-[11px] text-slate-400">影低手寫作文，AI 會讀字批改</span>}
            </button>
          </div>
        )}

        <Field label="評分準則（選填）" hint="貼自訂 rubric；唔填用該科常見準則">
          <Textarea
            rows={2}
            value={rubric}
            onChange={(e) => setRubric(e.target.value)}
            placeholder="例：內容 16 / 表達 12 / 結構 8 / 錯別字 4"
          />
        </Field>

        <div className="flex justify-end">
          <Button icon={mode === 'photo' ? Upload : Sparkles} onClick={run} loading={busy} disabled={!hasInput}>
            {busy ? '批改中…' : '批改'}
          </Button>
        </div>
      </Card>

      {current && <ResultCard rec={current} />}

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
                <div className="flex items-center gap-2.5">
                  <Badge tone={r.subject === 'en' ? 'blue' : 'accent'}>
                    {r.subject === 'en' ? 'EN' : '中'}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{r.title}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                      {fmtDate(r.createdAt)} · {r.total}/{r.maxTotal}
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
        <EmptyState icon={PenLine} title="未有批改記錄" hint="貼上第一篇作文試吓 AI 批改。" />
      )}
    </div>
  )
}

function essayToDoc(rec: EssayRecord): ExportDoc {
  const blocks: ExportBlock[] = []
  if (rec.scores.length > 0) {
    blocks.push({ kind: 'heading', text: '評分', level: 1 })
    blocks.push({
      kind: 'bullets',
      items: rec.scores.map(
        (s) => `${s.criterion}：${s.score}/${s.max}${s.comment ? ` — ${s.comment}` : ''}`,
      ),
    })
  }
  if (rec.issues.length > 0) {
    blocks.push({ kind: 'heading', text: '問題標示', level: 1 })
    blocks.push({ kind: 'bullets', items: rec.issues.map((i) => `${i.quote} → ${i.suggestion}`) })
  }
  if (rec.overall) {
    blocks.push({ kind: 'heading', text: '總評', level: 1 })
    blocks.push({ kind: 'paragraph', text: rec.overall })
  }
  return { title: `${rec.title}（${rec.total}/${rec.maxTotal}）`, blocks }
}

function ResultCard({ rec }: { rec: EssayRecord }) {
  const toast = useToast()
  const pct = rec.maxTotal > 0 ? Math.round((rec.total / rec.maxTotal) * 100) : 0
  const copyAll = () => {
    const lines = [
      ...rec.scores.map((s) => `${s.criterion}：${s.score}/${s.max} ${s.comment}`),
      '',
      '總評：' + rec.overall,
    ]
    void navigator.clipboard?.writeText(lines.join('\n'))
    toast.success('已複製')
  }
  const dlWord = async () => {
    try {
      await downloadDocx(essayToDoc(rec))
      toast.success('已下載 Word')
    } catch (e) {
      toast.error((e as Error).message || '下載失敗')
    }
  }

  return (
    <Card padded className="space-y-4 ring-1 ring-accent/20">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold tabular-nums text-accent-strong dark:text-accent">
            {rec.total}
          </span>
          <span className="text-sm text-slate-400">/ {rec.maxTotal}</span>
          <Badge tone="slate" className="ml-1">
            {pct}%
          </Badge>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={Copy} onClick={copyAll}>
            複製
          </Button>
          <Button variant="secondary" size="sm" icon={FileText} onClick={dlWord}>
            Word
          </Button>
        </div>
      </div>

      {rec.scores.length > 0 && (
        <div className="space-y-1.5">
          {rec.scores.map((s, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">{s.criterion}</span>
              <span className="tabular-nums text-accent-strong dark:text-accent">
                {s.score}/{s.max}
              </span>
              {s.comment && <span className="text-[13px] text-slate-500 dark:text-slate-400">— {s.comment}</span>}
            </div>
          ))}
        </div>
      )}

      {rec.issues.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500">問題標示</p>
          <div className="space-y-2">
            {rec.issues.map((iss, i) => {
              const meta = ISSUE_LABEL[iss.type] ?? ISSUE_LABEL.wording
              return (
                <div
                  key={i}
                  className="rounded-xl border border-black/[0.06] bg-slate-50/60 p-2.5 dark:border-white/[0.08] dark:bg-slate-800/40"
                >
                  <div className="flex items-center gap-2">
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </div>
                  <p className="mt-1.5 text-sm">
                    <span className="rounded bg-rose-100 px-1 text-rose-700 line-through dark:bg-rose-500/15 dark:text-rose-300">
                      {iss.quote}
                    </span>
                    <span className="mx-1.5 text-slate-300">→</span>
                    <span className="rounded bg-emerald-100 px-1 font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                      {iss.suggestion}
                    </span>
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {rec.overall && (
        <div>
          <p className="mb-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">總評</p>
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">{rec.overall}</p>
        </div>
      )}
    </Card>
  )
}
