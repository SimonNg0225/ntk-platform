import { useMemo, useState } from 'react'
import { useCollection } from '../../lib/store'
import { classesCol, topicsCol, progressCol } from '../../data/collections'
import type { ProgressStatus } from '../../data/types'

const STATUS: Record<
  ProgressStatus,
  { label: string; cls: string; dot: string }
> = {
  not_started: {
    label: '未開始',
    cls: 'bg-slate-100 text-slate-500',
    dot: 'bg-slate-300',
  },
  in_progress: {
    label: '進行中',
    cls: 'bg-amber-100 text-amber-700',
    dot: 'bg-amber-400',
  },
  done: {
    label: '完成',
    cls: 'bg-accent-soft text-accent-strong',
    dot: 'bg-accent',
  },
}

const NEXT: Record<ProgressStatus, ProgressStatus> = {
  not_started: 'in_progress',
  in_progress: 'done',
  done: 'not_started',
}

export default function CurriculumProgress() {
  const classes = useCollection(classesCol)
  const topics = useCollection(topicsCol)
  const progress = useCollection(progressCol)
  const [classId, setClassId] = useState<string>(classes[0]?.id ?? '')

  // 確保揀緊嘅班別有效
  const activeClass = classes.find((c) => c.id === classId) ?? classes[0]

  const statusOf = (topicId: string): ProgressStatus => {
    if (!activeClass) return 'not_started'
    return (
      progress.find((p) => p.classId === activeClass.id && p.topicId === topicId)
        ?.status ?? 'not_started'
    )
  }

  const cycle = (topicId: string) => {
    if (!activeClass) return
    const rec = progress.find(
      (p) => p.classId === activeClass.id && p.topicId === topicId,
    )
    const next = NEXT[rec?.status ?? 'not_started']
    if (rec) {
      progressCol.update(rec.id, {
        status: next,
        dateDone: next === 'done' ? new Date().toISOString() : undefined,
      })
    } else {
      progressCol.add({
        classId: activeClass.id,
        topicId,
        status: next,
        dateDone: next === 'done' ? new Date().toISOString() : undefined,
      })
    }
  }

  // 按 部分 → 範疇 分組
  const grouped = useMemo(() => {
    const sorted = [...topics].sort((a, b) => a.order - b.order)
    const parts: { part: string; areas: { area: string; items: typeof topics }[] }[] = []
    for (const tp of sorted) {
      let part = parts.find((p) => p.part === tp.part)
      if (!part) {
        part = { part: tp.part, areas: [] }
        parts.push(part)
      }
      let area = part.areas.find((a) => a.area === tp.area)
      if (!area) {
        area = { area: tp.area, items: [] }
        part.areas.push(area)
      }
      area.items.push(tp)
    }
    return parts
  }, [topics])

  const doneCount = activeClass
    ? topics.filter((t) => statusOf(t.id) === 'done').length
    : 0
  const pct = topics.length ? Math.round((doneCount / topics.length) * 100) : 0

  if (classes.length === 0) {
    return (
      <p className="rounded-xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-400">
        仲未有班別。先去「班別管理」新增班別，再返嚟標記課程進度。
      </p>
    )
  }

  return (
    <div className="space-y-5">
      {/* 班別選擇 */}
      <div className="flex flex-wrap gap-2">
        {classes.map((c) => {
          const active = c.id === activeClass?.id
          return (
            <button
              key={c.id}
              onClick={() => setClassId(c.id)}
              className={
                active
                  ? 'rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-white'
                  : 'rounded-full bg-slate-100 px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200'
              }
            >
              {c.name}
            </button>
          )
        })}
      </div>

      {/* 總進度 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">
            {activeClass?.name} 整體進度
          </span>
          <span className="text-sm font-bold text-accent">
            {doneCount}/{topics.length}（{pct}%）
          </span>
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-400">
          撳課題右邊嘅狀態掣可以循環：未開始 → 進行中 → 完成
        </p>
      </div>

      {/* 課題列表 */}
      <div className="space-y-5">
        {grouped.map((part) => (
          <div key={part.part}>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              {part.part}
            </h3>
            <div className="space-y-3">
              {part.areas.map((area) => {
                const total = area.items.length
                const done = area.items.filter(
                  (t) => statusOf(t.id) === 'done',
                ).length
                return (
                  <div
                    key={area.area}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                  >
                    <div className="flex items-center justify-between bg-slate-50 px-4 py-2">
                      <span className="text-sm font-semibold text-slate-700">
                        {area.area}
                      </span>
                      <span className="text-xs text-slate-400">
                        {done}/{total}
                      </span>
                    </div>
                    <ul className="divide-y divide-slate-100">
                      {area.items.map((tp) => {
                        const st = statusOf(tp.id)
                        const cfg = STATUS[st]
                        return (
                          <li
                            key={tp.id}
                            className="flex items-center justify-between gap-3 px-4 py-2.5"
                          >
                            <span className="flex items-center gap-2 text-sm text-slate-700">
                              <span
                                className={`h-2 w-2 shrink-0 rounded-full ${cfg.dot}`}
                              />
                              {tp.topic}
                            </span>
                            <button
                              onClick={() => cycle(tp.id)}
                              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition ${cfg.cls}`}
                            >
                              {cfg.label}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
