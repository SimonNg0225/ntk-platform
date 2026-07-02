import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bot,
  Lock,
  Sparkles,
  Brain,
  Plus,
  X,
  Square,
  Wand2,
  History,
  BarChart3,
  Search,
  RefreshCw,
  ArrowLeftRight,
  Copy,
  Check,
  CheckSquare,
  Tag,
  StickyNote,
  Download,
  Repeat,
  Layers,
  Trash2,
  FileText,
  Eye,
  Lightbulb,
  ArrowRight,
  Pencil,
  Zap,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { useNav } from '../../context/NavContext'
import {
  streamChat,
  isAIConfigured,
  type AIModel,
} from '../../lib/aiClient'
import { parseJsonArray } from '../../lib/aiJson'
import { decksCol, cardsCol } from '../../data/collections'
import { richNotesCol } from './notes/store'
import { deriveTitle, snippet } from './notes/util'
import { useCollection, uid } from '../../lib/store'
import { todayStr } from '../../lib/srs'
import { upsertMeta } from './flashcards/store'
import {
  Button,
  Input,
  Textarea,
  Select,
  Field,
  Card,
  Badge,
  SectionTitle,
  EmptyState,
  Tabs,
  IconButton,
  StatCard,
  SegmentedControl,
  Modal,
  Tooltip,
  Kbd,
  Separator,
  Skeleton,
  PageHero,
  FeatureGuide,
  cx,
} from '../../ui'
import {
  CARD_TYPES,
  CARD_TYPE_LABEL,
  DIFFICULTIES,
  LANGS,
  PRESETS,
  buildSystemPrompt,
  buildUserPrompt,
  assembleDraft,
} from './cardgen/prompts'
import { genHistoryCol, markSaved } from './cardgen/store'
import { GenTrend, TypeDonut } from './cardgen/Charts'
import type {
  CardType,
  Difficulty,
  OutLang,
  DraftCard,
  RawCard,
  GenRecord,
} from './cardgen/types'

// ============================================================
//  AI 生成知識卡（Quizlet / Anki 級生成工作室）
//  ------------------------------------------------------------
//  深化重點（媲美真實 app）：
//   ① 多卡型：問答 / 詞彙 / 填空 / 是非（各自 JSON shape + 映射）
//   ② 串流生成（streamChat）+ 即時進度 + 可中止；逐張入草稿
//   ③ 生成參數：數量 / 難度 / 語言 / 模型 / 去重（對目標牌組）
//   ④ 筆記做 context：揀一篇學習筆記做主題種子
//   ⑤ Prompt 範本庫：一 click 填主題 + 卡型
//   ⑥ 草稿工作室：翻面預覽、inline 編輯、單卡 AI 重生、前後互換、
//      複製、批量剔/取消、搜尋過濾、重複偵測（撞目標牌組）
//   ⑦ 批量落卡：新 / 現有牌組 + SRS 初始 + 自動寫 tag（cardMetaCol）
//   ⑧ 生成歷史：持久化每次生成（可重跑 / 統計）
//   ⑨ 統計：總生成 / 已存 / 卡型占比甜甜圈 / 每日趨勢
//   ⑩ 鍵盤：⌘/Ctrl+Enter 生成、Esc 收 Modal
//  共用 decksCol / cardsCol 不變；tag 借 flashcards cardMetaCol；
//  歷史用自家 cardgen_history collection（已申報）。
// ============================================================

const MODELS: { id: AIModel; label: string }[] = [
  { id: 'gemini-2.5-flash', label: 'Flash（快）' },
  { id: 'gemini-2.5-pro', label: 'Pro（強）' },
]

const COUNTS = [5, 8, 10, 15, 20]

type TopTab = 'generate' | 'history' | 'stats'
type DeckTab = 'existing' | 'new'

// 正規化 front 做去重比對（去空白 / 標點 / 大小寫）
export function normFront(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s，。.,?？!！；;：:【】()（）「」"'`_\-—＿]+/g, '')
    .trim()
}

// 重算每張草稿嘅 dup 旗標：撞目標牌組現有 front 或撞前面草稿（normFront 後）即重複。
// 純函式（畀 effect + 測試共用）：seen-set 去重係跨整個 list、有次序性，故喺此一次過算。
// 若冇任何 flag 反轉就原樣回傳同一個 array ref（changed guard），令 setState 短路、唔會多餘 re-render。
export function recomputeDup(
  drafts: DraftCard[],
  targetFronts: Set<string>,
): DraftCard[] {
  if (drafts.length === 0) return drafts
  const seen = new Set<string>()
  let changed = false
  const next = drafts.map((d) => {
    const nf = normFront(d.front)
    const dup = targetFronts.has(nf) || seen.has(nf)
    seen.add(nf)
    if (dup !== d.dup) changed = true
    return dup === d.dup ? d : { ...d, dup }
  })
  return changed ? next : drafts
}

// 一鍵全部前後互換：每張草稿 front ⇄ back 對調（同單卡 swap 一致，只動 front/back）。
// front 同 back 完全一樣嗰張係無實際變化，保留原 object ref（同 recomputeDup 嘅 changed
// guard 同調，慳多餘 re-render）；全部都係 no-op（或空陣列）就原樣回傳同一 array ref。
export function swapAllDrafts(drafts: DraftCard[]): DraftCard[] {
  if (drafts.length === 0) return drafts
  let changed = false
  const next = drafts.map((d) => {
    if (d.front === d.back) return d
    changed = true
    return { ...d, front: d.back, back: d.front }
  })
  return changed ? next : drafts
}

// 去除完全重複草稿：front + back 都完全一樣（各自 trim 後比較）只留最先出現嗰張。
// 補既有「去重」只睇 normFront（撞目標牌組 / 相似）嘅不足 —— 呢度係草稿之間嘅
// 逐字重複。維持原本次序；冇任何重複就原樣回傳同一 array ref（changed guard）。
export function dropExactDuplicates(drafts: DraftCard[]): DraftCard[] {
  if (drafts.length < 2) return drafts
  const seen = new Set<string>()
  const next: DraftCard[] = []
  for (const d of drafts) {
    const key = JSON.stringify([d.front.trim(), d.back.trim()])
    if (seen.has(key)) continue
    seen.add(key)
    next.push(d)
  }
  return next.length === drafts.length ? drafts : next
}

export default function CardGenerator() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const nav = useNav()

  const decks = useCollection(decksCol)
  const allCards = useCollection(cardsCol)
  const notes = useCollection(richNotesCol)
  const history = useCollection(genHistoryCol)

  const [tab, setTab] = useState<TopTab>('generate')

  // ── 生成設定 ──────────────────────────────────────────────
  const [topic, setTopic] = useState('')
  const [count, setCount] = useState(8)
  const [type, setType] = useState<CardType>('qa')
  const [difficulty, setDifficulty] = useState<Difficulty>('intermediate')
  const [lang, setLang] = useState<OutLang>('zh')
  const [model, setModel] = useState<AIModel>('gemini-2.5-flash')
  const [tagInput, setTagInput] = useState('')

  // ── 生成狀態 ──────────────────────────────────────────────
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0) // 已串流入嘅草稿數
  const abortRef = useRef<AbortController | null>(null)

  // ── 草稿 ──────────────────────────────────────────────────
  const [drafts, setDrafts] = useState<DraftCard[]>([])
  const [query, setQuery] = useState('')

  // ── 目標牌組 ──────────────────────────────────────────────
  const [deckTab, setDeckTab] = useState<DeckTab>(
    decks.length > 0 ? 'existing' : 'new',
  )
  const [chosenDeckId, setChosenDeckId] = useState<string>(decks[0]?.id ?? '')
  const [newDeckName, setNewDeckName] = useState('')
  const [saving, setSaving] = useState(false)

  // ── 雜項 ──────────────────────────────────────────────────
  const [notePickOpen, setNotePickOpen] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [lastRecordId, setLastRecordId] = useState<string | null>(null)
  // 純表現層：邊幾張草稿展開咗 inline 編輯（預設淨係顯示卡面，撳鉛筆先改）
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set())
  const toggleEditing = (id: string) =>
    setEditingIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // 目標牌組現有卡嘅 front 正規化集合（去重用）
  const targetFronts = useMemo(() => {
    const id = deckTab === 'existing' ? chosenDeckId : '__none__'
    const set = new Set<string>()
    for (const c of allCards) if (c.deckId === id) set.add(normFront(c.front))
    return set
  }, [allCards, deckTab, chosenDeckId])

  // 草稿 front 簽名：任何 front 改動（inline 編輯 / swap / regenOne）都要重算 dup。
  // 用 normFront 入簽名 → 淨係 dup 相關（正規化後）front 真正變先觸發 effect。
  const draftFrontsSig = useMemo(
    () => drafts.map((d) => d.id + ':' + normFront(d.front)).join('|'),
    [drafts],
  )
  // 草稿變 / 目標牌組變 → 重算重複旗標。
  // recomputeDup 嘅 changed guard 喺冇 flag 反轉時回傳同一 array ref，令 setState 短路、唔會多餘 re-render。
  useEffect(() => {
    setDrafts((ds) => recomputeDup(ds, targetFronts))
  }, [targetFronts, draftFrontsSig])

  const tags = useMemo(
    () =>
      tagInput
        .split(/[,，、;；]/)
        .map((t) => t.trim())
        .filter(Boolean),
    [tagInput],
  )

  const selectedCount = drafts.filter((d) => d.include).length
  const dupCount = drafts.filter((d) => d.include && d.dup).length

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return drafts
    return drafts.filter(
      (d) =>
        d.front.toLowerCase().includes(q) || d.back.toLowerCase().includes(q),
    )
  }, [drafts, query])

  // 最近 40 條歷史（新→舊）：用已 subscribe 嘅 history memo，
  // 避免每次 render 經 recentHistory 重新由 collection 複製 + 排序
  const recent = useMemo(
    () => [...history].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 40),
    [history],
  )

  // ── 守門：未啟用 / 未登入 ──────────────────────────────────
  if (!isAIConfigured) {
    return (
      <EmptyState
        icon={Bot}
        title={t('cardGen.guard.notConfigured.title', {
          defaultValue: 'AI 助手未啟用',
        })}
        hint={t('cardGen.guard.notConfigured.hint', {
          defaultValue:
            '要設定好 Supabase 並部署 gemini Edge Function 先用到。步驟見 docs/SETUP.md。',
        })}
      />
    )
  }
  if (!user) {
    return (
      <EmptyState
        icon={Lock}
        title={t('cardGen.guard.notLoggedIn.title', {
          defaultValue: '請先登入先可以用 AI',
        })}
        hint={t('cardGen.guard.notLoggedIn.hint', {
          defaultValue: '喺左下角用 Google 登入後就用得。',
        })}
      />
    )
  }

  // ── 生成（串流，逐張入草稿）────────────────────────────────
  async function generate() {
    const t = topic.trim()
    if (!t || busy) return
    setBusy(true)
    setProgress(0)
    setDrafts([])
    setQuery('')
    setLastRecordId(null)

    const ctrl = new AbortController()
    abortRef.current = ctrl

    // 去重：對目標牌組現有卡 front
    const avoid =
      deckTab === 'existing' && chosenDeckId
        ? allCards
            .filter((c) => c.deckId === chosenDeckId)
            .map((c) => c.front)
        : []

    try {
      let full = ''
      for await (const chunk of streamChat({
        messages: [{ role: 'user', content: buildUserPrompt(t, count, avoid) }],
        system: buildSystemPrompt(type, difficulty, lang),
        model,
        signal: ctrl.signal,
        source: 'card-gen',
      })) {
        full += chunk
        // 邊串邊試 parse，畀使用者睇住張數慢慢起
        const partial = parseJsonArray<RawCard>(full)
        if (partial) setProgress(partial.length)
      }

      const parsed = parseJsonArray<RawCard>(full)
      if (!parsed) {
        toast.error('AI 回覆格式唔啱，請再試或換 Pro 模型')
        return
      }

      const seen = new Set<string>()
      const valid: DraftCard[] = []
      for (const raw of parsed) {
        if (!raw || typeof raw !== 'object') continue
        const a = assembleDraft(type, raw as RawCard)
        if (!a) continue
        const nf = normFront(a.front)
        const dup = targetFronts.has(nf) || seen.has(nf)
        seen.add(nf)
        valid.push({
          id: uid(),
          type,
          front: a.front,
          back: a.back,
          tags: [...tags],
          include: true,
          flipped: false,
          dup,
        })
      }

      if (valid.length === 0) {
        toast.error('AI 回覆格式唔啱，請再試或換 Pro 模型')
        return
      }

      setDrafts(valid)

      // 寫生成歷史
      const rec = genHistoryCol.add({
        ts: new Date().toISOString(),
        topic: t.slice(0, 120),
        type,
        difficulty,
        lang,
        model,
        generated: valid.length,
        saved: 0,
      })
      setLastRecordId(rec.id)

      toast.success(`生成咗 ${valid.length} 張，下面校對下就可以入牌組`)
    } catch (e) {
      const err = e as Error
      if (err.name === 'AbortError') toast.info('已停止生成')
      else toast.error(err.message || 'AI 出錯')
    } finally {
      setBusy(false)
      setProgress(0)
      abortRef.current = null
    }
  }

  function stop() {
    abortRef.current?.abort()
  }

  // ⌘/Ctrl + Enter 生成
  function onTopicKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      void generate()
    }
  }

  // ── 單卡 AI 重新生成 ──────────────────────────────────────
  async function regenOne(d: DraftCard) {
    if (d.regenning) return
    patchDraft(d.id, { regenning: true })
    try {
      const sys =
        buildSystemPrompt(d.type, difficulty, lang) +
        '\n今次只生成「1」張卡，回一個只有一項嘅 JSON 陣列。'
      const userMsg =
        `主題 / 筆記材料：\n${topic.trim() || d.front}\n\n` +
        `請就以下卡再生成一張更好、唔同角度嘅替代卡（唔好同呢張一樣）：\n` +
        `正面：${d.front}\n背面：${d.back}`
      let full = ''
      for await (const chunk of streamChat({
        messages: [{ role: 'user', content: userMsg }],
        system: sys,
        model,
        source: 'card-gen',
      }))
        full += chunk
      const parsed = parseJsonArray<RawCard>(full)
      const first = parsed && parsed.length > 0 ? parsed[0] : null
      const a = first ? assembleDraft(d.type, first as RawCard) : null
      if (!a) {
        toast.error('重新生成失敗，再試下')
        return
      }
      patchDraft(d.id, { front: a.front, back: a.back, flipped: false })
      toast.success('已換新一張')
    } catch (e) {
      const err = e as Error
      if (err.name !== 'AbortError') toast.error(err.message || '重生失敗')
    } finally {
      patchDraft(d.id, { regenning: false })
    }
  }

  // ── 草稿操作 ──────────────────────────────────────────────
  function patchDraft(id: string, patch: Partial<DraftCard>) {
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)))
  }
  function removeDraft(id: string) {
    setDrafts((ds) => ds.filter((d) => d.id !== id))
  }
  function swap(d: DraftCard) {
    patchDraft(d.id, { front: d.back, back: d.front })
  }
  function swapAll() {
    const next = swapAllDrafts(drafts)
    if (next === drafts) return
    setDrafts(next)
    toast.info('已將全部草稿前後互換')
  }
  async function copyDraft(d: DraftCard) {
    try {
      await navigator.clipboard.writeText(`${d.front}\t${d.back}`)
      setCopiedId(d.id)
      setTimeout(() => setCopiedId((c) => (c === d.id ? null : c)), 1200)
    } catch {
      toast.error('複製唔到')
    }
  }
  function setAllInclude(v: boolean) {
    setDrafts((ds) => ds.map((d) => ({ ...d, include: v })))
  }
  function dropDuplicates() {
    setDrafts((ds) => ds.map((d) => (d.dup ? { ...d, include: false } : d)))
    toast.info('已取消勾選重複卡')
  }
  function dropExact() {
    const next = dropExactDuplicates(drafts)
    const removed = drafts.length - next.length
    if (removed > 0) {
      setDrafts(next)
      toast.info(`已移除 ${removed} 張完全相同嘅草稿`)
    } else {
      toast.info('冇完全相同嘅草稿')
    }
  }
  async function clearDrafts() {
    if (drafts.length === 0) return
    const ok = await confirm({
      title: '清走全部草稿？',
      message: '未存入牌組嘅草稿會冇咗。',
      tone: 'danger',
      confirmText: '清走',
    })
    if (ok) {
      setDrafts([])
      setQuery('')
    }
  }

  // 匯出草稿做 CSV
  function exportDrafts() {
    const rows = drafts.filter((d) => d.include)
    if (rows.length === 0) return
    const esc = (s: string) =>
      /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    const lines = ['正面,背面,標籤']
    for (const d of rows)
      lines.push(
        [esc(d.front), esc(d.back), esc(d.tags.join(';'))].join(','),
      )
    const blob = new Blob(['﻿' + lines.join('\n')], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `知識卡_${todayStr()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`已匯出 ${rows.length} 張（CSV）`)
  }

  // ── 用筆記做 context ──────────────────────────────────────
  function useNoteAsTopic(content: string) {
    setTopic(content.slice(0, 2000))
    setNotePickOpen(false)
    toast.info('已帶入筆記內容做主題')
  }

  // ── 重跑歷史 ──────────────────────────────────────────────
  function rerun(r: GenRecord) {
    setTopic(r.topic)
    setType(r.type)
    setDifficulty(r.difficulty)
    setLang(r.lang)
    setModel(r.model)
    setTab('generate')
    toast.info('已帶返當時設定，可直接再生成')
  }
  async function deleteRecord(id: string) {
    const ok = await confirm({
      title: '刪除呢條歷史？',
      tone: 'danger',
      confirmText: '刪除',
    })
    if (ok) genHistoryCol.remove(id)
  }

  // ── 寫入牌組 ──────────────────────────────────────────────
  function save() {
    const chosen = drafts.filter((d) => d.include)
    if (chosen.length === 0 || saving) return

    let deckId: string
    let deckName: string

    if (deckTab === 'new') {
      const name = newDeckName.trim()
      if (!name) return
      const deck = decksCol.add({ name, createdAt: new Date().toISOString() })
      deckId = deck.id
      deckName = deck.name
    } else {
      if (!chosenDeckId) return
      const deck = decks.find((d) => d.id === chosenDeckId)
      if (!deck) return
      deckId = deck.id
      deckName = deck.name
    }

    setSaving(true)
    try {
      for (const d of chosen) {
        const card = cardsCol.add({
          deckId,
          front: d.front.trim(),
          back: d.back.trim(),
          ease: 2.5,
          intervalDays: 0,
          repetitions: 0,
          dueDate: todayStr(),
          createdAt: new Date().toISOString(),
        })
        // tag → 寫去 flashcards cardMetaCol（重用，唔重複造）
        if (d.tags.length > 0) upsertMeta(card.id, { tags: d.tags })
      }
      // 補回歷史 saved
      if (lastRecordId) markSaved(lastRecordId, chosen.length, deckName)

      toast.success(`已加入 ${chosen.length} 張卡到「${deckName}」`)
      setDrafts([])
      setNewDeckName('')
      setQuery('')
      setLastRecordId(null)
    } finally {
      setSaving(false)
    }
  }

  const canSave =
    selectedCount > 0 &&
    !saving &&
    (deckTab === 'new' ? newDeckName.trim() !== '' : chosenDeckId !== '')

  // 揀筆記 Modal：只列未刪嘅個人筆記，最近編輯排前
  const pickableNotes = useMemo(
    () =>
      notes
        .filter((n) => !n.trashed)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [notes],
  )

  // ── 統計數字 ──────────────────────────────────────────────
  const totalGen = history.reduce((s, r) => s + r.generated, 0)
  const totalSaved = history.reduce((s, r) => s + r.saved, 0)
  const saveRate = totalGen > 0 ? Math.round((totalSaved / totalGen) * 100) : 0

  const activeType = CARD_TYPES.find((c) => c.id === type)

  const TAB_RAIL: { id: TopTab; label: string; icon: typeof Wand2 }[] = [
    { id: 'generate', label: '生成', icon: Wand2 },
    { id: 'history', label: '歷史', icon: History },
    { id: 'stats', label: '統計', icon: BarChart3 },
  ]

  return (
    <div className="space-y-6">
      {/* ── 頂部 accent hero（共用 PageHero）：icon chip + 標題 + 副題；右上放已生成總量；底部放視圖分頁 ── */}
      <PageHero
        guideKey="cardGen"
        icon={Sparkles}
        kicker={t('cardGen.kicker', { defaultValue: 'Card Studio' })}
        title={t('cardGen.title', { defaultValue: 'AI 生成知識卡' })}
        description={t('cardGen.subtitle', {
          defaultValue: '落個主題，AI 即刻幫你出一疊溫習卡，校對啱就一鍵入牌組。',
        })}
        actions={
          totalGen > 0 ? (
            <div className="flex items-center gap-2.5 rounded-2xl bg-white/15 px-4 py-2 ring-1 ring-inset ring-white/20 backdrop-blur-sm">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 text-white">
                <Layers size={18} />
              </span>
              <div className="leading-tight">
                <p className="text-lg font-semibold tabular-nums slashed-zero text-white">
                  {totalGen.toLocaleString()}
                </p>
                <p className="text-[11px] text-white/70">
                  {t('cardGen.totalGenerated', { defaultValue: '張已生成' })}
                </p>
              </div>
            </div>
          ) : undefined
        }
        tabs={TAB_RAIL.map((tabItem) => {
          const on = tab === tabItem.id
          const I = tabItem.icon
          return (
            <button
              key={tabItem.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(tabItem.id)}
              className={cx(
                'inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
                on
                  ? 'bg-white font-semibold text-accent-strong'
                  : 'bg-white/15 text-white hover:bg-white/25',
              )}
            >
              <I size={14} />
              {tabItem.label}
            </button>
          )
        })}
      />

      {/* ── 教學引導：教用家「點用」呢個功能（可摺疊 + 可永久收起）── */}
      <FeatureGuide
        storageKey="cardGen"
        title={t('cardGen.guide.title', { defaultValue: '生成知識卡點用？' })}
        steps={[
          {
            title: t('cardGen.guide.s1.title', { defaultValue: '揀卡型、落材料' }),
            desc: t('cardGen.guide.s1.desc', {
              defaultValue: '揀問答／詞彙等卡型，貼上主題或筆記內容（越具體越好）。',
            }),
          },
          {
            title: t('cardGen.guide.s2.title', { defaultValue: '生成同校對' }),
            desc: t('cardGen.guide.s2.desc', {
              defaultValue: '撳「生成」，AI 出卡後逐張翻面對答案，改錯字、剔走唔啱嘅。',
            }),
          },
          {
            title: t('cardGen.guide.s3.title', { defaultValue: '入牌組溫習' }),
            desc: t('cardGen.guide.s3.desc', {
              defaultValue: '揀現有牌組或起新牌組，一鍵加入，就可以開始複習。',
            }),
          },
        ]}
      />

      {/* ══════════════ 生成 ══════════════ */}
      {tab === 'generate' && (
        <>
          {/* ① 生成設定 */}
          <Card className="space-y-5 p-5">
            <SectionTitle
              icon={Sparkles}
              description={t('cardGen.setup.desc', {
                defaultValue: '揀卡型、落材料，調好數量同難度',
              })}
              right={
                <Tooltip
                  label={t('cardGen.useNote.tip', {
                    defaultValue: '由個人筆記帶入內容',
                  })}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={StickyNote}
                    onClick={() => setNotePickOpen(true)}
                    disabled={busy}
                  >
                    {t('cardGen.useNote', { defaultValue: '用筆記' })}
                  </Button>
                </Tooltip>
              }
            >
              {t('cardGen.setup.title', { defaultValue: '生成設定' })}
            </SectionTitle>

            {/* 卡型 segmented（大圖示） */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CARD_TYPES.map((ct) => {
                const on = type === ct.id
                return (
                  <button
                    key={ct.id}
                    type="button"
                    onClick={() => setType(ct.id)}
                    disabled={busy}
                    aria-pressed={on}
                    className={cx(
                      'flex min-h-[118px] flex-col items-start gap-1.5 rounded-2xl border p-3 text-left transition duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50',
                      on
                        ? 'border-accent/40 bg-accent-soft/50 dark:border-accent/40 dark:bg-accent/10'
                        : 'border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-md dark:border-slate-700/60 dark:bg-slate-800 dark:hover:border-slate-600',
                    )}
                  >
                    <span
                      className={cx(
                        'flex h-11 w-11 items-center justify-center rounded-xl transition',
                        on
                          ? 'bg-accent text-white'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300',
                      )}
                    >
                      <ct.icon size={18} />
                    </span>
                    <span
                      className={cx(
                        'text-sm font-semibold',
                        on
                          ? 'text-accent-strong dark:text-accent'
                          : 'text-slate-700 dark:text-slate-200',
                      )}
                    >
                      {ct.label}
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                      {ct.desc}
                    </span>
                  </button>
                )
              })}
            </div>

            <Field
              label={t('cardGen.topic.label', { defaultValue: '主題 / 筆記內容' })}
              hint={t('cardGen.topic.hint', {
                defaultValue:
                  '貼上你想做成知識卡嘅內容，越具體越好。⌘/Ctrl + Enter 即生成。',
              })}
            >
              <Textarea
                rows={5}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={onTopicKey}
                disabled={busy}
                placeholder={
                  activeType
                    ? t('cardGen.topic.phType', {
                        defaultValue: '例如：市場營銷 4P（{{type}}卡）…',
                        type: activeType.label,
                      })
                    : t('cardGen.topic.ph', {
                        defaultValue: '例如：市場營銷 4P：產品、價格、地點、推廣…',
                      })
                }
              />
            </Field>

            {/* 範例主題：一撳即填，降低開始門檻 */}
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                <Lightbulb size={13} className="text-amber-500" />
                {t('cardGen.presets.heading', {
                  defaultValue: '諗唔到主題？撳個範例即填',
                })}
              </p>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setTopic(p.topic)
                      setType(p.type)
                    }}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-slate-200/80 bg-white px-3 text-xs text-slate-600 transition duration-200 active:scale-[0.98] hover:border-accent/40 hover:bg-accent-soft/40 hover:text-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700/60 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-accent/40 dark:hover:bg-accent/10 dark:hover:text-accent"
                  >
                    <span>{p.emoji}</span>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 參數行 */}
            <div className="flex flex-wrap gap-3">
              <Field label={t('cardGen.count', { defaultValue: '數量' })}>
                <Select
                  className="w-auto"
                  value={String(count)}
                  onChange={(e) => setCount(Number(e.target.value))}
                  disabled={busy}
                >
                  {COUNTS.map((n) => (
                    <option key={n} value={n}>
                      {n} 張
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('cardGen.model', { defaultValue: '模型' })}>
                <Select
                  className="w-auto"
                  value={model}
                  onChange={(e) => setModel(e.target.value as AIModel)}
                  disabled={busy}
                >
                  {MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('cardGen.lang', { defaultValue: '語言' })}>
                <Select
                  className="w-auto"
                  value={lang}
                  onChange={(e) => setLang(e.target.value as OutLang)}
                  disabled={busy}
                >
                  {LANGS.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {/* 難度 */}
            <Field label={t('cardGen.difficulty', { defaultValue: '難度' })}>
              <div className="space-y-1.5">
                <SegmentedControl<Difficulty>
                  options={DIFFICULTIES.map((d) => ({ id: d.id, label: d.label }))}
                  value={difficulty}
                  onChange={setDifficulty}
                />
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  {DIFFICULTIES.find((d) => d.id === difficulty)?.hint}
                </p>
              </div>
            </Field>

            {/* 標籤 */}
            <Field
              label={t('cardGen.tags.label', {
                defaultValue: '標籤（可選，落卡時一齊寫入）',
              })}
              hint={t('cardGen.tags.hint', {
                defaultValue: '以逗號分隔，例如：BAFS, 市場營銷',
              })}
            >
              <Input
                icon={Tag}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                disabled={busy}
                placeholder="BAFS, 4P"
              />
            </Field>

            {/* ── 主行動：生成 / 生成中可停止 ── */}
            <div className="border-t border-slate-200/70 pt-4 dark:border-slate-700/60">
              {busy ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Button
                    variant="danger"
                    icon={Square}
                    onClick={stop}
                    className="shrink-0"
                  >
                    {t('cardGen.stop', { defaultValue: '停止生成' })}
                  </Button>
                  {/* 進度帶：流動掃光 + 已出張數 */}
                  <div
                    aria-live="polite"
                    className="flex flex-1 items-center gap-2.5 rounded-xl bg-accent-soft/60 px-3 py-2 dark:bg-accent/10"
                  >
                    <Sparkles size={15} className="shrink-0 animate-pulse text-accent" />
                    <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-accent/15">
                      <span className="absolute inset-y-0 -left-1/3 w-1/3 animate-[shimmer_1.2s_infinite] rounded-full bg-accent/70" />
                    </div>
                    <span className="shrink-0 text-xs font-medium text-accent-strong dark:text-accent">
                      {progress > 0 ? (
                        <span className="tabular-nums slashed-zero">
                          {t('cardGen.progress', {
                            defaultValue: '已出 {{n}} 張',
                            n: progress,
                          })}
                        </span>
                      ) : (
                        t('cardGen.starting', { defaultValue: '生成中…' })
                      )}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    onClick={() => void generate()}
                    disabled={!topic.trim()}
                    icon={Zap}
                    size="lg"
                    fullWidth
                    className="sm:w-auto sm:min-w-[14rem]"
                  >
                    {t('cardGen.generate', { defaultValue: '生成知識卡' })}
                  </Button>
                  <span className="hidden items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 sm:flex">
                    {t('cardGen.orPress', { defaultValue: '或撳' })}
                    <Kbd>⌘</Kbd>
                    <Kbd>↵</Kbd>
                    {t('cardGen.toGenerate', { defaultValue: '即刻生成' })}
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* 串流進行緊嘅 skeleton（未有草稿時）— 卡喺爐入面逐張成形 */}
          {busy && drafts.length === 0 && (
            <Card className="space-y-4 p-5">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                  <Sparkles size={18} className="animate-pulse" />
                </span>
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {t('cardGen.streaming.title', {
                      defaultValue: '生成中，卡片逐張出緊…',
                    })}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {progress > 0 ? (
                      <span className="tabular-nums slashed-zero">
                        {t('cardGen.streaming.count', {
                          defaultValue: '已出 {{n}} 張，仲有得嚟',
                          n: progress,
                        })}
                      </span>
                    ) : (
                      t('cardGen.streaming.first', { defaultValue: 'AI 落緊第一筆' })
                    )}
                  </p>
                </div>
              </div>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {Array.from({ length: Math.min(count, 4) }).map((_, i) => (
                  <li
                    key={i}
                    style={{ animationDelay: `${i * 110}ms` }}
                    className="animate-fade-in-up space-y-2.5 rounded-2xl border border-dashed border-accent/30 bg-accent-soft/20 p-4 dark:border-accent/25 dark:bg-accent/[0.06]"
                  >
                    <Skeleton className="h-4 w-16 rounded-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-9 w-full" />
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* 未生成又冇草稿：引導式空狀態（icon + 標題 + 提示 + CTA 直接落第一步）*/}
          {!busy && drafts.length === 0 && (
            <EmptyState
              icon={Sparkles}
              title={t('cardGen.empty.title', {
                defaultValue: '落個主題，開始生成知識卡',
              })}
              hint={t('cardGen.empty.hint', {
                defaultValue:
                  '喺上面貼上主題或筆記、撳「生成知識卡」，AI 就會出一疊卡畀你校對。唔知點起步？撳下面用個範例。',
              })}
              action={
                PRESETS.length > 0 ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={Lightbulb}
                    onClick={() => {
                      setTopic(PRESETS[0].topic)
                      setType(PRESETS[0].type)
                    }}
                  >
                    {t('cardGen.empty.cta', {
                      defaultValue: '用範例「{{name}}」起步',
                      name: PRESETS[0].label,
                    })}
                  </Button>
                ) : undefined
              }
            />
          )}

          {/* ② 預覽 / 編輯 */}
          {drafts.length > 0 && (
            <Card className="space-y-4 p-5">
              <SectionTitle
                icon={Eye}
                description={t('cardGen.review.desc', {
                  defaultValue: '翻面對下答案、改返啱，唔啱嘅就剔走',
                })}
                right={
                  <div className="flex items-center gap-1.5">
                    {dupCount > 0 && (
                      <Badge tone="amber" dot>
                        <span className="nums">{dupCount}</span> 張重複
                      </Badge>
                    )}
                    <Badge tone="accent">
                      已揀{' '}
                      <span className="nums">
                        {selectedCount} / {drafts.length}
                      </span>{' '}
                      張
                    </Badge>
                  </div>
                }
              >
                {t('cardGen.review.title', { defaultValue: '校對草稿' })}
              </SectionTitle>

              {/* 工具列 */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[10rem] flex-1">
                  <Input
                    icon={Search}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('cardGen.searchDrafts', {
                      defaultValue: '搜尋草稿…',
                    })}
                  />
                </div>
                <Tooltip label={t('cardGen.tools.selectAll', { defaultValue: '全部剔選' })}>
                  <IconButton
                    label={t('cardGen.tools.selectAll', { defaultValue: '全部剔選' })}
                    onClick={() => setAllInclude(true)}
                  >
                    <CheckSquare size={18} />
                  </IconButton>
                </Tooltip>
                <Tooltip label={t('cardGen.tools.deselectAll', { defaultValue: '全部取消' })}>
                  <IconButton
                    label={t('cardGen.tools.deselectAll', { defaultValue: '全部取消' })}
                    onClick={() => setAllInclude(false)}
                  >
                    <Square size={18} />
                  </IconButton>
                </Tooltip>
                <Tooltip
                  label={t('cardGen.tools.swapAll', {
                    defaultValue: '全部草稿前後互換',
                  })}
                >
                  <IconButton
                    label={t('cardGen.tools.swapAll', {
                      defaultValue: '全部草稿前後互換',
                    })}
                    onClick={swapAll}
                  >
                    <ArrowLeftRight size={18} />
                  </IconButton>
                </Tooltip>
                <Tooltip
                  label={t('cardGen.tools.dropExact', {
                    defaultValue: '去除完全相同嘅草稿（正面＋背面一樣只留一張）',
                  })}
                >
                  <IconButton
                    label={t('cardGen.tools.dropExactShort', {
                      defaultValue: '去除完全相同',
                    })}
                    onClick={dropExact}
                  >
                    <Layers size={18} />
                  </IconButton>
                </Tooltip>
                {dupCount > 0 && (
                  <Button variant="secondary" size="sm" onClick={dropDuplicates}>
                    {t('cardGen.tools.dedup', { defaultValue: '去重' })}
                  </Button>
                )}
                <Tooltip
                  label={t('cardGen.tools.exportCsv', {
                    defaultValue: '匯出剔選嘅做 CSV',
                  })}
                >
                  <IconButton
                    label={t('cardGen.tools.exportCsvShort', {
                      defaultValue: '匯出 CSV',
                    })}
                    onClick={exportDrafts}
                    disabled={selectedCount === 0}
                  >
                    <Download size={18} />
                  </IconButton>
                </Tooltip>
                <Tooltip
                  label={t('cardGen.tools.clear', { defaultValue: '清走全部草稿' })}
                >
                  <IconButton
                    label={t('cardGen.tools.clearShort', { defaultValue: '清走' })}
                    tone="danger"
                    onClick={() => void clearDrafts()}
                  >
                    <Trash2 size={18} />
                  </IconButton>
                </Tooltip>
              </div>

              {filtered.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title={t('cardGen.noResults.title', {
                    defaultValue: '搵唔到「{{q}}」',
                    q: query,
                  })}
                  hint={t('cardGen.noResults.hint', {
                    defaultValue: '試下換個關鍵字，或者清空搜尋框睇返全部草稿。',
                  })}
                  action={
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={X}
                      onClick={() => setQuery('')}
                    >
                      {t('cardGen.noResults.cta', { defaultValue: '清空搜尋' })}
                    </Button>
                  }
                />
              ) : (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {filtered.map((d, i) => {
                    const editing = editingIds.has(d.id)
                    return (
                      <li
                        key={d.id}
                        // 逐張現身：staggered 入場（封頂避免大批時拖太長；reduced-motion 由全域 CSS 收起）
                        style={{ animationDelay: `${Math.min(i, 11) * 45}ms` }}
                        className={cx(
                          'group flex animate-fade-in-up flex-col rounded-2xl border p-4 transition duration-200',
                          !d.include
                            ? 'border-slate-200/80 bg-slate-50/60 opacity-70 dark:border-slate-700/60 dark:bg-slate-800/40'
                            : d.dup
                              ? 'border-amber-300/70 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/5'
                              : 'border-accent/30 bg-accent-soft/30 hover:shadow-md dark:border-accent/30 dark:bg-accent/[0.07]',
                        )}
                      >
                        {/* 頂行：剔選 + 卡型 + 重複旗標 */}
                        <div className="flex items-center gap-2">
                          <label className="inline-flex cursor-pointer items-center">
                            <input
                              type="checkbox"
                              checked={d.include}
                              onChange={(e) =>
                                patchDraft(d.id, { include: e.target.checked })
                              }
                              aria-label={t('cardGen.card.includeAria', {
                                defaultValue: '是否加入呢張',
                              })}
                              className="h-4 w-4 shrink-0 cursor-pointer rounded accent-accent"
                            />
                          </label>
                          <Badge tone="slate">{CARD_TYPE_LABEL[d.type]}</Badge>
                          {d.dup && (
                            <Badge tone="amber" dot>
                              {t('cardGen.card.similar', { defaultValue: '相似卡' })}
                            </Badge>
                          )}
                          <Tooltip
                            label={
                              editing
                                ? t('cardGen.card.editDone', { defaultValue: '完成編輯' })
                                : t('cardGen.card.edit', { defaultValue: '編輯內容' })
                            }
                          >
                            <IconButton
                              label={t('cardGen.card.edit', { defaultValue: '編輯內容' })}
                              active={editing}
                              className="ml-auto"
                              disabled={d.regenning}
                              onClick={() => toggleEditing(d.id)}
                            >
                              <Pencil size={15} />
                            </IconButton>
                          </Tooltip>
                        </div>

                        {/* 卡身 */}
                        {d.regenning ? (
                          <div className="mt-3 space-y-2.5">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-9 w-full" />
                          </div>
                        ) : editing ? (
                          // 編輯態：露出輸入框
                          <div className="mt-3 space-y-2">
                            <Field
                              label={t('cardGen.card.frontLabel', {
                                defaultValue: '正面（題目）',
                              })}
                            >
                              <Input
                                value={d.front}
                                onChange={(e) =>
                                  patchDraft(d.id, { front: e.target.value })
                                }
                                placeholder={t('cardGen.card.front', {
                                  defaultValue: '正面',
                                })}
                              />
                            </Field>
                            <Field
                              label={t('cardGen.card.backLabel', {
                                defaultValue: '背面（答案）',
                              })}
                            >
                              <Textarea
                                rows={2}
                                value={d.back}
                                onChange={(e) =>
                                  patchDraft(d.id, { back: e.target.value })
                                }
                                placeholder={t('cardGen.card.back', {
                                  defaultValue: '背面',
                                })}
                              />
                            </Field>
                          </div>
                        ) : (
                          // 預覽態：似真卡，正面突出 + 答案柔和區
                          <div className="mt-3 flex flex-1 flex-col gap-2.5">
                            <div className="rounded-xl bg-white/70 p-3 dark:bg-slate-900/40">
                              <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                                {t('cardGen.card.front', { defaultValue: '正面' })}
                              </p>
                              <p className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold text-slate-800 dark:text-slate-100">
                                {d.front}
                              </p>
                            </div>
                            {d.flipped ? (
                              <div className="rounded-xl border border-dashed border-accent/40 bg-white p-3 dark:bg-slate-900">
                                <p className="text-[11px] font-medium text-accent">
                                  {t('cardGen.card.back', { defaultValue: '背面' })}
                                </p>
                                <p className="mt-1 whitespace-pre-wrap break-words text-sm font-medium text-slate-700 dark:text-slate-200">
                                  {d.back}
                                </p>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => patchDraft(d.id, { flipped: true })}
                                className="flex min-h-11 items-center gap-1.5 rounded-xl border border-dashed border-slate-300/70 px-3 text-left text-xs text-slate-400 transition active:scale-[0.98] hover:border-accent/40 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:border-slate-600/70 dark:text-slate-500 dark:hover:text-accent"
                              >
                                <Eye size={13} className="shrink-0" />
                                {t('cardGen.card.reveal', {
                                  defaultValue: '撳一下睇答案',
                                })}
                              </button>
                            )}
                          </div>
                        )}

                        {/* 卡片動作 */}
                        <div className="mt-3 flex flex-wrap items-center gap-0.5 border-t border-slate-200/60 pt-2 dark:border-slate-700/50">
                          <Tooltip
                            label={
                              d.flipped
                                ? t('cardGen.card.hideAnswer', { defaultValue: '收返答案' })
                                : t('cardGen.card.flip', { defaultValue: '翻面睇答案' })
                            }
                          >
                            <IconButton
                              label={t('cardGen.card.flipShort', { defaultValue: '翻面' })}
                              active={d.flipped}
                              onClick={() =>
                                patchDraft(d.id, { flipped: !d.flipped })
                              }
                            >
                              <Repeat size={16} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip label={t('cardGen.card.swap', { defaultValue: '前後互換' })}>
                            <IconButton
                              label={t('cardGen.card.swapShort', { defaultValue: '互換' })}
                              onClick={() => swap(d)}
                            >
                              <ArrowLeftRight size={16} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip
                            label={t('cardGen.card.regen', {
                              defaultValue: 'AI 重新生成呢張',
                            })}
                          >
                            <IconButton
                              label={t('cardGen.card.regenShort', { defaultValue: '重生' })}
                              disabled={d.regenning}
                              onClick={() => void regenOne(d)}
                            >
                              <RefreshCw
                                size={16}
                                className={d.regenning ? 'animate-spin' : ''}
                              />
                            </IconButton>
                          </Tooltip>
                          <Tooltip
                            label={t('cardGen.card.copy', {
                              defaultValue: '複製（正面⇥背面）',
                            })}
                          >
                            <IconButton
                              label={t('cardGen.card.copyShort', { defaultValue: '複製' })}
                              onClick={() => void copyDraft(d)}
                            >
                              {copiedId === d.id ? (
                                <Check size={16} className="text-emerald-500" />
                              ) : (
                                <Copy size={16} />
                              )}
                            </IconButton>
                          </Tooltip>
                          <Tooltip label={t('cardGen.card.remove', { defaultValue: '移除呢張' })}>
                            <IconButton
                              label={t('cardGen.card.removeShort', { defaultValue: '移除' })}
                              tone="danger"
                              className="ml-auto"
                              onClick={() => removeDraft(d.id)}
                            >
                              <X size={16} />
                            </IconButton>
                          </Tooltip>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}

              <Separator />

              {/* ③ 目標牌組 + 寫入 */}
              <SectionTitle
                icon={Layers}
                description={t('cardGen.save.desc', {
                  defaultValue: '揀個牌組，或者起一個新嘅嚟收呢批卡',
                })}
              >
                {t('cardGen.save.title', { defaultValue: '加入牌組' })}
              </SectionTitle>

              <Tabs<DeckTab>
                tabs={[
                  {
                    id: 'existing',
                    label: t('cardGen.deck.existing', { defaultValue: '現有牌組' }),
                  },
                  {
                    id: 'new',
                    label: t('cardGen.deck.new', { defaultValue: '新牌組' }),
                  },
                ]}
                active={deckTab}
                onChange={setDeckTab}
              />

              {deckTab === 'existing' ? (
                decks.length > 0 ? (
                  <Select
                    value={chosenDeckId}
                    onChange={(e) => setChosenDeckId(e.target.value)}
                    aria-label={t('cardGen.deck.pick', { defaultValue: '揀現有牌組' })}
                  >
                    <option value="">
                      {t('cardGen.deck.pickPlaceholder', {
                        defaultValue: '（揀一個牌組）',
                      })}
                    </option>
                    {decks.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}（
                        {allCards.filter((c) => c.deckId === d.id).length} 張）
                      </option>
                    ))}
                  </Select>
                ) : (
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {t('cardGen.deck.noneHint', {
                      defaultValue: '仲未有牌組，切去「新牌組」起一個。',
                    })}
                  </p>
                )
              ) : (
                <Input
                  value={newDeckName}
                  onChange={(e) => setNewDeckName(e.target.value)}
                  placeholder={t('cardGen.deck.newPlaceholder', {
                    defaultValue: '新牌組名稱（例如 市場營銷）',
                  })}
                />
              )}

              {dupCount > 0 && (
                <p className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                  <span className="font-medium tabular-nums">{dupCount}</span>{' '}
                  {t('cardGen.save.dupWarn', {
                    defaultValue: '張勾選緊嘅卡同目標牌組已有卡相似，可按「去重」一鍵取消。',
                  })}
                </p>
              )}

              <div className="rounded-2xl border border-accent/20 bg-accent-soft/40 p-3 dark:border-accent/25 dark:bg-accent/10">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button variant="ghost" onClick={() => void clearDrafts()}>
                    {t('cardGen.save.clear', { defaultValue: '清空重嚟' })}
                  </Button>
                  <Button onClick={save} loading={saving} disabled={!canSave} icon={Plus}>
                    {t('cardGen.save.cta', { defaultValue: '加入牌組' })}（
                    <span className="nums">{selectedCount}</span> 張）
                  </Button>
                </div>
                <button
                  type="button"
                  onClick={() => nav.open('learning-flashcards')}
                  className="mt-2 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg text-xs font-medium text-accent transition active:scale-[0.98] hover:text-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  <Brain size={14} className="shrink-0" />
                  {t('cardGen.save.goReview', {
                    defaultValue: '加入後去「知識卡 + 複習」即刻溫',
                  })}
                  <ArrowRight size={13} className="shrink-0" />
                </button>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ══════════════ 歷史 ══════════════ */}
      {tab === 'history' && (
        <Card className="space-y-3 p-5">
          <SectionTitle
            icon={History}
            description={t('cardGen.history.desc', {
              defaultValue: '每次生成都記低設定，撳重跑即可再嚟一次',
            })}
          >
            {t('cardGen.history.title', { defaultValue: '生成歷史' })}
          </SectionTitle>
          {history.length === 0 ? (
            <EmptyState
              icon={History}
              title={t('cardGen.history.empty.title', {
                defaultValue: '仲未有生成紀錄',
              })}
              hint={t('cardGen.history.empty.hint', {
                defaultValue:
                  '去「生成」整第一批知識卡，呢度會記低每次嘅設定，方便重跑。',
              })}
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  icon={Wand2}
                  onClick={() => setTab('generate')}
                >
                  {t('cardGen.history.empty.cta', { defaultValue: '去生成知識卡' })}
                </Button>
              }
            />
          ) : (
            <ul className="space-y-2">
              {recent.map((r) => (
                <li
                  key={r.id}
                  className="flex items-start gap-3 rounded-2xl border border-slate-200/80 p-3.5 transition duration-200 hover:border-slate-300 hover:shadow-md dark:border-slate-700/60 dark:hover:border-slate-600"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                      {r.topic}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge tone="slate">{CARD_TYPE_LABEL[r.type]}</Badge>
                      <Badge tone="slate">
                        {DIFFICULTIES.find((d) => d.id === r.difficulty)?.label}
                      </Badge>
                      <Badge tone="accent">
                        {t('cardGen.history.generated', { defaultValue: '生成' })}{' '}
                        <span className="nums">{r.generated}</span>
                      </Badge>
                      {r.saved > 0 ? (
                        <Badge tone="green" dot>
                          {t('cardGen.history.saved', { defaultValue: '已存' })}{' '}
                          <span className="nums">{r.saved}</span>
                          {r.deckName ? ` → ${r.deckName}` : ''}
                        </Badge>
                      ) : (
                        <Badge tone="amber">
                          {t('cardGen.history.unsaved', { defaultValue: '未存' })}
                        </Badge>
                      )}
                      <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                        {new Date(r.ts).toLocaleString('zh-HK', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Tooltip
                      label={t('cardGen.history.rerunTip', {
                        defaultValue: '帶返設定再生成',
                      })}
                    >
                      <IconButton
                        label={t('cardGen.history.rerun', { defaultValue: '重跑' })}
                        onClick={() => rerun(r)}
                      >
                        <RefreshCw size={16} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip
                      label={t('cardGen.history.deleteTip', {
                        defaultValue: '刪除紀錄',
                      })}
                    >
                      <IconButton
                        label={t('cardGen.history.delete', { defaultValue: '刪除' })}
                        tone="danger"
                        onClick={() => void deleteRecord(r.id)}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </Tooltip>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* ══════════════ 統計 ══════════════ */}
      {tab === 'stats' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label={t('cardGen.stats.total', { defaultValue: '總生成' })}
              value={totalGen}
              unit="張"
              icon={Sparkles}
            />
            <StatCard
              label={t('cardGen.stats.saved', { defaultValue: '已存入牌組' })}
              value={totalSaved}
              unit="張"
              icon={Layers}
              highlight
            />
            <StatCard
              label={t('cardGen.stats.rate', { defaultValue: '採用率' })}
              value={saveRate}
              unit="%"
              icon={Check}
              hint={t('cardGen.stats.rateHint', { defaultValue: '存入 / 生成' })}
            />
            <StatCard
              label={t('cardGen.stats.runs', { defaultValue: '生成次數' })}
              value={history.length}
              unit="次"
              icon={History}
            />
          </div>

          <Card className="p-5">
            <SectionTitle icon={BarChart3}>
              {t('cardGen.stats.trend', { defaultValue: '每日生成量（近 14 日）' })}
            </SectionTitle>
            <GenTrend records={history} />
          </Card>

          <Card className="p-5">
            <SectionTitle icon={FileText}>
              {t('cardGen.stats.donut', { defaultValue: '卡型占比' })}
            </SectionTitle>
            <TypeDonut records={history} />
          </Card>
        </div>
      )}

      {/* ── 揀筆記 Modal ── */}
      <Modal
        open={notePickOpen}
        onClose={() => setNotePickOpen(false)}
        title={t('cardGen.notePick.title', { defaultValue: '揀一篇筆記做主題' })}
        size="lg"
      >
        {pickableNotes.length === 0 ? (
          <EmptyState
            icon={StickyNote}
            title={t('cardGen.notePick.empty.title', {
              defaultValue: '仲未有個人筆記',
            })}
            hint={t('cardGen.notePick.empty.hint', {
              defaultValue: '去「個人筆記」記低重點，呢度就可以一鍵帶入做生成材料。',
            })}
            action={
              <Button
                size="sm"
                variant="secondary"
                icon={StickyNote}
                onClick={() => {
                  setNotePickOpen(false)
                  nav.open('learning-notes')
                }}
              >
                {t('cardGen.notePick.empty.cta', { defaultValue: '去個人筆記' })}
              </Button>
            }
          />
        ) : (
          <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
            {pickableNotes.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => useNoteAsTopic(n.content)}
                  className="w-full rounded-xl border border-slate-200/80 p-3 text-left transition active:scale-[0.98] hover:border-accent/40 hover:bg-accent-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:border-slate-700/60 dark:hover:border-accent/40 dark:hover:bg-accent/10"
                >
                  <p className="line-clamp-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {deriveTitle(n)}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                    {snippet(n.content) ||
                      t('cardGen.notePick.blank', { defaultValue: '（空白筆記）' })}
                  </p>
                  <p className="mt-1 text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                    {new Date(n.createdAt).toLocaleDateString('zh-HK')}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  )
}
