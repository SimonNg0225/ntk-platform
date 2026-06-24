import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
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
  FeatureGuide,
  type FeatureGuideStep,
  Field,
  IconButton,
  PageHero,
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
import { classifyAIError } from '../../../lib/aiError'
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
  const { t } = useTranslation()
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
  const handleUploadText = useCallback((txt: string, b: boolean) => {
    setText(txt)
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
      if (!aborted) toast.error(classifyAIError(e).message, { label: '重試', onClick: () => run(true) })
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
      toast.error(classifyAIError(e).message, { label: '重試', onClick: refine })
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
        title={t('slideGen.aiOff.title', { defaultValue: '簡報工作室未啟用' })}
        hint={t('slideGen.aiOff.hint', {
          defaultValue: '要設定好 Supabase 並部署 gemini Edge Function 先用到 AI 生成（步驟見 docs/SETUP.md）。',
        })}
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

  // 教學引導（4 步：揀起點 → 揀設計 → 設定 → 生成下載）
  const guideSteps: FeatureGuideStep[] = [
    {
      title: t('slideGen.guide.s1.title', { defaultValue: '揀返起點' }),
      desc: t('slideGen.guide.s1.desc', {
        defaultValue: '由課題庫帶入、貼上你嘅大綱筆記，或上載 PDF/Word 教材畀 AI 抽重點。',
      }),
    },
    {
      title: t('slideGen.guide.s2.title', { defaultValue: '揀個設計' }),
      desc: t('slideGen.guide.s2.desc', {
        defaultValue: `由 ${SLIDE_PACKS.length} 套模板揀一套，揀完即刻喺右邊預覽睇到風格。`,
      }),
    },
    {
      title: t('slideGen.guide.s3.title', { defaultValue: '設定版數同配圖' }),
      desc: t('slideGen.guide.s3.desc', {
        defaultValue: '揀大約版數、AI 模型，需要就開封面相／內頁配圖。',
      }),
    },
    {
      title: t('slideGen.guide.s4.title', { defaultValue: '生成、執靚、下載' }),
      desc: t('slideGen.guide.s4.desc', {
        defaultValue: 'AI 逐版砌出嚟，可逐版編輯或 AI 再潤飾，啱晒一鍵下載 .pptx。',
      }),
    },
  ]

  return (
    <div className="space-y-5">
      {/* ───────── 頂部 PageHero（共用 accent hero） ───────── */}
      <PageHero
        guideKey="slide-gen"
        icon={Presentation}
        kicker={t('slideGen.kicker', { defaultValue: 'Slide Studio' })}
        title={t('slideGen.title', { defaultValue: '簡報工作室' })}
        description={t('slideGen.subtitle', {
          defaultValue: '四步引導砌好教學簡報：揀起點、揀設計、設定、生成。右邊即時睇效果，一鍵下載 .pptx。',
        })}
      />

      {/* ───────── 教學引導：點用呢個功能（可摺疊 / 永久收起） ───────── */}
      <FeatureGuide
        storageKey="slide-gen"
        title={t('slideGen.guide.title', { defaultValue: '簡報工作室點用？' })}
        steps={guideSteps}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
        {/* 左：引導 */}
        <div className="min-w-0 space-y-4">
          <StepRail steps={STEPS} current={step} maxReached={maxStep} onJump={goStep} />

          <Card padded className="space-y-4">
            {step === 1 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {t('slideGen.step1.heading', { defaultValue: '你想點開始？' })}
                </h3>
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
                          'group flex flex-col items-start gap-1.5 rounded-2xl border p-3 text-left transition duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                          active
                            ? 'border-accent bg-accent-soft/50 dark:bg-accent/10'
                            : 'border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-md dark:border-slate-700/60 dark:bg-slate-800 dark:hover:border-slate-600',
                        )}
                      >
                        <span
                          className={cx(
                            'flex h-8 w-8 items-center justify-center rounded-xl',
                            active
                              ? 'bg-accent text-white'
                              : 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
                          )}
                        >
                          <c.icon size={16} />
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
                    <Field label={t('slideGen.topic.label', { defaultValue: '課題' })}>
                      <Select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
                        {topics.map((tp) => (
                          <option key={tp.id} value={tp.id}>
                            {tp.topic}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  ) : (
                    <p className="rounded-xl bg-amber-50 px-3 py-2 text-[12px] text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                      {t('slideGen.topic.empty', {
                        defaultValue: '仲未有課題。去「課題」加返，或改用「貼內容 / 上載教材」開始。',
                      })}
                    </p>
                  ))}

                {source === 'paste' && (
                  <Field label={t('slideGen.paste.label', { defaultValue: '內容' })}>
                    <Textarea
                      rows={6}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder={t('slideGen.paste.placeholder', {
                        defaultValue:
                          '貼上課題大綱、筆記或教學重點…\n想自己控制分頁：用 --- 或空行分段，每段首行做該版標題，再開「跟我嘅分段分版」。',
                      })}
                    />
                  </Field>
                )}

                {source === 'upload' && <UploadDrop onChange={handleUploadText} />}

                {source === 'paste' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <ToggleChip active={followPages} onClick={() => setFollowPages((v) => !v)} icon={ListTree}>
                      {t('slideGen.followPages.chip', { defaultValue: '跟我嘅分段分版' })}
                    </ToggleChip>
                    {followPages ? (
                      <span className="text-[11px] text-slate-400">
                        {(() => {
                          const n = parseManualPages(text).length
                          return n >= 2
                            ? t('slideGen.followPages.ok', {
                                defaultValue: `會出剛好 ${n} 版（分頁鎖死，AI 只執靚每版文字）`,
                                n,
                              })
                            : t('slideGen.followPages.need', {
                                defaultValue: '要至少 2 段（--- 或空行分隔）先生效',
                              })
                        })()}
                      </span>
                    ) : (
                      detectManualPages(text) && (
                        <span className="text-[11px] text-amber-600 dark:text-amber-400">
                          {t('slideGen.followPages.detected', {
                            defaultValue: '偵測到你嘅內容有分段 — 開呢個掣可以鎖住你嘅分頁',
                          })}
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
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {t('slideGen.step2.heading', { defaultValue: '揀個設計' })}
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    {t('slideGen.step2.hint', {
                      defaultValue: `${SLIDE_PACKS.length} 套 · 揀完睇右邊預覽`,
                    })}
                  </span>
                </div>
                <PackGallery pack={pack} onPack={setPack} />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {t('slideGen.step3.heading', { defaultValue: '設定' })}
                </h3>
                <div className="flex flex-wrap items-end gap-4">
                  <Field label={t('slideGen.count.label', { defaultValue: '版數' })}>
                    <Select
                      value={String(count)}
                      onChange={(e) => setCount(Number(e.target.value))}
                      disabled={source === 'paste' && followPages}
                      title={
                        source === 'paste' && followPages
                          ? t('slideGen.count.lockedTip', { defaultValue: '分版跟你嘅分段，版數唔使揀' })
                          : undefined
                      }
                    >
                      {[6, 8, 10, 12].map((n) => (
                        <option key={n} value={n}>
                          {t('slideGen.count.option', { defaultValue: `約 ${n} 版`, n })}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t('slideGen.model.label', { defaultValue: 'AI 模型' })}>
                    <Tooltip label={t('slideGen.model.tip', { defaultValue: 'Flash 快 · Pro 強' })}>
                      <SegmentedControl size="sm" options={MODEL_OPTS} value={model} onChange={setModel} />
                    </Tooltip>
                  </Field>
                </div>
                {source === 'paste' && followPages && (
                  <p className="text-[11px] text-slate-400">
                    {t('slideGen.count.lockedNote', {
                      defaultValue: '已開「跟我嘅分段分版」：版數鎖住跟你嘅分段。',
                    })}
                  </p>
                )}

                <div className="space-y-2">
                  <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {t('slideGen.images.label', { defaultValue: '配圖' })}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <ToggleChip
                      active={usePhoto && isStockConfigured}
                      disabled={!isStockConfigured}
                      onClick={() => setUsePhoto(!usePhoto)}
                      icon={ImageIcon}
                      title={
                        isStockConfigured
                          ? t('slideGen.images.coverTip', { defaultValue: '封面用 Pexels 免費相片' })
                          : t('slideGen.images.needKey', { defaultValue: '需先設定 VITE_PEXELS_KEY 環境變數' })
                      }
                    >
                      {t('slideGen.images.cover', { defaultValue: '封面相片' })}
                    </ToggleChip>
                    <ToggleChip
                      active={useSlidePhotos && isStockConfigured}
                      disabled={!isStockConfigured}
                      onClick={() => setUseSlidePhotos(!useSlidePhotos)}
                      icon={Images}
                      title={
                        isStockConfigured
                          ? t('slideGen.images.innerTip', {
                              defaultValue: 'AI 標咗配圖嘅內頁自動配 Pexels 相片（最多 4 版）',
                            })
                          : t('slideGen.images.needKey', { defaultValue: '需先設定 VITE_PEXELS_KEY 環境變數' })
                      }
                    >
                      {t('slideGen.images.inner', { defaultValue: '內頁配圖' })}
                    </ToggleChip>
                    {hasTitleFont(pack) && (
                      <ToggleChip
                        active={highFi}
                        onClick={() => setHighFi(!highFi)}
                        icon={Sparkles}
                        title={t('slideGen.images.highFiTip', {
                          defaultValue: '封面標題用招牌字體 render 成圖（跨平台一致；標題變圖、唔可喺 PPT 改）',
                        })}
                      >
                        {t('slideGen.images.highFi', { defaultValue: '高擬真標題' })}
                      </ToggleChip>
                    )}
                  </div>
                  {!isStockConfigured && (
                    <p className="text-[11px] text-slate-400">
                      {t('slideGen.images.pexelsHint', {
                        defaultValue: '配圖需要設定 VITE_PEXELS_KEY 環境變數先用到。',
                      })}
                    </p>
                  )}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {t('slideGen.step4.heading', { defaultValue: '生成簡報' })}
                    </h3>
                    <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                      {SOURCE_CARDS.find((c) => c.id === source)?.title} ·{' '}
                      {SLIDE_PACKS.find((p) => p.id === pack)?.name} · {t('slideGen.step4.count', { defaultValue: '約' })}{' '}
                      <span className="tabular-nums">{count}</span> 版 ·{' '}
                      {model === 'gemini-2.5-flash' ? 'Flash' : 'Pro'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {busy ? (
                      <Button variant="ghost" icon={StopCircle} onClick={stopRun}>
                        {t('slideGen.action.stop', { defaultValue: '停止' })}
                      </Button>
                    ) : (
                      <>
                        {reusedKey === currentKey && (
                          <Button variant="ghost" icon={RefreshCw} onClick={() => void run(true)}>
                            {t('slideGen.action.regen', { defaultValue: '重新生成' })}
                          </Button>
                        )}
                        <Button icon={Sparkles} onClick={() => void run()} loading={busy} disabled={!hasInput}>
                          {current
                            ? t('slideGen.action.again', { defaultValue: '再生成' })
                            : t('slideGen.action.generate', { defaultValue: '生成簡報' })}
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {busy && (
                  <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <Loader2 size={16} className="animate-spin text-accent" />
                    {streamSlides.length > 0
                      ? t('slideGen.busy.progress', {
                          defaultValue: `由 AI 設計緊… 已生成 ${streamSlides.length} 版`,
                          n: streamSlides.length,
                        })
                      : t('slideGen.busy.start', { defaultValue: '由 AI 設計緊…' })}
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
                  <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200/80 bg-slate-50/60 px-6 py-10 text-center dark:border-slate-700/60 dark:bg-slate-800/40">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                      <Wand2 size={22} strokeWidth={1.75} />
                    </span>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      {t('slideGen.step4.empty.title', { defaultValue: '準備好就開始生成' })}
                    </p>
                    <p className="max-w-xs text-xs text-slate-400 dark:text-slate-500">
                      {t('slideGen.step4.empty.hint', {
                        defaultValue: 'AI 會即時逐版砌出嚟，右邊睇住效果；生成後可逐版執靚。',
                      })}
                    </p>
                    <Button
                      size="sm"
                      icon={Sparkles}
                      onClick={() => void run()}
                      disabled={!hasInput}
                      className="mt-1"
                    >
                      {t('slideGen.action.generate', { defaultValue: '生成簡報' })}
                    </Button>
                    {!hasInput && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400">
                        {t('slideGen.step4.empty.needInput', {
                          defaultValue: '返第 1 步揀返起點先（課題／貼內容／上載教材）。',
                        })}
                      </p>
                    )}
                  </div>
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
              {t('slideGen.nav.prev', { defaultValue: '上一步' })}
            </Button>
            {step < 4 ? (
              <Button icon={ArrowRight} onClick={() => goStep(step + 1)} disabled={!canNext}>
                {t('slideGen.nav.next', { defaultValue: '下一步' })}
              </Button>
            ) : (
              <span className="text-[11px] text-slate-400">
                {busy
                  ? t('slideGen.nav.busy', { defaultValue: '生成緊…' })
                  : current
                    ? t('slideGen.nav.done', { defaultValue: '可下載，或返上一步改設定再生成' })
                    : t('slideGen.nav.idle', { defaultValue: '撳「生成簡報」開始' })}
              </span>
            )}
          </div>
        </div>

        {/* 右：即時預覽 */}
        <aside className="space-y-2 lg:sticky lg:top-4 lg:self-start">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t('slideGen.preview.label', { defaultValue: '即時預覽' })}
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              {previewIsSample
                ? t('slideGen.preview.sample', { defaultValue: '風格示意（揀模板睇效果）' })
                : busy
                  ? t('slideGen.preview.busy', { defaultValue: '生成緊…' })
                  : t('slideGen.preview.yours', { defaultValue: '你嘅簡報' })}
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
          <SectionTitle icon={Clock}>{t('slideGen.history.title', { defaultValue: '歷史' })}</SectionTitle>
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
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                    <Presentation size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{r.title}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                      {fmtDate(r.createdAt)} · <span className="tabular-nums slashed-zero">{r.slides.length}</span> 版
                    </p>
                  </div>
                  <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                    <IconButton label={t('slideGen.action.download', { defaultValue: '下載' })} size="sm" onClick={() => void download(r)}>
                      <Download size={14} />
                    </IconButton>
                    <IconButton label={t('slideGen.action.delete', { defaultValue: '刪除' })} size="sm" tone="danger" onClick={() => void del(r.id)}>
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
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50',
        active
          ? 'border-accent bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent'
          : 'border-slate-200/80 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700/60 dark:text-slate-300 dark:hover:bg-slate-800/60',
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
  const { t } = useTranslation()
  return (
    <div className="space-y-3 rounded-2xl border border-accent/20 bg-accent-soft/20 p-3 dark:bg-accent/[0.06]">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent" icon={Presentation}>
          <span className="tabular-nums slashed-zero">{rec.slides.length}</span> 版
        </Badge>
        <h3 className="min-w-0 flex-1 text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-100">
          {rec.title}
        </h3>
        {canRestore && (
          <Button variant="ghost" icon={RefreshCw} onClick={onRestore} disabled={refining}>
            {t('slideGen.result.restore', { defaultValue: '還原' })}
          </Button>
        )}
        <Tooltip label={t('slideGen.result.refineTip', { defaultValue: '用 AI 重整結構／文案（可還原，唔影響主生成）' })}>
          <Button variant="ghost" icon={Wand2} onClick={onRefine} loading={refining}>
            {t('slideGen.result.refine', { defaultValue: 'AI 再潤飾' })}
          </Button>
        </Tooltip>
        <Button icon={Download} onClick={onDownload} loading={downloading}>
          {t('slideGen.result.download', { defaultValue: '下載 PowerPoint' })}
        </Button>
      </div>
      {rec.subtitle && <p className="text-[12px] text-slate-500 dark:text-slate-400">{rec.subtitle}</p>}
      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        {t('slideGen.result.editHint', { defaultValue: '㩒任何一版可逐版編輯。' })}
      </p>

      <div className="space-y-2">
        {rec.slides.map((s, i) => {
          const layoutBadge = s.layout ? LAYOUT_BADGES[s.layout] : undefined
          return (
            <div
              key={i}
              className="group rounded-xl border border-slate-200/80 bg-white/70 p-3 transition hover:border-accent/30 dark:border-slate-700/60 dark:bg-slate-800/40"
            >
              <div className="flex items-center gap-2">
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-accent-soft text-[11px] font-semibold tabular-nums text-accent-strong dark:bg-accent/15 dark:text-accent">
                  {i + 1}
                </span>
                <p className="min-w-0 flex-1 text-sm font-semibold text-slate-700 dark:text-slate-200">{s.title}</p>
                <span className="flex shrink-0 items-center opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                  <IconButton label={t('slideGen.slide.up', { defaultValue: '上移' })} size="sm" onClick={() => onMove(i, -1)} disabled={i === 0}>
                    <ChevronUp size={14} />
                  </IconButton>
                  <IconButton
                    label={t('slideGen.slide.down', { defaultValue: '下移' })}
                    size="sm"
                    onClick={() => onMove(i, 1)}
                    disabled={i === rec.slides.length - 1}
                  >
                    <ChevronDown size={14} />
                  </IconButton>
                  <IconButton label={t('slideGen.slide.delete', { defaultValue: '刪除呢版' })} size="sm" tone="danger" onClick={() => onDelete(i)}>
                    <Trash2 size={14} />
                  </IconButton>
                </span>
                <IconButton label={t('slideGen.slide.edit', { defaultValue: '編輯呢版' })} size="sm" onClick={() => onEdit(i)}>
                  <Pencil size={14} />
                </IconButton>
                {layoutBadge && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
                    <layoutBadge.icon size={11} /> {layoutBadge.label}
                  </span>
                )}
                {s.chart && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-600 dark:bg-sky-500/15 dark:text-sky-300">
                    <BarChart3 size={11} /> {t('slideGen.slide.chart', { defaultValue: '圖表' })}
                  </span>
                )}
                {s.imageQuery && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                    <ImageIcon size={11} /> {t('slideGen.slide.image', { defaultValue: '配圖' })}
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
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 py-2.5 text-xs font-medium text-slate-400 transition active:scale-[0.98] hover:border-accent/40 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:border-slate-700 dark:text-slate-500"
        >
          <Plus size={14} /> {t('slideGen.slide.add', { defaultValue: '加一版' })}
        </button>
      </div>
    </div>
  )
}
