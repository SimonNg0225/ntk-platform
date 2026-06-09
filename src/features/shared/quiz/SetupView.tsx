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
  Layers,
  Play,
  Shuffle,
  Sparkles,
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
  Select,
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
  scoreTone,
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
//  ------------------------------------------------------------
//  重塑：清楚層次（模式選擇置頂、選項分區呼吸）＋ 顯眼開始 CTA。
//  純表現層；抽題 / 過濾 / 計分 / 歷史邏輯一概不變。
// ============================================================

const MODE_CARDS: {
  id: QuizMode
  label: string
  tagline: string
  icon: typeof Play
}[] = [
  { id: 'practice', label: '練習', tagline: '即查即明', icon: Dumbbell },
  { id: 'classic', label: '測驗', tagline: '模擬考試', icon: FileCheck2 },
  { id: 'timed', label: '搶分', tagline: '計時挑戰', icon: Zap },
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
    <div className="animate-fade-in space-y-6">
      {/* ── 概覽：三個迷你統計（細圖示 chip，唔搶 CTA 風頭）── */}
      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="可測題目" value={totalPool} unit="題" icon={BookMarked} tone="accent" />
        <MiniStat label="完成測驗" value={attempts.length} unit="次" icon={FolderOpen} tone="sky" />
        <MiniStat
          label="平均命中"
          value={avgPct == null ? '—' : avgPct}
          unit={avgPct == null ? undefined : '%'}
          icon={Target}
          tone="emerald"
        />
      </div>

      {totalPool === 0 ? (
        <EmptyState
          icon={BookMarked}
          title="題庫仲未有可以測嘅題目"
          hint="去『題庫』加幾條有正確答案嘅選擇題（或者有參考答案嘅短答題），返嚟就可以即刻開始自測。"
        />
      ) : (
        <section className="space-y-5">
          {/* 主行動入口：揀賽制（最大、最搶眼，似遊戲大堂揀玩法） */}
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent/70 dark:text-accent/80">
              <Sparkles size={12} className="shrink-0" />
              揀賽制
            </p>
            <p className="mb-3 text-xl font-semibold tracking-tight text-slate-800 dark:text-slate-100">
              今次想點挑戰？
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              {MODE_CARDS.map((m) => {
                const on = settings.mode === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => set('mode', m.id)}
                    aria-pressed={on}
                    className={cx(
                      'group relative flex flex-col items-center gap-2 overflow-hidden rounded-2xl border p-4 text-center transition duration-200',
                      on
                        ? 'border-accent bg-accent-soft text-accent-strong shadow-sm dark:border-accent/60 dark:bg-accent/15 dark:text-accent'
                        : 'border-slate-200/80 bg-white text-slate-600 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md dark:border-slate-700/60 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-accent/40',
                    )}
                  >
                    {/* 選中：頂部 accent 燈條 */}
                    {on && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-0 top-0 h-0.5 bg-accent"
                      />
                    )}
                    <span
                      className={cx(
                        'flex h-11 w-11 items-center justify-center rounded-2xl transition duration-200',
                        on
                          ? 'bg-accent text-white shadow-sm shadow-accent/30'
                          : 'bg-slate-100 text-slate-500 group-hover:bg-accent-soft group-hover:text-accent-strong dark:bg-slate-700 dark:text-slate-300 dark:group-hover:bg-accent/15 dark:group-hover:text-accent',
                      )}
                    >
                      <m.icon size={20} strokeWidth={2} />
                    </span>
                    <span className="text-sm font-semibold">{m.label}</span>
                    <span
                      className={cx(
                        'text-[11px]',
                        on ? 'text-accent/80 dark:text-accent/80' : 'text-slate-400 dark:text-slate-500',
                      )}
                    >
                      {m.tagline}
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Sparkles size={13} className="shrink-0 text-accent" />
              {QUIZ_MODE_HINT[settings.mode]}
            </p>
          </div>

          {/* 出題範圍：難度 / 課題 / 題數（分區、留白） */}
          <Card padded className="space-y-5">
            {/* 難度 + 課題（同一行呼吸） */}
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <OptionLabel icon={Layers}>難度</OptionLabel>
                <Pills
                  options={[
                    { id: 'all', label: DIFF_FILTER_LABEL.all },
                    ...DIFF_ORDER.map((d) => ({ id: d, label: DIFF_LABEL[d] })),
                  ]}
                  active={settings.difficulty}
                  onChange={(v) => set('difficulty', v as DiffFilter)}
                />
              </div>
              <div className="space-y-2">
                <OptionLabel icon={FolderOpen}>課題範圍</OptionLabel>
                <Select value={settings.topicId} onChange={(e) => set('topicId', e.target.value)}>
                  <option value="">全部課題</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.topic}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {/* 題數 */}
            <div className="space-y-2">
              <OptionLabel icon={Target}>題數</OptionLabel>
              <Pills
                options={COUNT_OPTIONS}
                active={settings.count}
                onChange={(v) => set('count', v as CountId)}
                counts={countAvail}
              />
            </div>

            {/* 計時秒數（只 timed 模式顯示） */}
            {settings.mode === 'timed' && (
              <div className="space-y-2">
                <OptionLabel icon={Timer}>每題限時</OptionLabel>
                <Pills
                  options={TIME_OPTIONS}
                  active={String(settings.timeLimit)}
                  onChange={(v) => set('timeLimit', Number(v) as TimeLimit)}
                />
              </div>
            )}

            {/* 進階選項 */}
            <div className="space-y-2">
              <OptionLabel icon={Shuffle}>進階</OptionLabel>
              <div className="flex flex-wrap gap-2">
                <ToggleChip
                  label="包含短答題"
                  hint={shortPool.length > 0 ? `+${shortPool.length}` : undefined}
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
            </div>
          </Card>

          {/* ── 出卷概要 + 開始 CTA（賽前準備就緒區：大題數 + 顯眼開始掣）── */}
          <div className="relative overflow-hidden rounded-3xl border border-accent/30 bg-accent-soft/60 p-4 dark:border-accent/30 dark:bg-accent/10 sm:p-5">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-accent/10 blur-2xl dark:bg-accent/15"
            />
            <div className="relative flex items-center gap-3">
              {/* 大題數（賽前焦點：serif 數字 + 「題」） */}
              <div className="shrink-0 leading-none">
                <span className="text-4xl font-bold tabular-nums text-accent-strong dark:text-accent">
                  {takeCount}
                </span>
                <span className="ml-1 text-sm font-medium text-accent/70 dark:text-accent/70">題</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="accent">{scopeLabel}</Badge>
                  <Badge tone="slate">{DIFF_FILTER_LABEL[settings.difficulty]}</Badge>
                  {settings.mode === 'timed' && (
                    <Badge tone="amber" icon={Timer} className="tabular-nums">
                      {settings.timeLimit} 秒／題
                    </Badge>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
                  符合條件 <span className="font-semibold tabular-nums text-accent-strong dark:text-accent">{matched.length}</span> 題，準備好就開賽。
                </p>
              </div>
            </div>
            {cappedByPool && (
              <p className="relative mt-2 text-xs text-amber-600 dark:text-amber-400">
                呢個範圍題目唔夠 {wantCount} 題，實際出 {takeCount} 題。
              </p>
            )}
            <Button
              size="lg"
              fullWidth
              icon={Play}
              disabled={takeCount === 0}
              onClick={start}
              className="relative mt-3"
            >
              {takeCount === 0 ? '冇符合條件嘅題目' : `開始挑戰 · ${takeCount} 題`}
            </Button>
          </div>
        </section>
      )}

      {/* ── 歷史紀錄（戰績榜）── */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            <Trophy size={14} />
            戰績紀錄
          </h2>
          {historyDesc.length > 0 && (
            <Badge tone="slate" className="tabular-nums">{historyDesc.length}</Badge>
          )}
        </div>
        {historyDesc.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="仲未有測驗紀錄"
            hint="完成第一次自測之後，每次成績都會喺呢度，方便你重溫同重做錯題。"
          />
        ) : (
          <ul className="space-y-2.5">
            {historyDesc.map((a) => {
              const p = pct(a.correctCount, a.total)
              const isTimed = a.title.includes('搶分')
              return (
                <Card key={a.id} hover padded>
                  <div className="flex items-start gap-3">
                    {/* 命中率環形數字（左側錨點，建立節奏） */}
                    <div
                      className={cx(
                        'flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl text-base font-bold tabular-nums',
                        p >= 80
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
                          : p >= 50
                            ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300'
                            : 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
                      )}
                    >
                      {p}
                      <span className="text-[9px] font-medium opacity-70">%</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {a.title}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                        {formatDateTime(a.createdAt)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge tone={scoreTone(p)}>
                          <span className="tabular-nums">{a.correctCount}/{a.total}</span> 答啱
                        </Badge>
                        <Badge tone="slate" icon={Timer}>
                          <span className="tabular-nums">{fmtDuration(a.durationSec)}</span>
                        </Badge>
                        {isTimed && <Badge tone="accent" icon={Trophy}>搶分</Badge>}
                        <Badge tone={a.mode === 'work' ? 'blue' : 'accent'}>
                          {a.mode === 'work' ? '工作' : '個人'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3 dark:border-slate-700/60">
                    <Button variant="secondary" size="sm" onClick={() => onReview(a.id, settingsFromAttempt(a))}>
                      重溫
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAttempt(a)}
                      className="ml-auto text-slate-400 hover:text-rose-500"
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

// ── 迷你統計（細圖示 chip + 數字，輔助資訊，唔搶主行動）──
type StatTone = 'accent' | 'sky' | 'emerald'
const STAT_CHIP: Record<StatTone, string> = {
  accent: 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
}
function MiniStat({
  label,
  value,
  unit,
  icon: Icon,
  tone,
}: {
  label: string
  value: number | string
  unit?: string
  icon: typeof Play
  tone: StatTone
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-white p-3.5 dark:border-slate-700/60 dark:bg-slate-800">
      <span className={cx('flex h-8 w-8 items-center justify-center rounded-xl', STAT_CHIP[tone])}>
        <Icon size={16} />
      </span>
      <div>
        <p className="flex items-baseline gap-0.5">
          <span className="text-2xl font-bold tabular-nums text-slate-800 dark:text-slate-100">{value}</span>
          {unit && <span className="text-sm font-medium text-slate-400">{unit}</span>}
        </p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500">{label}</p>
      </div>
    </div>
  )
}

// ── 區塊小標題（圖示 + 文字）──
function OptionLabel({ icon: Icon, children }: { icon: typeof Play; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
      <Icon size={13} className="text-slate-400" />
      {children}
    </span>
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
