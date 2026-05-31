import { useMemo, useState } from 'react'
import { useCollection } from '../../../lib/store'
import { useToast } from '../../../context/ToastContext'
import { useConfirm } from '../../../context/ConfirmContext'
import { questionsCol, topicsCol, quizAttemptsCol } from '../../../data/collections'
import type { QuizAttempt } from '../../../data/types'
import {
  BookMarked,
  Dumbbell,
  FileCheck2,
  FolderOpen,
  Play,
  Target,
  Timer,
  Trophy,
  Zap,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Pills,
  SectionTitle,
  Select,
  StatCard,
  cx,
} from '../../../ui'
import {
  COUNT_OPTIONS,
  DEFAULT_SETTINGS,
  DIFF_FILTER_LABEL,
  DIFF_LABEL,
  DIFF_ORDER,
  QUIZ_MODE_HINT,
  TIME_OPTIONS,
  fmtDuration,
  formatDateTime,
  isQuizableMc,
  isQuizableShort,
  pct,
  scoreColor,
  settingsFromAttempt,
  shuffle,
  type CountId,
  type DiffFilter,
  type QuizMode,
  type QuizSettings,
  type TimeLimit,
} from './util'

// ============================================================
//  SetupView — 開卷設定（模式 / 範圍 / 題型）+ 歷史紀錄
// ============================================================

const MODE_CARDS: { id: QuizMode; label: string; icon: typeof Play }[] = [
  { id: 'practice', label: '練習', icon: Dumbbell },
  { id: 'classic', label: '測驗', icon: FileCheck2 },
  { id: 'timed', label: '搶分', icon: Zap },
]

export function SetupView({
  onStart,
  onReview,
  initialTopicId,
}: {
  onStart: (questionIds: string[], settings: QuizSettings) => void
  onReview: (attemptId: string, settings: QuizSettings) => void
  initialTopicId?: string
}) {
  const questions = useCollection(questionsCol)
  const topics = useCollection(topicsCol)
  const attempts = useCollection(quizAttemptsCol)
  const toast = useToast()
  const confirm = useConfirm()

  const [settings, setSettings] = useState<QuizSettings>(() =>
    initialTopicId ? { ...DEFAULT_SETTINGS, topicId: initialTopicId } : DEFAULT_SETTINGS,
  )
  const set = <K extends keyof QuizSettings>(k: K, v: QuizSettings[K]) =>
    setSettings((s) => ({ ...s, [k]: v }))

  const topicName = (id: string) => topics.find((t) => t.id === id)?.topic ?? '未分類'

  const mcPool = useMemo(() => questions.filter(isQuizableMc), [questions])
  const shortPool = useMemo(() => questions.filter(isQuizableShort), [questions])
  const totalPool = mcPool.length + shortPool.length

  // 按範圍 + 難度 + 題型過濾
  const matched = useMemo(() => {
    let pool = [...mcPool]
    if (settings.includeShort) pool = pool.concat(shortPool)
    return pool
      .filter((q) => (settings.topicId ? q.topicId === settings.topicId : true))
      .filter((q) =>
        settings.difficulty === 'all' ? true : q.difficulty === settings.difficulty,
      )
  }, [mcPool, shortPool, settings.includeShort, settings.topicId, settings.difficulty])

  const wantCount = settings.count === 'all' ? matched.length : Number(settings.count)
  const takeCount = Math.min(wantCount, matched.length)
  const cappedByPool = settings.count !== 'all' && wantCount > matched.length

  // 各題數可取量（畀 Pills counts）
  const countAvail = useMemo(() => {
    const out: Partial<Record<CountId, number>> = {}
    for (const o of COUNT_OPTIONS) {
      const want = o.id === 'all' ? matched.length : Number(o.id)
      out[o.id] = Math.min(want, matched.length)
    }
    return out
  }, [matched.length])

  const historyDesc = useMemo(
    () => [...attempts].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [attempts],
  )
  const avgPct = useMemo(() => {
    if (attempts.length === 0) return null
    const sum = attempts.reduce((acc, a) => acc + pct(a.correctCount, a.total), 0)
    return Math.round(sum / attempts.length)
  }, [attempts])

  const scopeLabel = settings.topicId ? topicName(settings.topicId) : '全部課題'

  const start = () => {
    if (takeCount === 0) return
    const picked = shuffle(matched).slice(0, takeCount)
    onStart(picked.map((q) => q.id), settings)
  }

  const removeAttempt = async (a: QuizAttempt) => {
    const ok = await confirm({
      title: '刪除測驗紀錄？',
      message: `「${a.title}」嘅成績會被永久刪除，無法復原。`,
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    quizAttemptsCol.remove(a.id)
    toast.success('已刪除測驗紀錄')
  }

  return (
    <div className="animate-fade-in space-y-5">
      {/* 總覽 StatCard */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="可測題數" value={totalPool} unit="題" icon={BookMarked} highlight />
        <StatCard label="測驗次數" value={attempts.length} unit="次" icon={FolderOpen} />
        <StatCard label="平均分" value={avgPct == null ? '—' : `${avgPct}%`} icon={Target} />
      </div>

      {totalPool === 0 ? (
        <EmptyState
          icon={BookMarked}
          title="題庫未有可測題目"
          hint="先去『BAFS 題庫』新增有正確答案嘅選擇題（或有參考答案嘅短答題），再返嚟自測。"
        />
      ) : (
        <section>
          <SectionTitle>開始測驗</SectionTitle>
          <Card className="space-y-5 p-4">
            {/* 模式（卡片式三選一） */}
            <div className="space-y-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">模式</span>
              <div className="grid grid-cols-3 gap-2">
                {MODE_CARDS.map((m) => {
                  const on = settings.mode === m.id
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => set('mode', m.id)}
                      aria-pressed={on}
                      className={cx(
                        'flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition',
                        on
                          ? 'border-accent bg-accent-soft text-accent-strong dark:border-accent/60 dark:bg-accent/15 dark:text-accent'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-accent/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
                      )}
                    >
                      <m.icon size={20} strokeWidth={2} />
                      <span className="text-sm font-semibold">{m.label}</span>
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500">{QUIZ_MODE_HINT[settings.mode]}</p>
            </div>

            {/* 課題範圍 */}
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">課題範圍</span>
              <Select value={settings.topicId} onChange={(e) => set('topicId', e.target.value)}>
                <option value="">全部課題</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.topic}
                  </option>
                ))}
              </Select>
            </label>

            {/* 難度 */}
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">難度</span>
              <Pills
                options={[
                  { id: 'all', label: DIFF_FILTER_LABEL.all },
                  ...DIFF_ORDER.map((d) => ({ id: d, label: DIFF_LABEL[d] })),
                ]}
                active={settings.difficulty}
                onChange={(v) => set('difficulty', v as DiffFilter)}
              />
              <p className="text-xs text-slate-400 dark:text-slate-500" aria-live="polite">
                符合條件題目：<span className="font-semibold text-accent">{matched.length}</span> 題
              </p>
            </div>

            {/* 題數 */}
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">題數</span>
              <Pills
                options={COUNT_OPTIONS}
                active={settings.count}
                onChange={(v) => set('count', v as CountId)}
                counts={countAvail}
              />
              {cappedByPool && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  可用題目唔夠，實際出 {takeCount} 題。
                </p>
              )}
            </div>

            {/* 計時秒數（只 timed 模式顯示） */}
            {settings.mode === 'timed' && (
              <div className="space-y-1.5">
                <span className="flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                  <Timer size={13} /> 每題限時
                </span>
                <Pills
                  options={TIME_OPTIONS}
                  active={String(settings.timeLimit)}
                  onChange={(v) => set('timeLimit', Number(v) as TimeLimit)}
                />
              </div>
            )}

            {/* 進階選項 */}
            <div className="flex flex-wrap gap-2">
              <ToggleChip
                label="包含短答題"
                hint={`+${shortPool.length}`}
                active={settings.includeShort}
                disabled={shortPool.length === 0}
                onClick={() => set('includeShort', !settings.includeShort)}
              />
              <ToggleChip
                label="打亂選項次序"
                active={settings.shuffleOptions}
                onClick={() => set('shuffleOptions', !settings.shuffleOptions)}
              />
            </div>

            <Button size="lg" className="w-full" icon={Play} disabled={takeCount === 0} onClick={start}>
              {takeCount === 0
                ? '無符合條件題目'
                : `開始（${takeCount} 題） · ${scopeLabel} · ${DIFF_FILTER_LABEL[settings.difficulty]}`}
            </Button>
          </Card>
        </section>
      )}

      {/* 歷史紀錄 */}
      <section>
        <SectionTitle>歷史紀錄</SectionTitle>
        {historyDesc.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="仲未有測驗紀錄"
            hint="完成第一次自測之後，成績會喺呢度睇返、重溫同重做錯題。"
          />
        ) : (
          <ul className="space-y-2">
            {historyDesc.map((a) => {
              const p = pct(a.correctCount, a.total)
              const isTimed = a.title.includes('搶分')
              return (
                <Card key={a.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {a.title}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                        {formatDateTime(a.createdAt)}
                      </p>
                    </div>
                    <div className={cx('shrink-0 text-2xl font-bold tabular-nums', scoreColor(p))}>
                      {p}%
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge tone="slate">
                      <span className="tabular-nums">{a.correctCount}/{a.total}</span> 題
                    </Badge>
                    <Badge tone="slate" icon={Timer}>
                      <span className="tabular-nums">{fmtDuration(a.durationSec)}</span>
                    </Badge>
                    {isTimed && <Badge tone="accent" icon={Trophy}>搶分</Badge>}
                    <Badge tone={a.mode === 'work' ? 'blue' : 'accent'}>
                      {a.mode === 'work' ? '工作' : '個人'}
                    </Badge>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => onReview(a.id, settingsFromAttempt(a))}>
                      重溫
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAttempt(a)}
                      className="hover:text-rose-500"
                    >
                      刪除
                    </Button>
                  </div>
                </Card>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

// 進階選項小開關（Pill 風 toggle）
function ToggleChip({
  label,
  hint,
  active,
  disabled,
  onClick,
}: {
  label: string
  hint?: string
  active: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40',
        active
          ? 'bg-accent text-white shadow-sm dark:shadow-none'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
      )}
    >
      <span
        className={cx(
          'h-3.5 w-3.5 rounded-full border-2 transition',
          active ? 'border-white bg-white/30' : 'border-slate-300 dark:border-slate-500',
        )}
      />
      {label}
      {hint && (
        <span className={cx('text-xs tabular-nums', active ? 'text-white/80' : 'text-slate-400')}>
          {hint}
        </span>
      )}
    </button>
  )
}
