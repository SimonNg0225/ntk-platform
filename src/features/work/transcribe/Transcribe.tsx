import { useMemo, useRef, useState } from 'react'
import {
  Mic,
  Upload,
  FileText,
  Copy,
  NotebookPen,
  Trash2,
  Clock,
  Loader2,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  SectionTitle,
  SegmentedControl,
  Tooltip,
  cx,
} from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { useConfirm } from '../../../context/ConfirmContext'
import { useCollection } from '../../../lib/store'
import { complete, isAIConfigured, type AIMessage, type AIModel } from '../../../lib/aiClient'
import { fileToImage } from '../docDigest/extract'
import { meetingNotesCol } from '../../../data/collections'
import { downloadDocx, type ExportBlock, type ExportDoc } from '../../../lib/export'
import { transcribeCol, type TranscriptRecord } from './transcribeStore'
import { buildTranscribeSystem, parseTranscript } from './transcribePrompts'

const MODEL_OPTS: { id: AIModel; label: string }[] = [
  { id: 'gemini-2.5-flash', label: 'Flash' },
  { id: 'gemini-2.5-pro', label: 'Pro' },
]
const MAX_MB = 18

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
  } catch {
    return ''
  }
}

export default function Transcribe() {
  const toast = useToast()
  const confirm = useConfirm()
  const records = useCollection(transcribeCol)
  const history = useMemo(
    () => [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [records],
  )

  const [file, setFile] = useState<File | null>(null)
  const [model, setModel] = useState<AIModel>('gemini-2.5-flash')
  const [busy, setBusy] = useState(false)
  const [current, setCurrent] = useState<TranscriptRecord | null>(null)
  const fileInput = useRef<HTMLInputElement | null>(null)

  const sizeMB = file ? file.size / 1024 / 1024 : 0

  async function run() {
    if (busy || !file) return
    if (sizeMB > MAX_MB) {
      toast.error(`檔案太大（${sizeMB.toFixed(1)}MB）。請用 ${MAX_MB}MB 以下，或分段錄音。`)
      return
    }
    setBusy(true)
    try {
      const audio = await fileToImage(file) // { mimeType: file.type, data }
      const raw = await complete({
        system: buildTranscribeSystem(),
        messages: [
          { role: 'user', content: '請處理呢段錄音。', images: [audio] as AIMessage['images'] },
        ],
        model,
        temperature: 0.2,
      })
      const result = parseTranscript(raw)
      const rec = transcribeCol.add({
        createdAt: new Date().toISOString(),
        title: (file.name.replace(/\.[^.]+$/, '') || '錄音').slice(0, 40),
        model,
        ...result,
      })
      setCurrent(rec)
      setFile(null)
      toast.success('轉錄完成')
    } catch (e) {
      toast.error((e as Error).message || '轉錄失敗，請再試。')
    } finally {
      setBusy(false)
    }
  }

  async function del(id: string) {
    const ok = await confirm({ title: '刪除呢個轉錄？', tone: 'danger', confirmText: '刪除' })
    if (!ok) return
    transcribeCol.remove(id)
    if (current?.id === id) setCurrent(null)
  }

  if (!isAIConfigured) {
    return (
      <EmptyState
        icon={Mic}
        title="錄音轉文字未啟用"
        hint="要設定好 Supabase 並部署 gemini Edge Function 先用到。"
      />
    )
  }

  return (
    <div className="space-y-5">
      <header className="min-w-0">
        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
          <Mic size={13} className="shrink-0" />
          會議 · Transcribe
        </p>
        <h1 className="mt-1 text-[26px] font-semibold leading-none tracking-tight text-slate-800 dark:text-slate-100 sm:text-[30px]">
          錄音轉文字
        </h1>
        <p className="mt-2 text-[13px] text-slate-500 dark:text-slate-400">
          上載會議／觀課錄音，AI 轉文字、抽重點、列決議同待跟進，可存入會議筆記。
        </p>
      </header>

      <Card padded className="space-y-3">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Tooltip label="Flash 快 · Pro 強">
            <SegmentedControl size="sm" options={MODEL_OPTS} value={model} onChange={setModel} />
          </Tooltip>
        </div>
        <input
          ref={fileInput}
          type="file"
          className="hidden"
          accept="audio/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-black/[0.12] bg-slate-50/60 px-4 py-8 text-center transition hover:border-accent/40 hover:bg-accent-soft/40 dark:border-white/[0.12] dark:bg-slate-800/40"
        >
          <Mic size={22} className="text-accent" />
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {file ? `${file.name}（${sizeMB.toFixed(1)}MB）` : '揀錄音檔（mp3 / m4a / wav / ogg）'}
          </span>
          {!file && <span className="text-[11px] text-slate-400">手機語音備忘 / 錄音 App 都得，{MAX_MB}MB 以下</span>}
        </button>
        <div className="flex justify-end">
          <Button icon={busy ? Loader2 : Upload} onClick={run} loading={busy} disabled={!file}>
            {busy ? '轉錄中…' : '轉錄'}
          </Button>
        </div>
        {busy && (
          <p className="text-center text-[11px] text-slate-400">錄音越長越耐，請等一等…</p>
        )}
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
                  <Mic size={16} className="shrink-0 text-accent" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{r.title}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                      {fmtDate(r.createdAt)} · {r.summary.length} 重點
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
        <EmptyState icon={Mic} title="未有轉錄" hint="上載第一段錄音試吓。" />
      )}
    </div>
  )
}

function recToDoc(rec: TranscriptRecord): ExportDoc {
  const blocks: ExportBlock[] = []
  if (rec.summary.length) {
    blocks.push({ kind: 'heading', text: '重點摘要', level: 1 })
    blocks.push({ kind: 'bullets', items: rec.summary })
  }
  if (rec.decisions.length) {
    blocks.push({ kind: 'heading', text: '決議', level: 1 })
    blocks.push({ kind: 'bullets', items: rec.decisions })
  }
  if (rec.actions.length) {
    blocks.push({ kind: 'heading', text: '待跟進', level: 1 })
    blocks.push({ kind: 'bullets', items: rec.actions })
  }
  if (rec.transcript) {
    blocks.push({ kind: 'heading', text: '轉錄', level: 1 })
    blocks.push({ kind: 'paragraph', text: rec.transcript })
  }
  return { title: rec.title, blocks }
}

function ResultCard({ rec }: { rec: TranscriptRecord }) {
  const toast = useToast()
  const dlWord = async () => {
    try {
      await downloadDocx(recToDoc(rec))
      toast.success('已下載 Word')
    } catch (e) {
      toast.error((e as Error).message || '下載失敗')
    }
  }
  const copyAll = () => {
    const md = recToDoc(rec)
      .blocks.map((b) =>
        b.kind === 'heading' ? `\n【${b.text}】` : b.kind === 'bullets' ? b.items.map((i) => `• ${i}`).join('\n') : b.kind === 'paragraph' ? b.text : '',
      )
      .join('\n')
    void navigator.clipboard?.writeText(md.trim())
    toast.success('已複製')
  }
  const toMeeting = () => {
    const content = recToDoc(rec)
      .blocks.map((b) =>
        b.kind === 'heading' ? `\n## ${b.text}` : b.kind === 'bullets' ? b.items.map((i) => `- ${i}`).join('\n') : b.kind === 'paragraph' ? b.text : '',
      )
      .join('\n')
      .trim()
    meetingNotesCol.add({
      title: rec.title,
      date: new Date().toISOString().slice(0, 10),
      content,
      tags: ['錄音'],
      createdAt: new Date().toISOString(),
    })
    toast.success('已存入會議筆記')
  }

  const Section = ({ title, items }: { title: string; items: string[] }) =>
    items.length === 0 ? null : (
      <div>
        <p className="mb-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500">{title}</p>
        <ul className="space-y-1.5">
          {items.map((s, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-700 dark:text-slate-200">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/60" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </div>
    )

  return (
    <Card padded className="space-y-4 ring-1 ring-accent/20">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent" icon={Mic}>
          錄音
        </Badge>
        <h2 className="min-w-0 flex-1 text-base font-semibold tracking-tight text-slate-800 dark:text-slate-100">
          {rec.title}
        </h2>
        <Button variant="secondary" size="sm" icon={Copy} onClick={copyAll}>
          複製
        </Button>
        <Button variant="secondary" size="sm" icon={FileText} onClick={dlWord}>
          Word
        </Button>
        <Button variant="secondary" size="sm" icon={NotebookPen} onClick={toMeeting}>
          存入會議筆記
        </Button>
      </div>

      <Section title="重點摘要" items={rec.summary} />
      <Section title="決議" items={rec.decisions} />
      <Section title="待跟進" items={rec.actions} />

      {rec.transcript && (
        <details className="rounded-xl border border-black/[0.06] bg-slate-50/60 p-3 dark:border-white/[0.08] dark:bg-slate-800/40">
          <summary className="cursor-pointer text-[13px] font-medium text-slate-500 dark:text-slate-400">
            完整轉錄
          </summary>
          <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
            {rec.transcript}
          </p>
        </details>
      )}
    </Card>
  )
}
