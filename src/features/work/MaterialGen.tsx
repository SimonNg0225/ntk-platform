import { useMemo, useState } from 'react'
import {
  ArrowUpRight,
  Bot,
  ChevronRight,
  ClipboardList,
  FileStack,
  FileText,
  FolderOpen,
  Layers,
  ListChecks,
  Sparkles,
  SquareStack,
  Briefcase,
  type LucideIcon,
} from 'lucide-react'
import { useCollection } from '../../lib/store'
import { useNav } from '../../context/NavContext'
import { useSettings } from '../../context/SettingsContext'
import { isAIConfigured } from '../../lib/aiClient'
import { topicsCol, questionsCol } from '../../data/collections'
import { getSubjectPack } from '../../data/subjects'
import { Badge, FeatureGuide, type FeatureGuideStep, PageHero, cx } from '../../ui'
import { QuestionGeneratorModal } from './materialGen/QuestionGeneratorModal'
import { WorksheetGenerator } from './materialGen/WorksheetGenerator'
import { PaperGenerator } from './materialGen/PaperGenerator'
import type { GenKind } from './materialGen/engine'

// ============================================================
//  MaterialGen — 「教材生成」hub（Phase C）
//  ------------------------------------------------------------
//  一個教材工作枱：上面排住六款生成「工具」。撳入即開對應 generator
//  （全部共用 engine.ts + questionsCol / papersCol）：
//    · MC 生成        → QuestionGeneratorModal kind='mc'
//    · 短答題生成      → kind='short'
//    · 教學個案        → kind='case'
//    · 結構式長題（＋）→ kind='long'
//    · 教學練習生成    → WorksheetGenerator（混合 mc+short worksheet）
//    · 試卷生成        → PaperGenerator（題庫抽題 + 生成補足 → SavedPaper）
//
//  呈現層對齊「工作儀表板」設計語言：accent hero masthead（rounded-2xl）、
//  FeatureGuide 教學引導、標準互動磚（hover:shadow-md + focus ring + active
//  scale）、語意 tone chip、引導式收尾卡。主色用 --accent token 跟模式切換。
//  AI 未接（isAIConfigured false）→ 友善降級橫額；各 generator 亦有自己
//  嘅 AI gate（雙重保險）。
//  ⚠️ 只改呈現層，功能 / 資料流 / collection 讀寫一概不動。
// ============================================================

// 開啟邊個 generator（modal 形式覆蓋）
type ActiveTool =
  | { kind: 'question'; gen: GenKind }
  | { kind: 'worksheet' }
  | { kind: 'paper' }
  | null

// 語意 tone（嚴格照 WorkDashboard 的 TONE map：chip 底+icon 字）
type Tone = 'accent' | 'amber' | 'emerald' | 'violet' | 'sky' | 'rose'
const TONE: Record<Tone, string> = {
  accent: 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
}

interface ToolCard {
  id: string
  title: string
  blurb: string
  icon: LucideIcon
  tone: Tone
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
    tone: 'accent',
    open: { kind: 'question', gen: 'mc' },
    dest: '題庫',
  },
  {
    id: 'short',
    title: '短答題生成',
    blurb: '生成短答題連參考答案，適合課堂提問同小測。',
    icon: FileText,
    tone: 'sky',
    open: { kind: 'question', gen: 'short' },
    dest: '題庫',
  },
  {
    id: 'case',
    title: '教學個案',
    blurb: '完整情境個案：處境 + 引導小題 + 評分準則，培養應用題能力。',
    icon: Briefcase,
    tone: 'violet',
    open: { kind: 'question', gen: 'case' },
    dest: '題庫',
  },
  {
    id: 'long',
    title: '結構式長題',
    blurb: '分段（a / b / c…）結構式長題目，附整體評分準則。',
    icon: SquareStack,
    tone: 'amber',
    open: { kind: 'question', gen: 'long' },
    dest: '題庫',
    badge: '進階',
  },
  {
    id: 'worksheet',
    title: '教學練習生成',
    blurb: '一份混合（MC ＋ 短答）課堂練習，可逐條揀入題庫或直接列印。',
    icon: ClipboardList,
    tone: 'emerald',
    open: { kind: 'worksheet' },
    dest: '題庫',
  },
  {
    id: 'paper',
    title: '試卷生成',
    blurb: '揀課題範圍同各題型題數，先抽題庫、唔夠先生成，組成一份試卷。',
    icon: FileStack,
    tone: 'rose',
    open: { kind: 'paper' },
    dest: '組卷',
  },
]

export default function MaterialGen() {
  const nav = useNav()
  const { subjectPackId } = useSettings()
  const subjShort = getSubjectPack(subjectPackId)?.short ?? '本科'
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

  // 教學引導（3 步：揀工具 → 設定生成 → 入庫重用）
  const guideSteps: FeatureGuideStep[] = [
    {
      title: '揀一款生成工具',
      desc: '由下面六張卡揀返要做嘅題型（MC、短答、個案、長題、練習、試卷）。',
    },
    {
      title: '設定範圍同題數',
      desc: '喺彈出視窗揀課題、難度同題數，撳生成，AI 即時草擬好成份。',
    },
    {
      title: '入庫、再重用',
      desc: '逐條揀入題庫，之後可組卷、出自測或備課重用，唔使再由零開始。',
    },
  ]

  return (
    <div className="space-y-5">
      {/* ───────── Masthead：共用 PageHero（accent hero）───────── */}
      <PageHero
        guideKey="material-gen"
        icon={Layers}
        kicker="Material Studio"
        title="教材生成"
        description={`一個工作枱，集齊${subjShort}出題、個案、練習同試卷生成；生成完直接入題庫，再可組卷、出自測、重用。`}
      />

      {/* ───────── 教學引導：點用呢個功能（可摺疊 / 永久收起） ───────── */}
      <FeatureGuide
        storageKey="material-gen"
        title="教材生成點用？"
        steps={guideSteps}
      />

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

      {/* ───────── 工具卡（揀一款生成工具）───────── */}
      <section aria-label="生成工具" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {TOOLS.map((tool) => {
          const Icon = tool.icon
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => setActive(tool.open)}
              aria-label={`${tool.title}：${tool.blurb}`}
              className="group flex h-full cursor-pointer flex-col rounded-2xl border border-slate-200/80 bg-white p-4 text-left transition duration-200 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98] dark:border-slate-700/60 dark:bg-slate-800 dark:hover:border-slate-600"
            >
              <div className="flex items-start justify-between gap-2">
                <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', TONE[tool.tone])}>
                  <Icon size={16} />
                </span>
                {tool.badge ? <Badge tone="slate">{tool.badge}</Badge> : null}
              </div>
              <h2 className="mt-3 text-base font-semibold text-slate-800 dark:text-slate-100">
                {tool.title}
              </h2>
              <p className="mt-1 flex-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {tool.blurb}
              </p>
              <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2.5 dark:border-slate-700">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                  存入
                  <span className="font-semibold text-accent-strong dark:text-accent">
                    {tool.dest}
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

      {/* ───────── 題庫收尾卡（引導式：去題庫睇 / 重用生成成果）───────── */}
      <button
        type="button"
        onClick={() => nav.open('work-questions')}
        className="group flex w-full items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 text-left transition duration-200 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98] dark:border-slate-700/60 dark:bg-slate-800 dark:hover:border-slate-600"
      >
        <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', TONE.accent)}>
          <FolderOpen size={16} />
        </span>
        <div className="min-w-0 flex-1">
          {questions.length > 0 ? (
            <>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {subjShort}題庫現有{' '}
                <span className="font-semibold tabular-nums slashed-zero text-accent-strong dark:text-accent">
                  {questions.length}
                </span>{' '}
                條
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                {aiCount > 0 ? (
                  <span className="tabular-nums">其中 {aiCount} 條由 AI 生成 · </span>
                ) : null}
                去題庫管理、組卷或重用
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                題庫仲未有題目
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                用上面任何一款工具生成，揀入題庫後就會喺呢度集齊。
              </p>
            </>
          )}
        </div>
        <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-accent transition group-hover:text-accent-strong">
          去{subjShort}題庫
          <ChevronRight size={14} className="transition group-hover:translate-x-0.5" />
        </span>
      </button>

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
