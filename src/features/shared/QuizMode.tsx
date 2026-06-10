import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCollection } from '../../lib/store'
import { quizAttemptsCol } from '../../data/collections'
import { ClipboardList, Flame, History, Notebook, Swords, TrendingUp } from 'lucide-react'
import { Tabs } from '../../ui'
import { SetupView } from './quiz/SetupView'
import { QuizRunner } from './quiz/Runner'
import { ResultView } from './quiz/ResultView'
import { StatsView } from './quiz/StatsView'
import { MistakeBank } from './quiz/MistakeBank'
import { DEFAULT_SETTINGS, mistakesCol, pct, type QuizSettings } from './quiz/util'
import './quizMode/i18n'

// ============================================================
//  自我測驗（QuizMode）— Quizlet / Kahoot 級
//  ------------------------------------------------------------
//  learning + work 共用。由 BAFS 題庫抽題即時做題。
//  • 三種模式：練習（即查）/ 測驗（最後批改）/ 計時搶分（Kahoot）
//  • 兩種題型：選擇題 + 短答題（文字自評）
//  • 鍵盤導航 / 題目導航格 / 標記題目 / 打亂選項
//  • 跨次統計：命中率走勢 / 課題掌握 / 難度占比 / 練習熱力圖
//  • 錯題本：自動收集答錯題、集中操練、標記掌握
//  零 AI、零新 npm；圖表全自製 SVG/div。
//  唔改 data/collections.ts；錯題本用自家 quiz.mistakes collection。
// ============================================================

type Tab = 'quiz' | 'stats' | 'mistakes'

type View =
  | { name: 'setup'; topicId?: string }
  | { name: 'quiz'; questionIds: string[]; settings: QuizSettings }
  | { name: 'result'; attemptId: string; settings: QuizSettings }

export default function QuizMode() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('quiz')
  const [view, setView] = useState<View>({ name: 'setup' })

  const attempts = useCollection(quizAttemptsCol)
  const mistakes = useCollection(mistakesCol)
  const activeMistakes = useMemo(() => mistakes.filter((m) => !m.mastered).length, [mistakes])
  // 競技場狀態（純衍生，masthead status 行用）：歷來最佳命中率
  const bestScore = useMemo(
    () => attempts.reduce((m, a) => Math.max(m, pct(a.correctCount, a.total)), 0),
    [attempts],
  )

  // 由任何地方開始做一份題（切返「測驗」tab）
  const startWith = (questionIds: string[], settings: QuizSettings) => {
    setTab('quiz')
    setView({ name: 'quiz', questionIds, settings })
  }
  // 由統計「課題掌握度」撳一下 → 返 setup 並預選該課題範圍（畀用家揀題數）
  const practiceTopic = (topicId: string) => {
    setTab('quiz')
    setView({ name: 'setup', topicId })
  }

  // ── 做題中 / 結果頁：全屏接管（唔顯示 tabs）──
  if (view.name === 'quiz') {
    return (
      <QuizRunner
        key={view.questionIds.join('|')}
        questionIds={view.questionIds}
        settings={view.settings}
        onAbort={() => setView({ name: 'setup' })}
        onFinish={(attemptId) => setView({ name: 'result', attemptId, settings: view.settings })}
      />
    )
  }
  if (view.name === 'result') {
    return (
      <ResultView
        attemptId={view.attemptId}
        onBackToSetup={() => setView({ name: 'setup' })}
        onRetryWrong={(questionIds) => startWith(questionIds, view.settings)}
        onRetrySame={(questionIds) => startWith(questionIds, view.settings)}
      />
    )
  }

  return (
    <div className="space-y-5">
      {/* ───────── 競技場 masthead：功能名做頁面身份（kicker 競技場 + serif「自我測驗」+ 賽季戰況行）───────── */}
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.3em] text-accent/70 dark:text-accent/80">
            <Swords size={13} className="shrink-0" />
            {t('quiz.kicker', { defaultValue: '競技場 · Quiz Arena' })}
          </p>
          <h1 className="mt-1 font-serif text-[28px] font-semibold leading-none tracking-tight text-slate-800 dark:text-slate-100 sm:text-[32px]">
            {t('quiz.title', { defaultValue: '自我測驗' })}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">
              <ClipboardList size={12} className="shrink-0 opacity-70" />
              {t('quiz.subtitle', { defaultValue: '揀個賽制即刻開戰，自動批改、即睇掌握度' })}
            </span>
            {attempts.length > 0 && (
              <>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                <span className="tabular-nums">{t('quiz.battleCount', { count: attempts.length, defaultValue: '已戰 {{count}} 次' })}</span>
                {bestScore > 0 && (
                  <>
                    <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                    <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                      <Flame size={12} className="shrink-0" /> {t('quiz.bestScore', { score: bestScore, defaultValue: '最佳 {{score}}%' })}
                    </span>
                  </>
                )}
              </>
            )}
          </p>
        </div>
      </header>

      <Tabs<Tab>
        tabs={[
          { id: 'quiz', label: `${t('quiz.tabQuiz', { defaultValue: '測驗' })}${attempts.length ? ` · ${attempts.length}` : ''}` },
          { id: 'stats', label: t('quiz.tabStats', { defaultValue: '統計' }) },
          { id: 'mistakes', label: `${t('quiz.tabMistakes', { defaultValue: '錯題本' })}${activeMistakes ? ` · ${activeMistakes}` : ''}` },
        ]}
        active={tab}
        onChange={setTab}
        icons={{ quiz: History, stats: TrendingUp, mistakes: Notebook }}
      />

      {tab === 'quiz' && (
        <SetupView
          key={view.topicId ?? 'setup'}
          initialTopicId={view.topicId}
          onStart={startWith}
          onReview={(attemptId, settings) => setView({ name: 'result', attemptId, settings })}
        />
      )}
      {tab === 'stats' && <StatsView onPractice={practiceTopic} />}
      {tab === 'mistakes' && <MistakeBank onPractice={(ids) => startWith(ids, DEFAULT_SETTINGS)} />}
    </div>
  )
}
