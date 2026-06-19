import { useCallback, useMemo, useState, type ReactNode } from 'react'
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
  Images,
  Hash,
  Columns2,
  ListOrdered,
  Quote,
  LayoutGrid,
  Pencil,
  ChevronUp,
  ChevronDown,
  Plus,
  ListTree,
  RefreshCw,
  StopCircle,
  Wand2,
  ArrowLeft,
  ArrowRight,
  Upload,
  ClipboardList,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
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
import { streamChat, isAIConfigured, type AIModel } from '../../../lib/aiClient'
import { topicsCol } from '../../../data/collections'
import { getSubjectPack } from '../../../data/subjects'
import {
  downloadPptx,
  SLIDE_PACKS,
  type SlidePackId,
  type SlideImage,
  fetchCoverPhoto,
  fetchSlidePhoto,
  isStockConfigured,
  renderTitleImage,
  hasTitleFont,
} from '../../../lib/export'
import type { Slide } from '../../../lib/export/types'
import { slideDecksCol, type DeckRecord } from './slideStore'
import { buildSlideSystem, buildFrameworkSystem, parseDeck } from './slidePrompts'
import { createDeckStreamParser, type DeckStreamMeta } from './streamDeck'
import { refineDeck, mergeRefinedDeck } from './refineDeck'
import { parseManualPages, frameworkToDeck, detectManualPages } from './manualPages'
import { slideSourceKey } from './sourceKey'
import SlideEditor from './editor/SlideEditor'
import DeckPreview from './preview/DeckPreview'
import StepRail, { type StepDef } from './studio/StepRail'
import PackGallery from './studio/PackGallery'
import UploadDrop from './studio/UploadDrop'
import { SAMPLE_DECK } from './studio/sampleDeck'

type Mode = 'topic' | 'text'
/** 起點：揀課題 / 貼內容 / 上載教材（mode 由佢 derive：topic→topic，其餘→text） */
type Source = 'topic' | 'paste' | 'upload'

const MODEL_OPTS: { id: AIModel; label: string }[] = [
  { id: 'gemini-2.5-flash', label: 'Flash' },
  { id: 'gemini-2.5-pro', label: 'Pro' },
]

const STEPS: StepDef[] = [
  { id: 1, label: '起點' },
  { id: 2, label: '設計' },
  { id: 3, label: '設定' },
  { id: 4, label: '生成' },
]

const SOURCE_CARDS: { id: Source; icon: LucideIcon; title: string; desc: string }[] = [
  { id: 'topic', icon: ListTree, title: '揀課題', desc: '由你嘅課題庫一鍵帶入' },
  { id: 'paste', icon: ClipboardList, title: '貼內容', desc: '大綱、筆記、教學重點' },
  { id: 'upload', icon: Upload, title: '上載教材', desc: 'PDF · Word · 文字檔，AI 抽重點' },
]

/** 內頁配圖上限 — 同一 deck 最多攞 4 張內頁相（控制檔案大細＋API 用量） */
const MAX_SLIDE_PHOTOS = 4

/** 預覽列表嘅版式 badge — 對應引擎特別版式（section 由空 bullets 推斷，唔標） */
const LAYOUT_BADGES: Record<string, { label: string; icon: LucideIcon }> = {
  stats: { label: '數據', icon: Hash },
  compare: { label: '對比', icon: Columns2 },
  steps: { label: '步驟', icon: ListOrdered },
  quote: { label: '金句', icon: Quote },
  cards: { label: '卡片', icon: LayoutGrid },
}

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

  // 引導步驟
  const [step, setStep] = useState(1)
  const [maxStep, setMaxStep] = useState(1)
  // 起點 → 衍生生成模式
  const [source, setSource] = useState<Source>('topic')
  const mode: Mode = source === 'topic' ? 'topic' : 'text'

  const [topicId, setTopicId] = useState<string>(() => topics[0]?.id ?? '')
  const [text, setText] = useState('')
  const [uploadBusy, setUploadBusy] = useState(false)
  const [count, setCount] = useState(8)
  const [model, setModel] = useState<AIModel>('gemini-2.5-flash')
  const [busy, setBusy] = useState(false)
  const [current, setCurrent] = useState<DeckRecord | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [pack, setPack] = useState<SlidePackId>('inkwell')
  const [usePhoto, setUsePhoto] = useState(false)
  const [useSlidePhotos, setUseSlidePhotos] = useState(true)
  // 高擬真標題：用招牌字體 Canvas render 封面標題（圖，跨平台一致；中文 latin 字體會自動 fallback）
  const [highFi, setHighFi] = useState(false)
  // 「跟我嘅分段分版」：--- 或空行斬版，AI 只執靚唔改分頁
  const [followPages, setFollowPages] = useState(false)
  // 逐版編輯器
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  // 同內容自動重用：當前顯示緊嘅係呢個 key 嘅重用版本（用嚟顯示「重新生成」退路）
  const [reusedKey, setReusedKey] = useState<string | null>(null)
  // 串流逐版生成：邊收 delta 邊砌預覽（落地仍以 parseDeck 為真相）
  const [streamSlides, setStreamSlides] = useState<Slide[]>([])
  const [streamMeta, setStreamMeta] = useState<DeckStreamMeta>({})
  const [abortCtl, setAbortCtl] = useState<AbortController | null>(null)
  // AI 再潤飾（可選、可還原）
  const [refining, setRefining] = useState(false)
  const [lastBeforeRefine, setLastBeforeRefine] = useState<DeckRecord | null>(null)

  const hasInput = mode === 'topic' ? topics.length > 0 : text.trim().length > 0

  // 上載抽取嘅文字交返嚟（穩定 ref，UploadDrop effect 用）
  const handleUploadText = useCallback((t: string, b: boolean) => {
    setText(t)
    setUploadBusy(b)
  }, [])

  function chooseSource(s: Source) {
    setSource(s)
    if (s !== 'paste') setFollowPages(false)
    if (s !== 'upload') setUploadBusy(false)
  }

  // 當前輸入嘅內容指紋（同 run 入面計法一致）
  const currentKey = useMemo(() => {
    const topic = topics.find((t) => t.id === topicId) ?? topics[0]
    const pages = source === 'paste' && followPages ? parseManualPages(text) : []
    return slideSourceKey({
      mode,
      text,
      topicId,
      topicText: topic?.topic ?? '',
      count,
      framework: pages.length >= 2,
      pageCount: pages.length,
      model,
    })
  }, [mode, source, text, topicId, topics, count, followPages, model])

  async function run(force = false) {
    if (busy || !hasInput) return
    const topic = topics.find((t) => t.id === topicId) ?? topics[0]
    const aiInput = mode === 'topic' ? `課題：${topic?.topic ?? ''}` : text.trim()
    const fallbackTitle = mode === 'topic' ? (topic?.topic ?? '教學簡報') : '教學簡報'
    // 「跟我嘅分段分版」：要 ≥2 段先有意義（只限「貼內容」）
    const pages = source === 'paste' && followPages ? parseManualPages(text) : []
    const frameworkMode = pages.length >= 2

    // 同內容自動重用：搵返最新一份同指紋嘅舊簡報，直接攞唔再行 AI。
    if (!force) {
      const cached = history.find((r) => r.sourceKey === currentKey)
      if (cached) {
        setCurrent(cached)
        setReusedKey(currentKey)
        setEditingIndex(null)
        toast.success('用回之前生成咗的版本（慳 AI；想重新做可㩒「重新生成」）')
        return
      }
    }
    setReusedKey(null)
    setBusy(true)
    setStreamSlides([])
    setStreamMeta({})
    const ctl = new AbortController()
    setAbortCtl(ctl)
    let aborted = false
    try {
      // 串流逐版生成：邊收 delta 邊砌預覽（樂觀渲染）；落地以 parseDeck(fullRaw) 為真相。
      const parser = createDeckStreamParser()
      let raw = ''
      try {
        for await (const chunk of streamChat({
          system: frameworkMode
            ? buildFrameworkSystem(subjectName, pages, pack)
            : buildSlideSystem(subjectName, count, pack),
          messages: [{ role: 'user', content: aiInput }],
          model,
          temperature: 0.5,
          source: 'slides',
          signal: ctl.signal,
        })) {
          raw += chunk
          const r = parser.push(chunk)
          if (r.meta) setStreamMeta((m) => ({ ...m, ...r.meta }))
          if (r.slides.length) setStreamSlides((s) => [...s, ...r.slides])
        }
      } catch (streamErr) {
        if (ctl.signal.aborted) {
          aborted = true
        } else {
          throw streamErr
        }
      }
      if (aborted) {
        toast.info('已停止生成')
        return
      }
      let deck = parseDeck(raw, fallbackTitle)
      // 鐵律保險：AI 版數對唔上 → 照你嘅分段直接入版，分頁永遠唔會被打亂
      if (frameworkMode && deck.slides.length !== pages.length) {
        deck = { ...frameworkToDeck(pages, deck.title || fallbackTitle), subtitle: deck.subtitle, coverImageQuery: deck.coverImageQuery }
        toast.info('AI 分版對唔上你嘅分段，已照你嘅分段直接入版（可逐版再執）')
      }
      const rec = slideDecksCol.add({
        createdAt: new Date().toISOString(),
        topicName: mode === 'topic' ? (topic?.topic ?? '') : deck.title,
        model,
        title: deck.title,
        subtitle: deck.subtitle,
        slides: deck.slides,
        coverImageQuery: deck.coverImageQuery,
        sourceKey: currentKey, // 內容指紋：下次同內容直接重用、唔再行 AI
      })
      setCurrent(rec)
      setLastBeforeRefine(null)
      toast.success(`簡報已生成（${deck.slides.length} 版）`)
    } catch (e) {
      if (!aborted) toast.error((e as Error).message || '生成失敗，請再試。')
    } finally {
      setBusy(false)
      setAbortCtl(null)
      setStreamSlides([])
      setStreamMeta({})
    }
  }

  function stopRun() {
    abortCtl?.abort()
  }

  async function download(rec: DeckRecord) {
    setDownloading(true)
    try {
      // 封面相 — 優先用 AI 出嘅英文搜尋詞，冇就退返副題／科目／標題
      let coverPhoto: SlideImage | undefined
      if (usePhoto && isStockConfigured) {
        const photo = await fetchCoverPhoto(
          rec.coverImageQuery || `${rec.subtitle || subjectName || rec.title} 教學`,
        )
        if (photo) coverPhoto = photo
      }
      // 內頁配圖 — AI 標咗 imageQuery 嘅頭 4 版並行攞相，攞唔到嗰版靜默略過
      let slidePhotos: Record<number, SlideImage> | undefined
      if (useSlidePhotos && isStockConfigured) {
        const targets = rec.slides
          .map((s, i) => (s.imageQuery ? { index: i, query: s.imageQuery } : null))
          .filter((t): t is { index: number; query: string } => t !== null)
          .slice(0, MAX_SLIDE_PHOTOS)
        if (targets.length > 0) {
          const photos = await Promise.all(targets.map((t) => fetchSlidePhoto(t.query)))
          const found: Record<number, SlideImage> = {}
          photos.forEach((p, i) => {
            if (p) found[targets[i].index] = p
          })
          if (Object.keys(found).length > 0) slidePhotos = found
        }
      }
      // 高擬真標題（招牌字體 → 圖）；失敗／中文 latin 字體會回 null → 引擎用原生標題
      let coverTitle
      if (highFi && hasTitleFont(pack)) {
        const meta = SLIDE_PACKS.find((p) => p.id === pack)
        coverTitle = (await renderTitleImage(rec.title, pack, meta?.ink ?? '1A1A1A', 160)) ?? undefined
      }
      await downloadPptx(
        {
          title: rec.title,
          subtitle: rec.subtitle,
          slides: rec.slides,
          coverImageQuery: rec.coverImageQuery,
        },
        rec.title,
        { pack, coverPhoto, slidePhotos, coverTitle },
      )
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

  // ───────── 逐版操作（即時 persist 落 collection + 同步 current）─────────

  function updateSlides(slides: Slide[]) {
    if (!current) return
    slideDecksCol.update(current.id, { slides })
    setCurrent({ ...current, slides })
  }

  async function refine() {
    if (!current || refining) return
    setRefining(true)
    const before = current
    try {
      const refined = await refineDeck(
        {
          title: current.title,
          subtitle: current.subtitle,
          slides: current.slides,
          coverImageQuery: current.coverImageQuery,
        },
        { subjectName, pack, model: 'gemini-2.5-flash' },
      )
      const merged = mergeRefinedDeck(
        { title: before.title, subtitle: before.subtitle, slides: before.slides, coverImageQuery: before.coverImageQuery },
        refined,
      )
      setLastBeforeRefine(before)
      slideDecksCol.update(current.id, {
        title: merged.title,
        subtitle: merged.subtitle,
        slides: merged.slides,
        coverImageQuery: merged.coverImageQuery,
      })
      setCurrent({ ...current, ...merged })
      toast.success('已 AI 再潤飾（可還原）')
    } catch (e) {
      toast.error((e as Error).message || '潤飾失敗')
    } finally {
      setRefining(false)
    }
  }

  function restoreRefine() {
    if (!current || !lastBeforeRefine) return
    const b = lastBeforeRefine
    slideDecksCol.update(current.id, {
      title: b.title,
      subtitle: b.subtitle,
      slides: b.slides,
      coverImageQuery: b.coverImageQuery,
    })
    setCurrent({ ...current, title: b.title, subtitle: b.subtitle, slides: b.slides, coverImageQuery: b.coverImageQuery })
    setLastBeforeRefine(null)
    toast.success('已還原潤飾前版本')
  }

  function saveSlide(i: number, s: Slide) {
    if (!current) return
    const slides = [...current.slides]
    slides[i] = s
    updateSlides(slides)
    setEditingIndex(null)
  }

  function moveSlide(i: number, dir: -1 | 1) {
    if (!current) return
    const j = i + dir
    if (j < 0 || j >= current.slides.length) return
    const slides = [...current.slides]
    ;[slides[i], slides[j]] = [slides[j], slides[i]]
    updateSlides(slides)
  }

  async function deleteSlide(i: number) {
    if (!current) return
    if (current.slides.length <= 1) {
      toast.error('至少要留一版')
      return
    }
    const ok = await confirm({ title: `刪除第 ${i + 1} 版？`, tone: 'danger', confirmText: '刪除' })
    if (!ok) return
    updateSlides(current.slides.filter((_, j) => j !== i))
  }

  function addSlide() {
    if (!current) return
    const slides = [...current.slides, { title: '新一版', bullets: ['要點一', '要點二'] }]
    updateSlides(slides)
    setEditingIndex(slides.length - 1) // 即入編輯
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

  function goStep(n: number) {
    setStep(n)
    setMaxStep((m) => Math.max(m, n))
  }

  // Step 1 要有有效輸入先可以「下一步」；其餘步驟有預設值，隨時可前進。
  const canNext =
    step !== 1
      ? true
      : mode === 'topic'
        ? topics.length > 0
        : source === 'upload'
          ? text.trim().length > 0 && !uploadBusy
          : text.trim().length > 0

  // 右邊預覽：步驟 1-3 示意 SAMPLE；生成中用 stream；完成用 current。
  const previewDeck = current
    ? { title: current.title, subtitle: current.subtitle, slides: current.slides, coverImageQuery: current.coverImageQuery }
    : streamSlides.length > 0
      ? {
          title: streamMeta.title || '生成中…',
          subtitle: streamMeta.subtitle,
          slides: streamSlides,
          coverImageQuery: streamMeta.coverImageQuery,
        }
      : SAMPLE_DECK
  const previewIsSample = !current && streamSlides.length === 0

  return (
    <div className="space-y-5">
      <header className="min-w-0">
        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
          <Presentation size={13} className="shrink-0" />
          教學備課 · Slides
        </p>
        <h1 className="mt-1 text-[26px] font-semibold leading-none tracking-tight text-slate-800 dark:text-slate-100 sm:text-[30px]">
          簡報工作室
        </h1>
        <p className="mt-2 text-[13px] text-slate-500 dark:text-slate-400">
          四步引導：揀起點 → 揀設計 → 設定 → 生成。{SLIDE_PACKS.length} 套模板、上載教材自動抽重點、右邊即時預覽，一鍵下載 .pptx。
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
        {/* 左：引導 */}
        <div className="min-w-0 space-y-4">
          <StepRail steps={STEPS} current={step} maxReached={maxStep} onJump={goStep} />

          <Card padded className="space-y-4">
            {step === 1 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">你想點開始？</h3>
                <div className="grid gap-2.5 sm:grid-cols-3">
                  {SOURCE_CARDS.map((c) => {
                    const active = source === c.id
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => chooseSource(c.id)}
                        aria-pressed={active}
                        className={cx(
                          'flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition active:scale-[0.98]',
                          active
                            ? 'border-accent bg-accent-soft/50 ring-1 ring-accent/30 dark:bg-accent/10'
                            : 'border-black/[0.08] hover:border-accent/40 hover:bg-black/[0.02] dark:border-white/10 dark:hover:bg-white/[0.03]',
                        )}
                      >
                        <span
                          className={cx(
                            'flex h-8 w-8 items-center justify-center rounded-lg',
                            active
                              ? 'bg-accent text-white'
                              : 'bg-black/[0.05] text-slate-500 dark:bg-white/10 dark:text-slate-300',
                          )}
                        >
                          <c.icon size={17} />
                        </span>
                        <span
                          className={cx(
                            'text-sm font-semibold',
                            active ? 'text-accent-strong dark:text-accent' : 'text-slate-700 dark:text-slate-200',
                          )}
                        >
                          {c.title}
                        </span>
                        <span className="text-[11px] leading-tight text-slate-400 dark:text-slate-500">{c.desc}</span>
                      </button>
                    )
                  })}
                </div>

                {source === 'topic' &&
                  (topics.length > 0 ? (
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
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                      仲未有課題。去「課題」加返，或改用「貼內容 / 上載教材」。
                    </p>
                  ))}

                {source === 'paste' && (
                  <Field label="內容">
                    <Textarea
                      rows={6}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder={'貼上課題大綱、筆記或教學重點…\n想自己控制分頁：用 --- 或空行分段，每段首行做該版標題，再開「跟我嘅分段分版」。'}
                    />
                  </Field>
                )}

                {source === 'upload' && <UploadDrop onChange={handleUploadText} />}

                {source === 'paste' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <ToggleChip active={followPages} onClick={() => setFollowPages((v) => !v)} icon={ListTree}>
                      跟我嘅分段分版
                    </ToggleChip>
                    {followPages ? (
                      <span className="text-[11px] text-slate-400">
                        {(() => {
                          const n = parseManualPages(text).length
                          return n >= 2
                            ? `會出剛好 ${n} 版（分頁鎖死，AI 只執靚每版文字）`
                            : '要至少 2 段（--- 或空行分隔）先生效'
                        })()}
                      </span>
                    ) : (
                      detectManualPages(text) && (
                        <span className="text-[11px] text-amber-600 dark:text-amber-400">
                          偵測到你嘅內容有分段 — 開呢個掣可以鎖住你嘅分頁
                        </span>
                      )
                    )}
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">揀個設計</h3>
                  <span className="text-[11px] text-slate-400">{SLIDE_PACKS.length} 套 · 揀完睇右邊預覽</span>
                </div>
                <PackGallery pack={pack} onPack={setPack} />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">設定</h3>
                <div className="flex flex-wrap items-end gap-4">
                  <Field label="版數">
                    <Select
                      value={String(count)}
                      onChange={(e) => setCount(Number(e.target.value))}
                      disabled={source === 'paste' && followPages}
                      title={source === 'paste' && followPages ? '分版跟你嘅分段，版數唔使揀' : undefined}
                    >
                      {[6, 8, 10, 12].map((n) => (
                        <option key={n} value={n}>
                          約 {n} 版
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="AI 模型">
                    <Tooltip label="Flash 快 · Pro 強">
                      <SegmentedControl size="sm" options={MODEL_OPTS} value={model} onChange={setModel} />
                    </Tooltip>
                  </Field>
                </div>
                {source === 'paste' && followPages && (
                  <p className="text-[11px] text-slate-400">已開「跟我嘅分段分版」：版數鎖住跟你嘅分段。</p>
                )}

                <div className="space-y-2">
                  <span className="block text-[11px] font-medium uppercase tracking-wider text-slate-400">配圖</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <ToggleChip
                      active={usePhoto && isStockConfigured}
                      disabled={!isStockConfigured}
                      onClick={() => setUsePhoto(!usePhoto)}
                      icon={ImageIcon}
                      title={isStockConfigured ? '封面用 Pexels 免費相片' : '需先設定 VITE_PEXELS_KEY 環境變數'}
                    >
                      封面相片
                    </ToggleChip>
                    <ToggleChip
                      active={useSlidePhotos && isStockConfigured}
                      disabled={!isStockConfigured}
                      onClick={() => setUseSlidePhotos(!useSlidePhotos)}
                      icon={Images}
                      title={
                        isStockConfigured
                          ? 'AI 標咗配圖嘅內頁自動配 Pexels 相片（最多 4 版）'
                          : '需先設定 VITE_PEXELS_KEY 環境變數'
                      }
                    >
                      內頁配圖
                    </ToggleChip>
                    {hasTitleFont(pack) && (
                      <ToggleChip
                        active={highFi}
                        onClick={() => setHighFi(!highFi)}
                        icon={Sparkles}
                        title="封面標題用招牌字體 render 成圖（跨平台一致；標題變圖、唔可喺 PPT 改）"
                      >
                        高擬真標題
                      </ToggleChip>
                    )}
                  </div>
                  {!isStockConfigured && (
                    <p className="text-[11px] text-slate-400">配圖需要設定 VITE_PEXELS_KEY 環境變數先用到。</p>
                  )}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">生成簡報</h3>
                    <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                      {SOURCE_CARDS.find((c) => c.id === source)?.title} ·{' '}
                      {SLIDE_PACKS.find((p) => p.id === pack)?.name} · 約 {count} 版 ·{' '}
                      {model === 'gemini-2.5-flash' ? 'Flash' : 'Pro'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {busy ? (
                      <Button variant="ghost" icon={StopCircle} onClick={stopRun}>
                        停止
                      </Button>
                    ) : (
                      <>
                        {reusedKey === currentKey && (
                          <Button variant="ghost" icon={RefreshCw} onClick={() => void run(true)}>
                            重新生成
                          </Button>
                        )}
                        <Button icon={Sparkles} onClick={() => void run()} loading={busy} disabled={!hasInput}>
                          {current ? '再生成' : '生成簡報'}
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {busy && (
                  <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <Loader2 size={16} className="animate-spin text-accent" />
                    {streamSlides.length > 0
                      ? `由 AI 設計緊… 已生成 ${streamSlides.length} 版`
                      : '由 AI 設計緊…'}
                  </p>
                )}

                {current && !busy && (
                  <ResultPanel
                    rec={current}
                    downloading={downloading}
                    onDownload={() => void download(current)}
                    onRefine={() => void refine()}
                    refining={refining}
                    canRestore={lastBeforeRefine !== null}
                    onRestore={restoreRefine}
                    onEdit={setEditingIndex}
                    onMove={moveSlide}
                    onDelete={(i) => void deleteSlide(i)}
                    onAdd={addSlide}
                  />
                )}

                {!current && !busy && (
                  <p className="rounded-lg bg-slate-50 px-3 py-3 text-center text-[12px] text-slate-400 dark:bg-slate-800/40 dark:text-slate-500">
                    撳「生成簡報」，AI 會即時逐版砌出嚟，右邊睇住效果。
                  </p>
                )}
              </div>
            )}
          </Card>

          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              icon={ArrowLeft}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
            >
              上一步
            </Button>
            {step < 4 ? (
              <Button icon={ArrowRight} onClick={() => goStep(step + 1)} disabled={!canNext}>
                下一步
              </Button>
            ) : (
              <span className="text-[11px] text-slate-400">
                {busy ? '生成緊…' : current ? '可下載，或返上一步改設定再生成' : '撳「生成簡報」開始'}
              </span>
            )}
          </div>
        </div>

        {/* 右：即時預覽 */}
        <aside className="space-y-2 lg:sticky lg:top-4 lg:self-start">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">即時預覽</span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              {previewIsSample ? '風格示意（揀模板睇效果）' : busy ? '生成緊…' : '你嘅簡報'}
            </span>
          </div>
          <DeckPreview
            deck={previewDeck}
            pack={pack}
            cols={2}
            streaming={busy}
            onSelect={current ? setEditingIndex : undefined}
          />
        </aside>
      </div>

      {/* 逐版編輯器 */}
      {current && editingIndex !== null && current.slides[editingIndex] && (
        <SlideEditor
          slide={current.slides[editingIndex]}
          index={editingIndex}
          model={model}
          onSave={(s) => saveSlide(editingIndex, s)}
          onClose={() => setEditingIndex(null)}
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
                onClick={() => {
                  setCurrent(r)
                  setLastBeforeRefine(null)
                  goStep(4)
                }}
                className={cx('p-3', current?.id === r.id && 'ring-1 ring-accent/30')}
              >
                <div className="flex items-center gap-2.5">
                  <Presentation size={16} className="shrink-0 text-accent" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{r.title}</p>
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
    </div>
  )
}

/** 細 toggle chip — 設定步驟／分段掣共用 */
function ToggleChip({
  active,
  disabled,
  onClick,
  icon: Icon,
  title,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  icon: LucideIcon
  title?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      title={title}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50',
        active
          ? 'border-accent bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent'
          : 'border-black/[0.08] text-slate-600 hover:bg-black/[0.03] dark:border-white/10 dark:text-slate-300',
      )}
    >
      <Icon size={13} /> {children}
    </button>
  )
}

/** 結果面板 — 生成後嘅 actions（再潤飾／還原／下載）+ 可逐版編輯嘅清單。 */
function ResultPanel({
  rec,
  downloading,
  onDownload,
  onRefine,
  refining,
  canRestore,
  onRestore,
  onEdit,
  onMove,
  onDelete,
  onAdd,
}: {
  rec: DeckRecord
  downloading: boolean
  onDownload: () => void
  onRefine: () => void
  refining: boolean
  canRestore: boolean
  onRestore: () => void
  onEdit: (i: number) => void
  onMove: (i: number, dir: -1 | 1) => void
  onDelete: (i: number) => void
  onAdd: () => void
}) {
  return (
    <div className="space-y-3 rounded-xl border border-accent/20 bg-accent-soft/20 p-3 dark:bg-accent/[0.06]">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent" icon={Presentation}>
          {rec.slides.length} 版
        </Badge>
        <h3 className="min-w-0 flex-1 text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-100">
          {rec.title}
        </h3>
        {canRestore && (
          <Button variant="ghost" icon={RefreshCw} onClick={onRestore} disabled={refining}>
            還原
          </Button>
        )}
        <Tooltip label="用 AI 重整結構／文案（可還原，唔影響主生成）">
          <Button variant="ghost" icon={Wand2} onClick={onRefine} loading={refining}>
            AI 再潤飾
          </Button>
        </Tooltip>
        <Button icon={Download} onClick={onDownload} loading={downloading}>
          下載 PowerPoint
        </Button>
      </div>
      {rec.subtitle && <p className="text-[12px] text-slate-500 dark:text-slate-400">{rec.subtitle}</p>}
      <p className="text-[11px] text-slate-400 dark:text-slate-500">㩒任何一版可逐版編輯。</p>

      <div className="space-y-2">
        {rec.slides.map((s, i) => {
          const layoutBadge = s.layout ? LAYOUT_BADGES[s.layout] : undefined
          return (
            <div
              key={i}
              className="group rounded-xl border border-black/[0.06] bg-white/70 p-3 transition hover:border-accent/30 dark:border-white/[0.08] dark:bg-slate-800/40"
            >
              <div className="flex items-center gap-2">
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-accent-soft text-[11px] font-semibold text-accent-strong dark:bg-accent/15 dark:text-accent">
                  {i + 1}
                </span>
                <p className="min-w-0 flex-1 text-sm font-semibold text-slate-700 dark:text-slate-200">{s.title}</p>
                <span className="flex shrink-0 items-center opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                  <IconButton label="上移" size="sm" onClick={() => onMove(i, -1)} disabled={i === 0}>
                    <ChevronUp size={14} />
                  </IconButton>
                  <IconButton
                    label="下移"
                    size="sm"
                    onClick={() => onMove(i, 1)}
                    disabled={i === rec.slides.length - 1}
                  >
                    <ChevronDown size={14} />
                  </IconButton>
                  <IconButton label="刪除呢版" size="sm" tone="danger" onClick={() => onDelete(i)}>
                    <Trash2 size={14} />
                  </IconButton>
                </span>
                <IconButton label="編輯呢版" size="sm" onClick={() => onEdit(i)}>
                  <Pencil size={14} />
                </IconButton>
                {layoutBadge && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
                    <layoutBadge.icon size={11} /> {layoutBadge.label}
                  </span>
                )}
                {s.chart && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
                    <BarChart3 size={11} /> 圖表
                  </span>
                )}
                {s.imageQuery && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                    <ImageIcon size={11} /> 配圖
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
          )
        })}
        <button
          type="button"
          onClick={onAdd}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-black/[0.08] py-2.5 text-xs font-medium text-slate-400 transition hover:border-accent/40 hover:text-accent dark:border-white/10 dark:text-slate-500"
        >
          <Plus size={14} /> 加一版
        </button>
      </div>
    </div>
  )
}
