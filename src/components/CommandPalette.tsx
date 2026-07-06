import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, Home, Search, Sparkles, type LucideIcon } from 'lucide-react'
import { FEATURES } from '../features/registry'
import { isFeatureAvailable } from '../lib/featureFlags'
import { FeatureIcon } from '../features/featureIcons'
import { useMode } from '../context/ModeContext'
import { useCollection } from '../lib/store'
import { MODES, MODE_ORDER } from '../modes/modes'
import { Kbd, cx } from '../ui'
import { featName, groupLabel } from '../i18n/appEn'
import {
  recentFeaturesCol,
  pushRecentFeature,
  resolveRecentItems,
} from './commandPalette/util'

// ============================================================
//  指令面板 (Command Palette) — 按 ⌘K / Ctrl+K 開啟
//  快速跳去任何功能、切換模式。商用級導航體驗。
// ============================================================

interface Props {
  open: boolean
  onClose: () => void
  onNavigate: (featureId: string | null) => void
  /** 開「快速記低」modal（自然語言 → 待辦／提醒／行事曆）；唔記入最近 */
  onQuickAdd?: () => void
}

// 一個可跳轉項目（功能 / 首頁 / 模式切換）。id 對齊 resolveRecentItems 嘅 featureId。
interface Item {
  id: string
  label: string
  icon: string | LucideIcon
  hint: string
  aliases?: string[]
  hiddenFromDefaults?: boolean
  recordable: boolean // 跳去「目的地」（首頁 / 功能）先記入最近；模式切換 false
  action: () => void
}

const FEATURE_SEARCH_ALIASES: Record<string, string[]> = {
  'work-ai': ['AI 助手', 'chat', '問 AI', '家長信', '電郵', 'email', '評語', '課堂活動'],
  'work-lesson-plan': ['備課', '教案', 'lesson plan', '下一堂', '教學目標', '教學流程'],
  'work-generate': ['出題', '小測', 'quiz', 'worksheet', '練習', '試卷', '題目', 'MC'],
  'work-teach-guide': ['點教', '教法', '教學指引', '學生誤解', '活動設計'],
  'work-slides': ['PPT', 'PowerPoint', 'slides', '簡報', '教學簡報'],
  'work-rubric': ['rubric', '評分', '評分點', '評分準則', '參考答案', 'marking'],
  'work-dse': ['DSE', '公開試', '操練', 'past paper', '考試題'],
  'work-topic-import': ['syllabus', '課程指引', '課題', '匯入課題'],
  'work-resources': ['資源', '教材', '講義', '連結', '收藏'],
  'work-community': ['分享', '下載', '老師資源', 'community'],
  'work-tasks': ['待辦', 'todo', '批改', '跟進', '行政事項'],
  'work-meeting-notes': ['會議', 'meeting', 'minutes', '會議記錄'],
  'work-admin-docs': ['行政文件', 'docx', '範本', '通告', '表格'],
  'work-scan': ['掃描', 'scan', '相片', 'PDF'],
  'work-doc-digest': ['文件摘要', '速讀', 'PDF', '行政文件', '重點'],
  'work-transcribe': ['錄音', '逐字稿', 'transcribe', 'meeting audio'],
  'work-observation': ['觀課', '評課', 'lesson observation'],
  'work-report': ['週報', '工作報告', '回顧', 'report'],
  'learning-ai': ['AI 助手', 'chat', '問 AI', '解釋', '總結'],
  'learning-card-generator': ['flashcard', '知識卡', '溫習卡', '生成卡'],
  'learning-notes': ['筆記', 'notes', '記低', '整理'],
  'learning-flashcards': ['flashcard', 'SRS', '溫習', '複習'],
  'learning-goals': ['目標', 'goal', '計劃'],
  'ask-data': ['問資料', '我的資料', '搜尋資料', 'AI search'],
  calendar: ['日曆', 'calendar', '排程', '提醒', 'deadline', '日程'],
  search: ['搜尋', 'search', '搵資料', '全域'],
  inbox: ['快速擷取', 'inbox', '記低', '收件箱', 'capture'],
  countdown: ['倒數', 'deadline', '重要日子', '考試'],
  quiz: ['測驗', 'quiz', 'MC', '自測', '做題'],
}

function itemMatchesQuery(item: Item, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [item.label, item.hint, ...(item.aliases ?? [])].some((text) =>
    text.toLowerCase().includes(q),
  )
}

export default function CommandPalette({
  open,
  onClose,
  onNavigate,
  onQuickAdd,
}: Props) {
  const { t } = useTranslation()
  const { mode, setMode } = useMode()
  const recentFeatures = useCollection(recentFeaturesCol)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  // 組合所有可跳轉項目：目前模式嘅功能 + 模式切換
  // recordable：跳去一個「目的地」（首頁 / 功能）先記入最近；模式切換唔記。
  const baseItems = useMemo(() => {
    const list: Item[] = []

    list.push({
      id: 'home',
      label: t('shell.home', { defaultValue: '首頁概覽' }),
      icon: Home,
      hint: t('shell.navHint', { defaultValue: '導航' }),
      aliases: ['home', 'dashboard', '首頁', '概覽'],
      recordable: true,
      action: () => onNavigate(null),
    })

    // 快速記低（自然語言 → 待辦／提醒／行事曆）；非導航目的地，唔記入最近
    if (onQuickAdd) {
      list.push({
        id: 'quick-add',
        label: t('shell.quickAdd', { defaultValue: '快速記低' }),
        icon: Sparkles,
        hint: t('shell.actionHint', { defaultValue: '動作' }),
        aliases: ['快速記低', 'capture', 'inbox', '待辦', '提醒', 'todo'],
        recordable: false,
        action: () => onQuickAdd(),
      })
    }

    FEATURES.filter((f) => f.modes.includes(mode) && isFeatureAvailable(f.id)).forEach((f) =>
      list.push({
        id: f.id,
        label: featName(t, f),
        icon: f.icon,
        hint: groupLabel(t, f.group),
        aliases: [f.description, ...(FEATURE_SEARCH_ALIASES[f.id] ?? [])],
        hiddenFromDefaults: f.hideFromNavigation,
        recordable: true,
        action: () => onNavigate(f.id),
      }),
    )

    MODE_ORDER.filter((m) => m !== mode).forEach((m) =>
      list.push({
        id: `mode-${m}`,
        label: t('shell.switchTo', {
          mode: t(`mode.${m}.name`, { defaultValue: MODES[m].name }),
          defaultValue: `切換到${MODES[m].name}`,
        }),
        icon: MODES[m].icon,
        hint: t('shell.modeHint', { defaultValue: '模式' }),
        aliases: [MODES[m].name, 'mode', '切換模式', '工作模式', '個人模式'],
        recordable: false,
        action: () => {
          setMode(m)
          onNavigate(null)
        },
      }),
    )

    return list
  }, [mode, onNavigate, setMode, onQuickAdd, t])

  // 未輸入關鍵字時，喺最頂顯示「最近使用」（按開啟次序解析返目前有效項，
  // 隔走已唔屬目前模式 / 已移除嘅）。有輸入則照舊純搜尋、唔分區。
  const recentItems = useMemo(
    () =>
      query.trim()
        ? []
        : resolveRecentItems(recentFeatures, baseItems).filter((i) => !i.hiddenFromDefaults),
    [query, recentFeatures, baseItems],
  )

  // 鍵盤導航用嘅扁平序：最近區（如有）排頭、之後全部項目（去除已喺最近區嘅，
  // 避免重複）。recentCount = 最近區喺扁平序裡頭佔嘅項數（畀渲染畫分隔線）。
  const { items, recentCount } = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q) {
      return {
        items: baseItems.filter((i) => itemMatchesQuery(i, q)),
        recentCount: 0,
      }
    }
    const recentIds = new Set(recentItems.map((i) => i.id))
    const rest = baseItems.filter((i) => !recentIds.has(i.id) && !i.hiddenFromDefaults)
    return { items: [...recentItems, ...rest], recentCount: recentItems.length }
  }, [query, baseItems, recentItems])

  useEffect(() => {
    setActive(0)
  }, [query])

  if (!open) return null

  const run = (idx: number) => {
    const item = items[idx]
    if (item) {
      if (item.recordable) pushRecentFeature(item.id)
      item.action()
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center pt-[12vh]">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="指令面板"
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-overlay ring-1 ring-slate-900/5 dark:bg-slate-800 dark:ring-white/10"
      >
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 dark:border-slate-700">
          <Search size={18} strokeWidth={1.75} className="text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            role="combobox"
            aria-expanded={items.length > 0}
            aria-controls="command-palette-listbox"
            aria-activedescendant={
              items[active] ? `command-palette-option-${items[active].id}` : undefined
            }
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => Math.min(a + 1, items.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(a - 1, 0))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                run(active)
              } else if (e.key === 'Escape') {
                onClose()
              }
            }}
            placeholder="搜尋功能、切換模式…"
            className="flex-1 bg-transparent py-3.5 text-base sm:text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
          />
          <Kbd className="hidden sm:inline-flex">ESC</Kbd>
        </div>
        <ul
          id="command-palette-listbox"
          role="listbox"
          className="max-h-80 overflow-y-auto p-2"
        >
          {items.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-slate-400">
              搵唔到「{query}」
            </li>
          )}
          {items.map((item, idx) => {
            const on = idx === active
            // 未輸入時分區：第 0 項前加「最近使用」標題；最近區之後第一項前加
            // 「全部功能」標題（recentCount === 0 即無最近區，唔顯示任何標題）。
            const header =
              recentCount > 0 && idx === 0
                ? '最近使用'
                : recentCount > 0 && idx === recentCount
                  ? '全部功能'
                  : null
            return (
              <Fragment key={item.id}>
                {header && (
                  <li
                    role="presentation"
                    className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500"
                  >
                    {header === '最近使用' && <Clock size={12} />}
                    {header}
                  </li>
                )}
                <li
                  id={`command-palette-option-${item.id}`}
                  aria-selected={on}
                  role="option"
                >
                <button
                  type="button"
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => run(idx)}
                  className={cx(
                    'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                    on
                      ? 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent'
                      : 'text-slate-700 dark:text-slate-200',
                  )}
                >
                  <FeatureIcon
                    icon={item.icon}
                    size={18}
                    className={on ? 'text-accent' : 'text-slate-400'}
                  />
                  <span className="flex-1 font-medium">{item.label}</span>
                  <span
                    className={cx(
                      'text-xs',
                      on
                        ? 'text-accent-strong/70 dark:text-accent/70'
                        : 'text-slate-400',
                    )}
                  >
                    {item.hint}
                  </span>
                </button>
                </li>
              </Fragment>
            )
          })}
        </ul>
        <div className="flex items-center gap-3 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400 dark:border-slate-700 dark:text-slate-500">
          <span className="flex items-center gap-1">
            <Kbd>↑↓</Kbd> 選擇
          </span>
          <span className="flex items-center gap-1">
            <Kbd>↵</Kbd> 開啟
          </span>
          <span className="flex items-center gap-1">
            <Kbd>esc</Kbd> 關閉
          </span>
        </div>
      </div>
    </div>
  )
}
