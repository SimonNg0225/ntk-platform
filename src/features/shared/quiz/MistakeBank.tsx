import { useMemo, useState } from 'react'
import { useCollection } from '../../../lib/store'
import { useToast } from '../../../context/ToastContext'
import { useConfirm } from '../../../context/ConfirmContext'
import { questionsCol, topicsCol } from '../../../data/collections'
import {
  CheckCircle2,
  Eraser,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Target,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Pills,
  StatCard,
  cx,
} from '../../../ui'
import {
  DIFF_LABEL,
  DIFF_TONE,
  formatDateTime,
  mistakesCol,
  type MistakeEntry,
} from './util'

// ============================================================
//  MistakeBank — 錯題本（跨次彙整，可標記掌握 / 一鍵練錯題）
// ============================================================

type FilterId = 'active' | 'mastered' | 'all'
const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'active', label: '待克服' },
  { id: 'mastered', label: '已掌握' },
  { id: 'all', label: '全部' },
]

export function MistakeBank({ onPractice }: { onPractice: (questionIds: string[]) => void }) {
  const mistakes = useCollection(mistakesCol)
  const topics = useCollection(topicsCol)
  const questions = useCollection(questionsCol)
  const toast = useToast()
  const confirm = useConfirm()

  const topicName = (id: string) => topics.find((t) => t.id === id)?.topic ?? '未分類'
  const existingIds = useMemo(() => new Set(questions.map((q) => q.id)), [questions])

  const [filter, setFilter] = useState<FilterId>('active')
  const [kw, setKw] = useState('')

  const active = mistakes.filter((m) => !m.mastered)
  const mastered = mistakes.filter((m) => m.mastered)

  const filtered = useMemo(() => {
    const base =
      filter === 'active' ? active : filter === 'mastered' ? mastered : mistakes
    const q = kw.trim().toLowerCase()
    const list = q
      ? base.filter(
          (m) => m.stem.toLowerCase().includes(q) || topicName(m.topicId).toLowerCase().includes(q),
        )
      : base
    // 排序：答錯次數多 → 最近答錯
    return [...list].sort((a, b) => {
      if (b.wrongCount !== a.wrongCount) return b.wrongCount - a.wrongCount
      return a.lastWrongAt < b.lastWrongAt ? 1 : -1
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, kw, mistakes])

  // 可練（待克服 + 仍存在於題庫）
  const practiceableIds = useMemo(
    () => active.filter((m) => existingIds.has(m.questionId)).map((m) => m.questionId),
    [active, existingIds],
  )

  const markMastered = (m: MistakeEntry) => {
    mistakesCol.update(m.id, { mastered: true, masteredAt: new Date().toISOString(), wrongCount: 0 })
    toast.success('已標記為掌握')
  }
  const restore = (m: MistakeEntry) => {
    mistakesCol.update(m.id, { mastered: false, masteredAt: undefined, wrongCount: Math.max(1, m.wrongCount) })
  }
  const removeOne = (m: MistakeEntry) => {
    mistakesCol.remove(m.id)
  }
  const clearMastered = async () => {
    if (mastered.length === 0) return
    const ok = await confirm({
      title: '清走已掌握題目？',
      message: `會由錯題本移除 ${mastered.length} 條已掌握嘅題目（唔影響題庫）。`,
      confirmText: '清走',
      tone: 'danger',
    })
    if (!ok) return
    for (const m of mastered) mistakesCol.remove(m.id)
    toast.success(`已清走 ${mastered.length} 條`)
  }

  if (mistakes.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title="錯題本係空嘅，好嘢！"
        hint="做測驗時答錯嘅題目會自動收集喺呢度，方便集中操練同追蹤掌握進度。"
      />
    )
  }

  return (
    <div className="animate-fade-in space-y-4">
      {/* 概覽 */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="待克服" value={active.length} unit="題" icon={Target} highlight />
        <StatCard label="已掌握" value={mastered.length} unit="題" icon={CheckCircle2} />
        <StatCard
          label="累計答錯"
          value={mistakes.reduce((s, m) => s + m.wrongCount, 0)}
          unit="次"
          icon={RotateCcw}
        />
      </div>

      {/* 一鍵練錯題（雪恥區：accent-soft 強調，呼應開賽 CTA） */}
      <div className="flex flex-col gap-3 rounded-3xl border border-accent/30 bg-accent-soft/60 p-4 dark:border-accent/30 dark:bg-accent/10 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-white shadow-sm shadow-accent/30">
            <Target size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">集中操練錯題</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              抽起所有「待克服」題目即場再做，連續答啱兩次就自動標記掌握。
            </p>
          </div>
        </div>
        <Button
          icon={Play}
          disabled={practiceableIds.length === 0}
          onClick={() => onPractice(practiceableIds)}
          className="shrink-0"
        >
          <span className="tabular-nums">練錯題（{practiceableIds.length}）</span>
        </Button>
      </div>

      {/* 篩選 + 搜尋 */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Pills
          options={FILTERS}
          active={filter}
          onChange={(v) => setFilter(v as FilterId)}
          counts={{ active: active.length, mastered: mastered.length, all: mistakes.length }}
        />
        <div className="flex items-center gap-2">
          <Input
            icon={Search}
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            placeholder="搜尋題目 / 課題…"
            className="sm:w-56"
          />
          {filter === 'mastered' && mastered.length > 0 && (
            <Button variant="ghost" size="sm" icon={Eraser} onClick={clearMastered} className="hover:text-rose-500">
              清走
            </Button>
          )}
        </div>
      </div>

      {/* 列表 */}
      {filtered.length === 0 ? (
        <EmptyState icon={Search} title="無符合嘅題目" hint="試吓換個篩選或關鍵字。" />
      ) : (
        <ul className="space-y-2" aria-live="polite">
          {filtered.map((m) => {
            const gone = !existingIds.has(m.questionId)
            return (
              <Card key={m.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge tone="accent">{topicName(m.topicId)}</Badge>
                      <Badge tone={DIFF_TONE[m.difficulty]}>{DIFF_LABEL[m.difficulty]}</Badge>
                      {m.mastered ? (
                        <Badge tone="green" icon={CheckCircle2}>已掌握</Badge>
                      ) : (
                        <Badge tone="rose">
                          答錯 <span className="tabular-nums">{m.wrongCount}</span> 次
                        </Badge>
                      )}
                      {gone && <Badge tone="slate">已從題庫移除</Badge>}
                    </div>
                    <p
                      className={cx(
                        'line-clamp-2 text-sm font-medium text-slate-800 dark:text-slate-100',
                        m.mastered && 'text-slate-500 line-through dark:text-slate-400',
                      )}
                    >
                      {m.stem}
                    </p>
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      {m.mastered && m.masteredAt
                        ? `掌握於 ${formatDateTime(m.masteredAt)}`
                        : `最近答錯 ${formatDateTime(m.lastWrongAt)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    {!m.mastered ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Play}
                          disabled={gone}
                          onClick={() => onPractice([m.questionId])}
                        >
                          再做
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={CheckCircle2}
                          onClick={() => markMastered(m)}
                          className="hover:text-emerald-600"
                        >
                          已識
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => restore(m)}>
                          還原
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Eraser}
                          onClick={() => removeOne(m)}
                          className="hover:text-rose-500"
                        >
                          移除
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </ul>
      )}
    </div>
  )
}
