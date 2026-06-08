import { useMemo, useState } from 'react'
import {
  Presentation,
  Sparkles,
  Download,
  Trash2,
  Clock,
  Loader2,
  StickyNote,
  BarChart3,
  Image as ImageIcon,
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
  Select,
  Textarea,
  Tooltip,
  cx,
} from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { useConfirm } from '../../../context/ConfirmContext'
import { useSettings } from '../../../context/SettingsContext'
import { useCollection } from '../../../lib/store'
import { complete, isAIConfigured, type AIModel } from '../../../lib/aiClient'
import { topicsCol } from '../../../data/collections'
import { getSubjectPack } from '../../../data/subjects'
import {
  downloadPptx,
  SLIDE_THEMES,
  type SlideThemeId,
  fetchCoverPhoto,
  isStockConfigured,
} from '../../../lib/export'
import { slideDecksCol, type DeckRecord } from './slideStore'
import { buildSlideSystem, parseDeck } from './slidePrompts'

type Mode = 'topic' | 'text'
const MODE_OPTS: { id: Mode; label: string }[] = [
  { id: 'topic', label: '揀課題' },
  { id: 'text', label: '貼內容' },
]
const MODEL_OPTS: { id: AIModel; label: string }[] = [
  { id: 'gemini-2.5-flash', label: 'Flash' },
  { id: 'gemini-2.5-pro', label: 'Pro' },
]

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
  } catch {
    return ''
  }
}

export default function SlideGen() {
  const toast = useToast()
  const confirm = useConfirm()
  const { subjectPackId } = useSettings()
  const subjectName = subjectPackId !== 'custom' ? getSubjectPack(subjectPackId)?.name : undefined

  const allTopics = useCollection(topicsCol)
  const topics = useMemo(() => [...allTopics].sort((a, b) => a.order - b.order), [allTopics])
  const records = useCollection(slideDecksCol)
  const history = useMemo(
    () => [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [records],
  )

  const [mode, setMode] = useState<Mode>('topic')
  const [topicId, setTopicId] = useState<string>(() => topics[0]?.id ?? '')
  const [text, setText] = useState('')
  const [count, setCount] = useState(8)
  const [model, setModel] = useState<AIModel>('gemini-2.5-flash')
  const [busy, setBusy] = useState(false)
  const [current, setCurrent] = useState<DeckRecord | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [theme, setTheme] = useState<SlideThemeId>('navy')
  const [usePhoto, setUsePhoto] = useState(false)

  const hasInput = mode === 'topic' ? topics.length > 0 : text.trim().length > 0

  async function run() {
    if (busy || !hasInput) return
    const topic = topics.find((t) => t.id === topicId) ?? topics[0]
    const source = mode === 'topic' ? `課題：${topic?.topic ?? ''}` : text.trim()
    const fallbackTitle = mode === 'topic' ? (topic?.topic ?? '教學簡報') : '教學簡報'
    setBusy(true)
    try {
      const raw = await complete({
        system: buildSlideSystem(subjectName, count),
        messages: [{ role: 'user', content: source }],
        model,
        temperature: 0.5,
      })
      const deck = parseDeck(raw, fallbackTitle)
      const rec = slideDecksCol.add({
        createdAt: new Date().toISOString(),
        topicName: mode === 'topic' ? (topic?.topic ?? '') : deck.title,
        model,
        title: deck.title,
        subtitle: deck.subtitle,
        slides: deck.slides,
      })
      setCurrent(rec)
      toast.success(`簡報已生成（${deck.slides.length} 版）`)
    } catch (e) {
      toast.error((e as Error).message || '生成失敗，請再試。')
    } finally {
      setBusy(false)
    }
  }

  async function download(rec: DeckRecord) {
    setDownloading(true)
    try {
      let coverPhoto: { dataUri: string; credit: string } | undefined
      if (usePhoto && isStockConfigured) {
        const photo = await fetchCoverPhoto(`${rec.subtitle || subjectName || rec.title} 教學`)
        if (photo) coverPhoto = { dataUri: photo.dataUri, credit: photo.credit }
      }
      await downloadPptx({ title: rec.title, subtitle: rec.subtitle, slides: rec.slides }, rec.title, theme, coverPhoto)
      toast.success('已下載 PowerPoint')
    } catch (e) {
      toast.error((e as Error).message || '下載失敗')
    } finally {
      setDownloading(false)
    }
  }

  async function del(id: string) {
    const ok = await confirm({ title: '刪除呢套簡報？', tone: 'danger', confirmText: '刪除' })
    if (!ok) return
    slideDecksCol.remove(id)
    if (current?.id === id) setCurrent(null)
  }

  if (!isAIConfigured) {
    return (
      <EmptyState
        icon={Presentation}
        title="教學簡報未啟用"
        hint="要設定好 Supabase 並部署 gemini Edge Function 先用到。步驟見 docs/SETUP.md。"
      />
    )
  }

  return (
    <div className="space-y-5">
      <header className="min-w-0">
        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
          <Presentation size={13} className="shrink-0" />
          教學備課 · Slides
        </p>
        <h1 className="mt-1 font-serif text-[26px] font-semibold leading-none tracking-tight text-slate-800 dark:text-slate-100 sm:text-[30px]">
          教學簡報
        </h1>
        <p className="mt-2 text-[13px] text-slate-500 dark:text-slate-400">
          揀課題或貼內容，AI 生成 PowerPoint 大綱（封面 + 逐版重點 + 講者備註），一鍵下載 .pptx。
        </p>
      </header>

      {/* 輸入 */}
      <Card padded className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SegmentedControl options={MODE_OPTS} value={mode} onChange={setMode} />
          <Tooltip label="Flash 快 · Pro 強">
            <SegmentedControl size="sm" options={MODEL_OPTS} value={model} onChange={setModel} />
          </Tooltip>
        </div>

        {mode === 'topic' ? (
          <Field label="課題">
            <Select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.topic}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label="內容">
            <Textarea
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="貼上課題大綱、筆記或教學重點…"
            />
          </Field>
        )}

        <div className="flex flex-wrap items-end justify-between gap-3">
          <Field label="版數">
            <Select value={String(count)} onChange={(e) => setCount(Number(e.target.value))}>
              {[6, 8, 10, 12].map((n) => (
                <option key={n} value={n}>
                  約 {n} 版
                </option>
              ))}
            </Select>
          </Field>
          <Button icon={Sparkles} onClick={run} loading={busy} disabled={!hasInput}>
            {busy ? '生成緊…' : '生成簡報'}
          </Button>
        </div>
      </Card>

      {busy && (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-slate-400">
          <Loader2 size={16} className="animate-spin text-accent" /> 由 AI 設計緊簡報…
        </div>
      )}

      {/* 結果 */}
      {current && (
        <DeckView
          rec={current}
          onDownload={() => download(current)}
          downloading={downloading}
          theme={theme}
          onTheme={setTheme}
          usePhoto={usePhoto}
          onUsePhoto={setUsePhoto}
        />
      )}

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
                <div className="flex items-center gap-2.5">
                  <Presentation size={16} className="shrink-0 text-accent" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                      {r.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                      {fmtDate(r.createdAt)} · {r.slides.length} 版
                    </p>
                  </div>
                  <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                    <IconButton label="下載" size="sm" onClick={() => void download(r)}>
                      <Download size={14} />
                    </IconButton>
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
          icon={Presentation}
          title="未有簡報"
          hint="揀課題或貼內容，生成第一套教學 PowerPoint。"
        />
      )}
    </div>
  )
}

function DeckView({
  rec,
  onDownload,
  downloading,
  theme,
  onTheme,
  usePhoto,
  onUsePhoto,
}: {
  rec: DeckRecord
  onDownload: () => void
  downloading: boolean
  theme: SlideThemeId
  onTheme: (t: SlideThemeId) => void
  usePhoto: boolean
  onUsePhoto: (v: boolean) => void
}) {
  return (
    <Card padded className="space-y-4 ring-1 ring-accent/20">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent" icon={Presentation}>
          {rec.slides.length} 版
        </Badge>
        <h2 className="min-w-0 flex-1 text-base font-semibold tracking-tight text-slate-800 dark:text-slate-100">
          {rec.title}
        </h2>
        <Button icon={Download} onClick={onDownload} loading={downloading}>
          下載 PowerPoint
        </Button>
      </div>
      {rec.subtitle && <p className="text-[13px] text-slate-500 dark:text-slate-400">{rec.subtitle}</p>}

      {/* 模板主題揀選（下載 .pptx 時套用） */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">模板主題</span>
        {SLIDE_THEMES.map((th) => (
          <button
            key={th.id}
            type="button"
            onClick={() => onTheme(th.id)}
            aria-pressed={theme === th.id}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition active:scale-[0.97]',
              theme === th.id
                ? 'border-accent bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent'
                : 'border-black/[0.08] text-slate-600 hover:bg-black/[0.03] dark:border-white/10 dark:text-slate-300',
            )}
          >
            <span className="h-3 w-3 rounded-full" style={{ background: th.swatch }} />
            {th.name}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-black/[0.08] dark:bg-white/10" />
        <button
          type="button"
          onClick={() => onUsePhoto(!usePhoto)}
          disabled={!isStockConfigured}
          aria-pressed={usePhoto && isStockConfigured}
          title={isStockConfigured ? '封面用 Pexels 免費相片' : '需先設定 VITE_PEXELS_KEY 環境變數'}
          className={cx(
            'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50',
            usePhoto && isStockConfigured
              ? 'border-accent bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent'
              : 'border-black/[0.08] text-slate-600 hover:bg-black/[0.03] dark:border-white/10 dark:text-slate-300',
          )}
        >
          <ImageIcon size={13} /> 封面相片
        </button>
      </div>

      <div className="space-y-2">
        {rec.slides.map((s, i) => (
          <div
            key={i}
            className="rounded-xl border border-black/[0.06] bg-slate-50/60 p-3 dark:border-white/[0.08] dark:bg-slate-800/40"
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-accent-soft text-[11px] font-semibold text-accent-strong dark:bg-accent/15 dark:text-accent">
                {i + 1}
              </span>
              <p className="min-w-0 flex-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
                {s.title}
              </p>
              {s.chart && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
                  <BarChart3 size={11} /> 圖表
                </span>
              )}
            </div>
            {s.bullets.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 pl-7">
                {s.bullets.map((b, bi) => (
                  <li key={bi} className="flex gap-1.5 text-[13px] text-slate-600 dark:text-slate-300">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent/60" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
            {s.notes && (
              <p className="mt-1.5 flex items-start gap-1.5 pl-7 text-[11px] text-slate-400 dark:text-slate-500">
                <StickyNote size={11} className="mt-0.5 shrink-0" />
                {s.notes}
              </p>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}
