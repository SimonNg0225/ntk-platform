import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCollection } from '../../lib/store'
import { quizAttemptsCol } from '../../data/collections'
import { Flame, History, Notebook, Swords, TrendingUp } from 'lucide-react'
import { FeatureGuide, type FeatureGuideStep, PageHero } from '../../ui'
import { SetupView } from './quiz/SetupView'
import { QuizRunner } from './quiz/Runner'
import { ResultView } from './quiz/ResultView'
import { StatsView } from './quiz/StatsView'
import { MistakeBank } from './quiz/MistakeBank'
import { DEFAULT_SETTINGS, mistakesCol, pct, type QuizSettings } from './quiz/util'

// ============================================================
//  自我測驗（QuizMode）— Quizlet / Kahoot 級
//  ------------------------------------------------------------
//  learning + work 共用。由題庫抽題即時做題。
//  • 三種模式：練習（即查）/ 測驗（最後批改）/ 計時搶分（Kahoot）
//  • 兩種題型：選擇題 + 短答題（文字自評）
//  • 鍵盤導航 / 題目導航格 / 標記題目 / 打亂選項
//  • 跨次統計：命中率走勢 / 課題掌握 / 難度占比 / 練習熱力圖
//  • 錯題本：自動收集答錯題、集中操練、標記掌握
//  零 AI、零新 npm；圖表全自製 SVG/div。
//  不改 data/collections.ts；錯題本用自家 quiz.mistakes collection。
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
  // 由統計「課題掌握度」按一下 → 返 setup 並預選該課題範圍（給用家選擇題數）
  const practiceTopic = (topicId: string) => {
    setTab('quiz')
    setView({ name: 'setup', topicId })
  }

  // 教學引導步驟（3 步；defaultValue 廣東話，不改 i18n 檔）
  const GUIDE_STEPS: FeatureGuideStep[] = [
    {
      title: t('quiz.guide1Title', { defaultValue: '選擇賽制同範圍' }),
      desc: t('quiz.guide1Desc', {
        defaultValue: '選擇練習 / 測驗 / 搶分，再選擇課題、難度同題數，題目由你的題庫即時抽。',
      }),
    },
    {
      title: t('quiz.guide2Title', { defaultValue: '開始作答' }),
      desc: t('quiz.guide2Desc', {
        defaultValue: '逐題作答，完成後自動批改；可用鍵盤導航、標記題目同打亂選項。',
      }),
    },
    {
      title: t('quiz.guide3Title', { defaultValue: '查看統計、操練錯題' }),
      desc: t('quiz.guide3Desc', {
        defaultValue: '在「統計」查看命中率走勢同課題掌握度，答錯的自動入「錯題本」集中重做。',
      }),
    },
  ]

  // ── 做題中 / 結果頁：全屏接管（不顯示 tabs）──
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
      {/* ───────── PageHero（共用 accent hero：icon chip + kicker + 標題 + 副題 + 戰績 + 分頁） ───────── */}
      <PageHero
        guideKey="quiz"
        icon={Swords}
        kicker={t('quiz.kicker', { defaultValue: '自學工具 · 由你的題庫即時出題' })}
        title={t('quiz.title', { defaultValue: '自我測驗' })}
        description={t('quiz.subtitle', {
          defaultValue: '選擇一個賽制立即開始，自動批改，即查看命中率同課題掌握度。',
        })}
        actions={
          attempts.length > 0 ? (
            <div className="flex shrink-0 items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
                {t('quiz.doneCount', { defaultValue: '已測' })}
                <span className="tabular-nums slashed-zero">{attempts.length}</span>
                {t('quiz.doneUnit', { defaultValue: '次' })}
              </span>
              {bestScore > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
                  <Flame size={12} className="shrink-0" />
                  {t('quiz.best', { defaultValue: '最佳' })}
                  <span className="tabular-nums slashed-zero">{bestScore}%</span>
                </span>
              )}
            </div>
          ) : undefined
        }
        tabs={(
          [
            { id: 'quiz' as Tab, label: `測驗${attempts.length ? ` · ${attempts.length}` : ''}`, Icon: History },
            { id: 'stats' as Tab, label: '統計', Icon: TrendingUp },
            { id: 'mistakes' as Tab, label: `錯題本${activeMistakes ? ` · ${activeMistakes}` : ''}`, Icon: Notebook },
          ] as const
        ).map(({ id, label, Icon }) => {
          const on = tab === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ' +
                (on
                  ? 'bg-white text-accent-strong'
                  : 'bg-white/15 font-medium text-white hover:bg-white/25')
              }
            >
              <Icon size={14} />
              {label}
            </button>
          )
        })}
      />

      {/* ───────── 教學引導：如何使用此功能 ───────── */}
      <FeatureGuide
        storageKey="quiz"
        title={t('quiz.guideTitle', { defaultValue: '自我測驗使用說明' })}
        steps={GUIDE_STEPS}
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
