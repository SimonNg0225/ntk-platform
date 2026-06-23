import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Mic,
  Upload,
  FileText,
  Copy,
  NotebookPen,
  Trash2,
  Clock,
  Loader2,
  ListChecks,
  ChevronRight,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FeatureGuide,
  type FeatureGuideStep,
  IconButton,
  PageHero,
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

// 教學引導（3 步：揀錄音 → 撳轉錄 → 用成果）
const GUIDE_STEPS: FeatureGuideStep[] = [
  {
    title: '揀一段錄音檔',
    desc: '撳上載框揀 mp3 / m4a / wav / ogg；手機語音備忘、錄音 App 都得，' + MAX_MB + 'MB 以下。',
  },
  {
    title: '撳「轉錄」交畀 AI',
    desc: 'AI 會逐句轉文字，再幫你抽重點、列決議同待跟進。錄音越長等耐啲。',
  },
  {
    title: '複製、下載或存入會議筆記',
    desc: '一鍵複製、出 Word，或直接存入會議筆記接住跟進，唔使再打過。',
  },
]

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
  } catch {
    return ''
  }
}

export default function Transcribe() {
  const { t } = useTranslation()
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
  const pick = () => fileInput.current?.click()

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
        feature: 'transcribe', // 走「每月」額度桶（同一般 AI 分開計）
        source: 'transcribe',
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
        title={t('transcribe.notReady.title', { defaultValue: '錄音轉文字未啟用' })}
        hint={t('transcribe.notReady.hint', {
          defaultValue: '要設定好 Supabase 並部署 gemini Edge Function 先用到（步驟見 docs/SETUP.md）。',
        })}
      />
    )
  }

  return (
    <div className="space-y-5">
      {/* ───────── 頁首：共用 PageHero（accent hero） ───────── */}
      <PageHero
        icon={Mic}
        kicker={t('transcribe.kicker', { defaultValue: 'Transcribe' })}
        title={t('transcribe.title', { defaultValue: '錄音轉文字' })}
        description={t('transcribe.subtitle', {
          defaultValue: '上載會議／觀課錄音，AI 轉文字、抽重點、列決議同待跟進，一鍵存入會議筆記。',
        })}
      />

      {/* ───────── 教學引導：點用呢個功能（可摺疊 / 永久收起）───────── */}
      <FeatureGuide
        storageKey="transcribe"
        title={t('transcribe.guide.title', { defaultValue: '錄音轉文字點用？' })}
        steps={GUIDE_STEPS}
      />

      {/* ───────── 上載 + 轉錄 ───────── */}
      <Card padded className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {t('transcribe.upload.heading', { defaultValue: '上載錄音' })}
          </p>
          <Tooltip label={t('transcribe.model.hint', { defaultValue: 'Flash 快 · Pro 準' })}>
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
          onClick={pick}
          aria-label={t('transcribe.upload.pick', { defaultValue: '揀錄音檔' })}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-accent/40 bg-accent-soft/50 px-4 py-8 text-center transition duration-200 hover:border-accent hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.99] dark:border-accent/40 dark:bg-accent/10 dark:hover:border-accent"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-white">
            <Mic size={20} />
          </span>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {file
              ? `${file.name}（${sizeMB.toFixed(1)}MB）`
              : t('transcribe.upload.pickHint', { defaultValue: '揀錄音檔（mp3 / m4a / wav / ogg）' })}
          </span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            {file
              ? t('transcribe.upload.replace', { defaultValue: '撳呢度換另一段' })
              : t('transcribe.upload.note', {
                  defaultValue: '手機語音備忘 / 錄音 App 都得，' + MAX_MB + 'MB 以下',
                })}
          </span>
        </button>
        <div className="flex justify-end">
          <Button icon={busy ? Loader2 : Upload} onClick={run} loading={busy} disabled={!file}>
            {busy
              ? t('transcribe.action.running', { defaultValue: '轉錄中…' })
              : t('transcribe.action.run', { defaultValue: '轉錄' })}
          </Button>
        </div>
        {busy && (
          <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">
            {t('transcribe.action.wait', { defaultValue: '錄音越長越耐，請等一等…' })}
          </p>
        )}
      </Card>

      {current && <ResultCard rec={current} />}

      {history.length > 0 && (
        <section aria-label={t('transcribe.history.label', { defaultValue: '歷史轉錄' })}>
          <SectionTitle icon={Clock}>
            {t('transcribe.history.title', { defaultValue: '歷史' })}
          </SectionTitle>
          <div className="space-y-2">
            {history.map((r) => (
              <div
                key={r.id}
                className={cx(
                  'group relative flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white pl-3 pr-12 transition duration-200 hover:border-slate-300 hover:shadow-md dark:border-slate-700/60 dark:bg-slate-800 dark:hover:border-slate-600',
                  current?.id === r.id &&
                    'border-accent/40 ring-1 ring-accent/30 dark:border-accent/40',
                )}
              >
                <button
                  type="button"
                  onClick={() => setCurrent(r)}
                  aria-label={r.title}
                  className="flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.99]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                    <Mic size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                      {r.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                      {fmtDate(r.createdAt)} ·{' '}
                      {t('transcribe.history.points', {
                        defaultValue: '{{n}} 重點',
                        n: r.summary.length,
                      })}
                    </p>
                  </div>
                </button>
                <span className="absolute right-2 top-1/2 -translate-y-1/2">
                  <IconButton
                    label={t('transcribe.history.delete', { defaultValue: '刪除' })}
                    size="sm"
                    tone="danger"
                    onClick={() => void del(r.id)}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {history.length === 0 && !current && (
        <EmptyState
          icon={Mic}
          title={t('transcribe.empty.title', { defaultValue: '未有任何轉錄' })}
          hint={t('transcribe.empty.hint', {
            defaultValue: '上載第一段會議或觀課錄音，AI 即刻幫你整理成重點、決議同待跟進。',
          })}
          action={
            <Button size="sm" variant="secondary" icon={Upload} onClick={pick}>
              {t('transcribe.empty.cta', { defaultValue: '揀錄音檔開始' })}
            </Button>
          }
        />
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

// 三段成果嘅語意色（重點=accent 中性主指標、決議=emerald 良好、待跟進=amber 跟進）
const DOT_TONE = {
  accent: 'bg-accent',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
} as const

function ResultCard({ rec }: { rec: TranscriptRecord }) {
  const { t } = useTranslation()
  const toast = useToast()
  const dlWord = async () => {
    try {
      await downloadDocx(recToDoc(rec))
      toast.success(t('transcribe.result.dlOk', { defaultValue: '已下載 Word' }))
    } catch (e) {
      toast.error((e as Error).message || t('transcribe.result.dlFail', { defaultValue: '下載失敗' }))
    }
  }
  const copyAll = () => {
    const md = recToDoc(rec)
      .blocks.map((b) =>
        b.kind === 'heading' ? `\n【${b.text}】` : b.kind === 'bullets' ? b.items.map((i) => `• ${i}`).join('\n') : b.kind === 'paragraph' ? b.text : '',
      )
      .join('\n')
    void navigator.clipboard?.writeText(md.trim())
    toast.success(t('transcribe.result.copyOk', { defaultValue: '已複製' }))
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
    toast.success(t('transcribe.result.savedNotes', { defaultValue: '已存入會議筆記' }))
  }

  const Section = ({
    title,
    items,
    tone,
  }: {
    title: string
    items: string[]
    tone: keyof typeof DOT_TONE
  }) =>
    items.length === 0 ? null : (
      <div>
        <p className="mb-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">{title}</p>
        <ul className="space-y-1.5">
          {items.map((s, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-slate-700 dark:text-slate-200">
              <span className={cx('mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full', DOT_TONE[tone])} />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </div>
    )

  const empty = rec.summary.length === 0 && rec.decisions.length === 0 && rec.actions.length === 0

  return (
    <Card padded className="space-y-4 ring-1 ring-accent/20">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent" icon={Mic}>
          {t('transcribe.result.badge', { defaultValue: '錄音' })}
        </Badge>
        <h2 className="min-w-0 flex-1 text-base font-semibold tracking-tight text-slate-800 dark:text-slate-100">
          {rec.title}
        </h2>
        <Button variant="secondary" size="sm" icon={Copy} onClick={copyAll}>
          {t('transcribe.result.copy', { defaultValue: '複製' })}
        </Button>
        <Button variant="secondary" size="sm" icon={FileText} onClick={dlWord}>
          {t('transcribe.result.word', { defaultValue: 'Word' })}
        </Button>
        <Button variant="secondary" size="sm" icon={NotebookPen} onClick={toMeeting}>
          {t('transcribe.result.toNotes', { defaultValue: '存入會議筆記' })}
        </Button>
      </div>

      <Section
        title={t('transcribe.section.summary', { defaultValue: '重點摘要' })}
        items={rec.summary}
        tone="accent"
      />
      <Section
        title={t('transcribe.section.decisions', { defaultValue: '決議' })}
        items={rec.decisions}
        tone="emerald"
      />
      <Section
        title={t('transcribe.section.actions', { defaultValue: '待跟進' })}
        items={rec.actions}
        tone="amber"
      />

      {empty && (
        <div className="flex items-center gap-2.5 rounded-xl bg-slate-50/60 px-3 py-2.5 text-sm text-slate-400 dark:bg-slate-800/40 dark:text-slate-500">
          <ListChecks size={16} className="shrink-0" />
          {t('transcribe.result.noPoints', {
            defaultValue: '今次抽唔到明顯重點，可展開下面完整轉錄睇返內容。',
          })}
        </div>
      )}

      {rec.transcript && (
        <details className="group rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 dark:border-slate-700/60 dark:bg-slate-800/40">
          <summary className="flex cursor-pointer items-center gap-1 text-[13px] font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
            <ChevronRight
              size={14}
              className="shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-90"
            />
            {t('transcribe.result.fullTranscript', { defaultValue: '完整轉錄' })}
          </summary>
          <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
            {rec.transcript}
          </p>
        </details>
      )}
    </Card>
  )
}
