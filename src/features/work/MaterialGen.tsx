import { useMemo, useState } from 'react'
import {
  ArrowUpRight,
  Bot,
  ChevronRight,
  ClipboardList,
  FileStack,
  FileText,
  Hammer,
  ListChecks,
  Sparkles,
  SquareStack,
  Stamp,
  Briefcase,
  type LucideIcon,
} from 'lucide-react'
import { useCollection } from '../../lib/store'
import { useNav } from '../../context/NavContext'
import { isAIConfigured } from '../../lib/aiClient'
import { topicsCol, questionsCol } from '../../data/collections'
import { Badge } from '../../ui'
import { QuestionGeneratorModal } from './materialGen/QuestionGeneratorModal'
import { WorksheetGenerator } from './materialGen/WorksheetGenerator'
import { PaperGenerator } from './materialGen/PaperGenerator'
import type { GenKind } from './materialGen/engine'

// ============================================================
//  MaterialGen — 「教材生成」hub（Phase C）
//  ------------------------------------------------------------
//  印刷工房 / 教材工作枱概念：一張工作枱檯面，上面排住六款生成「工具」。
//  撳入即開對應 generator（全部共用 engine.ts + questionsCol / papersCol）：
//    · MC 生成        → QuestionGeneratorModal kind='mc'
//    · 短答題生成      → kind='short'
//    · 教學個案        → kind='case'
//    · 結構式長題（＋）→ kind='long'
//    · 教學練習生成    → WorksheetGenerator（混合 mc+short worksheet）
//    · 試卷生成        → PaperGenerator（題庫抽題 + 生成補足 → SavedPaper）
//
//  · selfManagedHeader：自管 masthead（kicker + serif 標題 + 副題），
//    呼應 BAFS 題庫嘅考評檔案風格；host 唔再出標準 header。
//  · mode 色用 --accent（工作模式 = teal），深色 / 375px OK。
//  · AI 未接（isAIConfigured false）→ 頂部友善降級橫額；
//    各 generator 入面亦有自己嘅 AI gate（雙重保險）。
// ============================================================

// 開啟邊個 generator（modal 形式覆蓋）
type ActiveTool =
  | { kind: 'question'; gen: GenKind }
  | { kind: 'worksheet' }
  | { kind: 'paper' }
  | null

interface ToolCard {
  id: string
  title: string
  blurb: string
  icon: LucideIcon
  open: ActiveTool
  /** 存去邊（卡腳標示） */
  dest: '題庫' | '組卷'
  /** bonus / 進階標記 */
  badge?: string
}

const TOOLS: ToolCard[] = [
  {
    id: 'mc',
    title: 'MC 生成',
    blurb: '一鍵草擬選擇題：題幹、選項同正解齊備，逐條揀入題庫。',
    icon: ListChecks,
    open: { kind: 'question', gen: 'mc' },
    dest: '題庫',
  },
  {
    id: 'short',
    title: '短答題生成',
    blurb: '生成短答題連參考答案，適合課堂提問同小測。',
    icon: FileText,
    open: { kind: 'question', gen: 'short' },
    dest: '題庫',
  },
  {
    id: 'case',
    title: '教學個案',
    blurb: '商業情境 case study：完整處境 + 引導小題 + 評分準則。',
    icon: Briefcase,
    open: { kind: 'question', gen: 'case' },
    dest: '題庫',
  },
  {
    id: 'long',
    title: '結構式長題',
    blurb: '分段（a / b / c…）結構式長題目，附整體評分準則。',
    icon: SquareStack,
    open: { kind: 'question', gen: 'long' },
    dest: '題庫',
    badge: '進階',
  },
  {
    id: 'worksheet',
    title: '教學練習生成',
    blurb: '一份混合（MC ＋ 短答）課堂練習，可逐條揀入題庫或直接列印。',
    icon: ClipboardList,
    open: { kind: 'worksheet' },
    dest: '題庫',
  },
  {
    id: 'paper',
    title: '試卷生成',
    blurb: '揀課題範圍同各題型題數，先抽題庫、唔夠先生成，組成一份試卷。',
    icon: FileStack,
    open: { kind: 'paper' },
    dest: '組卷',
  },
]

export default function MaterialGen() {
  const nav = useNav()
  const topicsRaw = useCollection(topicsCol)
  const questions = useCollection(questionsCol)

  // 課題（依大綱次序），傳俾各 generator 的下拉 / 範圍
  const topics = useMemo(
    () => [...topicsRaw].sort((a, b) => a.order - b.order),
    [topicsRaw],
  )

  const [active, setActive] = useState<ActiveTool>(null)

  // 題庫中由教材生成（AI）入庫嘅大約條數（source 含 AI），純展示
  const aiCount = useMemo(
    () => questions.filter((q) => q.source?.includes('AI')).length,
    [questions],
  )

  return (
    <div className="space-y-5">
      {/* ───────── 工房 masthead：kicker + serif 標題 + 工序行 ───────── */}
      <header className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white px-5 py-5 shadow-xs dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none sm:px-7 sm:py-6">
        {/* 右上「製作工房」戳印（純裝飾） */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-6 top-3 hidden -rotate-6 select-none items-center gap-1 rounded-xl border-2 border-dashed border-accent/20 px-4 py-2 font-serif text-xs font-semibold uppercase tracking-[0.25em] text-accent/25 dark:border-accent/25 dark:text-accent/25 sm:flex"
        >
          <Stamp size={13} /> BAFS · 製作工房
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
            <Hammer size={13} />
            教材工作枱 · Material Studio
          </p>
          <h1 className="mt-1.5 font-serif text-[28px] font-semibold leading-none tracking-tight text-slate-800 dark:text-slate-100 sm:text-[34px]">
            教材生成
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            一個工作枱，集齊 BAFS 出題、個案、練習同試卷生成。生成完直接入
            <span className="font-medium text-accent-strong dark:text-accent">題庫</span>
            ，再可組卷、出自測、重用。
          </p>
        </div>
        {/* 工房雙線（檯面分隔感） */}
        <div className="mt-5 space-y-1" aria-hidden>
          <span className="block h-px bg-slate-200/90 dark:bg-slate-700/70" />
          <span className="block h-px bg-slate-200/60 dark:bg-slate-700/40" />
        </div>
      </header>

      {/* ───────── AI 未接友善降額（接咗就改顯示 AI 助手捷徑）───────── */}
      {!isAIConfigured ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
          <Bot size={18} className="mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            <p className="font-medium">AI 生成功能未啟用</p>
            <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-300/90">
              要設定好 Supabase 並部署 gemini Edge Function 先用到 AI 生成（步驟見 docs/SETUP.md）。未接 AI 都可以照用「試卷生成」由題庫抽現有題組卷。
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-accent/20 bg-accent-soft/40 px-4 py-2.5 text-sm dark:border-accent/25 dark:bg-accent/10">
          <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <Sparkles size={15} className="text-accent" />
            想自由追問、調教題目？
          </span>
          <button
            type="button"
            onClick={() => nav.open('work-ai')}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-accent-strong transition active:scale-[0.98] hover:bg-accent-soft dark:text-accent dark:hover:bg-accent/15"
          >
            喺 AI 助手繼續傾
            <ArrowUpRight size={14} />
          </button>
        </div>
      )}

      {/* ───────── 工具卡（工作枱檯面）───────── */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {TOOLS.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.open)}
              className="group flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-xs transition duration-150 active:scale-[0.98] hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none dark:hover:border-accent/40"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong transition group-hover:bg-accent group-hover:text-white dark:bg-accent/15 dark:text-accent dark:group-hover:bg-accent dark:group-hover:text-white">
                  <Icon size={20} strokeWidth={1.9} />
                </span>
                {t.badge ? (
                  <Badge tone="slate">{t.badge}</Badge>
                ) : null}
              </div>
              <h2 className="mt-3 flex items-center gap-1.5 text-base font-semibold text-slate-800 dark:text-slate-100">
                {t.title}
              </h2>
              <p className="mt-1 flex-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {t.blurb}
              </p>
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-700/60">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                  存入
                  <span className="font-semibold text-accent-strong dark:text-accent">
                    {t.dest}
                  </span>
                </span>
                <span className="inline-flex items-center gap-0.5 text-xs font-medium text-slate-400 transition group-hover:text-accent dark:text-slate-500 dark:group-hover:text-accent">
                  開始
                  <ChevronRight size={14} className="transition group-hover:translate-x-0.5" />
                </span>
              </div>
            </button>
          )
        })}
      </section>

      {/* 題庫存量小結（連去題庫） */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-400 dark:text-slate-500">
        <span className="tabular-nums">
          題庫現有 {questions.length} 條
          {aiCount > 0 ? <> · 其中 {aiCount} 條由 AI 生成</> : null}
        </span>
        <button
          type="button"
          onClick={() => nav.open('work-questions')}
          className="inline-flex items-center gap-0.5 font-medium text-slate-400 transition active:scale-[0.98] hover:text-accent dark:text-slate-500 dark:hover:text-accent"
        >
          去 BAFS 題庫
          <ChevronRight size={13} />
        </button>
      </div>

      {/* ───────── Generators（modal）───────── */}
      {active?.kind === 'question' && (
        <QuestionGeneratorModal
          kind={active.gen}
          topics={topics}
          onClose={() => setActive(null)}
        />
      )}
      {active?.kind === 'worksheet' && (
        <WorksheetGenerator topics={topics} onClose={() => setActive(null)} />
      )}
      {active?.kind === 'paper' && (
        <PaperGenerator topics={topics} onClose={() => setActive(null)} />
      )}
    </div>
  )
}
