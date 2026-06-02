import { useMemo, useState } from 'react'
import { useCollection } from '../../lib/store'
import { quizAttemptsCol } from '../../data/collections'
import { ClipboardList, History, Notebook, TrendingUp } from 'lucide-react'
import { PageHeader, Tabs } from '../../ui'
import { SetupView } from './quiz/SetupView'
import { QuizRunner } from './quiz/Runner'
import { ResultView } from './quiz/ResultView'
import { StatsView } from './quiz/StatsView'
import { MistakeBank } from './quiz/MistakeBank'
import { DEFAULT_SETTINGS, mistakesCol, type QuizSettings } from './quiz/util'

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
  const [tab, setTab] = useState<Tab>('quiz')
  const [view, setView] = useState<View>({ name: 'setup' })

  const attempts = useCollection(quizAttemptsCol)
  const mistakes = useCollection(mistakesCol)
  const activeMistakes = useMemo(() => mistakes.filter((m) => !m.mastered).length, [mistakes])

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
      <PageHeader
        title="自我測驗"
        description="揀個賽制即刻開戰：自動批改、即睇成績同掌握度，錯題再逐題操熟。"
        icon={ClipboardList}
      />

      <Tabs<Tab>
        tabs={[
          { id: 'quiz', label: `測驗${attempts.length ? ` · ${attempts.length}` : ''}` },
          { id: 'stats', label: '統計' },
          { id: 'mistakes', label: `錯題本${activeMistakes ? ` · ${activeMistakes}` : ''}` },
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
