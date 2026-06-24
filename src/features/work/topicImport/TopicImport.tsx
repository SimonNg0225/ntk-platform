import { useMemo, useRef, useState } from 'react'
import { Inbox, Upload, Camera, Sparkles, Check, Loader2, ListPlus, Replace, FileText, Settings } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FeatureGuide,
  PageHero,
  SegmentedControl,
  Textarea,
  Tooltip,
  type FeatureGuideStep,
} from '../../../ui'
import CreditMeter from '../../../components/CreditMeter'
import { useToast } from '../../../context/ToastContext'
import { useSettings } from '../../../context/SettingsContext'
import { useNav } from '../../../context/NavContext'
import { useCollection } from '../../../lib/store'
import { complete, isAIConfigured, type AIMessage, type AIModel } from '../../../lib/aiClient'
import { extractFromFile } from '../docDigest/extract'
import { topicsCol } from '../../../data/collections'
import { getSubjectPack } from '../../../data/subjects'
import { buildImportSystem, parseTopics, type ImportedTopic } from './importPrompts'
import { smartApplyTopics, appendTopicsByText } from './applyTopics'

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

const GUIDE_STEPS: FeatureGuideStep[] = [
  {
    title: '揀來源',
    desc: '上載 PDF／Word 課程文件、貼上課題文字，或直接影相。',
  },
  {
    title: '抽取課題',
    desc: '撳「抽取課題」，AI 會讀內容、整理成一條條課題。',
  },
  {
    title: '預覽確認',
    desc: '按範疇分組睇清楚，確認抽得啱先載入。',
  },
  {
    title: '載入做課題',
    desc: '「附加」加喺後面；「智能切換」按課題名保留題庫／進度連繫。',
  },
]

export default function TopicImport() {
  const toast = useToast()
  const nav = useNav()
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
        source: 'topic-import',
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
    const added = appendTopicsByText(imported)
    toast.success(added > 0 ? `已附加 ${added} 個課題` : '呢啲課題已經喺清單入面')
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
      <div className="space-y-5">
        <PageHero
          guideKey="topicImport"
          icon={Inbox}
          kicker="Topic Import"
          title="課題匯入"
          description="上載官方課程指引，AI 抽出課題，一鍵載入做你科嘅課題。"
        />
        <EmptyState
          icon={Inbox}
          title="課題匯入未啟用"
          hint="要設定好 Supabase 並部署 gemini Edge Function 先用到。步驟見 docs/SETUP.md。"
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHero
        icon={Inbox}
        kicker="Topic Import"
        title="課題匯入"
        description="上載官方課程指引／補充資料／syllabus，AI 抽出課題，一鍵載入做你科嘅課題（題庫、進度、出題、指引都會用）。"
      />

      <FeatureGuide
        storageKey="topicImport"
        title="課題匯入點用？"
        steps={GUIDE_STEPS}
      />

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
              className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-accent/40 bg-accent-soft/50 px-4 py-8 text-center transition duration-200 hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98] dark:border-accent/40 dark:bg-accent/10 dark:hover:border-accent"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white">
                {mode === 'photo' ? <Camera size={22} strokeWidth={1.75} /> : <Upload size={22} strokeWidth={1.75} />}
              </span>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                {file ? file.name : mode === 'photo' ? '影相 / 揀相片' : '揀 PDF / Word 課程文件'}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {file
                  ? '撳「抽取課題」開始'
                  : mode === 'photo'
                    ? '對住課程文件影一張清晰相片'
                    : '支援 PDF · Word · 純文字'}
              </span>
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {hasInput ? '準備好喇，撳右邊抽取課題。' : '先揀來源（上載／貼文字／影相）。'}
          </p>
          <div className="flex items-center gap-2">
            <CreditMeter source="topic-import" model={model} />
            <Button icon={busy ? Loader2 : Sparkles} onClick={extract} loading={busy} disabled={!hasInput}>
              {busy ? '抽取中…' : '抽取課題'}
            </Button>
          </div>
        </div>
      </Card>

      {imported ? (
        imported.length > 0 ? (
          <Card padded className="space-y-4 ring-1 ring-accent/20">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="accent" icon={Check}>
                {imported.length} 個課題
              </Badge>
              <span className="flex-1 text-sm text-slate-500 dark:text-slate-400">預覽 — 確認後載入</span>
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
                  <p className="mb-1.5 text-xs font-semibold text-slate-500 dark:text-slate-300">{area}</p>
                  <ul className="space-y-1">
                    {items.map((it, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                        <span className="min-w-0">
                          {it.topic}
                          {it.part && <span className="ml-1 text-xs text-slate-400">· {it.part}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <EmptyState
            icon={FileText}
            title="抽唔到課題"
            hint="可能來源唔係課程文件，或者內容太少。換另一份文件，或試吓影相再抽。"
            action={
              <Button size="sm" variant="secondary" icon={Sparkles} onClick={() => setImported(null)}>
                再試一次
              </Button>
            }
          />
        )
      ) : null}

      {existing.length === 0 ? (
        <section className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200/80 bg-slate-50/60 px-6 py-8 text-center dark:border-slate-700/60 dark:bg-slate-800/40">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
            <Inbox size={22} strokeWidth={1.75} />
          </span>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">你科仲未有課題</p>
          <p className="max-w-xs text-xs text-slate-400 dark:text-slate-500">
            上面抽取一份課程文件就會載入；或者去設定揀返任教科目，帶出官方課程大綱。
          </p>
          <button
            type="button"
            onClick={() => nav.open('settings')}
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-accent transition hover:text-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98]"
          >
            <Settings size={13} />
            去設定揀科目 →
          </button>
        </section>
      ) : (
        <p className="text-xs text-slate-400 dark:text-slate-500">
          現時課題：
          <span className="font-semibold tabular-nums slashed-zero text-slate-500 dark:text-slate-300">{existing.length}</span>
          {' '}個。「附加」會加喺後面；「智能切換」會按課題名保留連繫（題庫／進度唔甩號），冇用嘅先清走。
        </p>
      )}
    </div>
  )
}
