import { useMemo, useState } from 'react'
import { useCollection } from '../../lib/store'
import { useToast } from '../../context/ToastContext'
import { classesCol, topicsCol, progressCol } from '../../data/collections'
import type { ProgressStatus } from '../../data/types'
import {
  Badge,
  Card,
  EmptyState,
  IconButton,
  Pills,
  ProgressBar,
  SectionTitle,
  StatCard,
} from '../../ui'

type BadgeTone = 'slate' | 'amber' | 'green'

const STATUS: Record<
  ProgressStatus,
  { label: string; tone: BadgeTone; dot: string }
> = {
  not_started: { label: '未開始', tone: 'slate', dot: 'bg-slate-300' },
  in_progress: { label: '進行中', tone: 'amber', dot: 'bg-amber-400' },
  done: { label: '完成', tone: 'green', dot: 'bg-emerald-500' },
}

const NEXT: Record<ProgressStatus, ProgressStatus> = {
  not_started: 'in_progress',
  in_progress: 'done',
  done: 'not_started',
}

function fmtDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export default function CurriculumProgress() {
  const toast = useToast()
  const classes = useCollection(classesCol)
  const topics = useCollection(topicsCol)
  const progress = useCollection(progressCol)
  const [classId, setClassId] = useState<string>(classes[0]?.id ?? '')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  // 確保揀緊嘅班別有效
  const activeClass = classes.find((c) => c.id === classId) ?? classes[0]

  const recordOf = (topicId: string) =>
    activeClass
      ? progress.find(
          (p) => p.classId === activeClass.id && p.topicId === topicId,
        )
      : undefined

  const statusOf = (topicId: string): ProgressStatus =>
    recordOf(topicId)?.status ?? 'not_started'

  const cycle = (topicId: string) => {
    if (!activeClass) return
    const rec = recordOf(topicId)
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
    // 小提升：當呢一下令全部課題完成，畀個鼓勵 toast（其餘狀態更新唔嘈）
    if (next === 'done' && topics.length > 0) {
      const doneAfter = topics.filter((t) =>
        t.id === topicId ? true : statusOf(t.id) === 'done',
      ).length
      if (doneAfter === topics.length) {
        toast.success(`${activeClass.name} 已完成全部課題 🎉`)
      }
    }
  }

  // 按 部分 → 範疇 分組
  const grouped = useMemo(() => {
    const sorted = [...topics].sort((a, b) => a.order - b.order)
    const parts: {
      part: string
      areas: { area: string; items: typeof topics }[]
    }[] = []
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

  // 統計
  const doneCount = activeClass
    ? topics.filter((t) => statusOf(t.id) === 'done').length
    : 0
  const inProgressCount = activeClass
    ? topics.filter((t) => statusOf(t.id) === 'in_progress').length
    : 0
  const pct = topics.length ? Math.round((doneCount / topics.length) * 100) : 0

  const allCollapsed = grouped.length > 0 && grouped.every((p) => collapsed[p.part])
  const toggleAll = () => {
    if (allCollapsed) {
      setCollapsed({})
    } else {
      const next: Record<string, boolean> = {}
      for (const p of grouped) next[p.part] = true
      setCollapsed(next)
    }
  }
  const togglePart = (part: string) =>
    setCollapsed((prev) => ({ ...prev, [part]: !prev[part] }))

  if (classes.length === 0) {
    return (
      <EmptyState
        icon="🏫"
        title="仲未有班別"
        hint="先去「班別管理」新增班別，再返嚟標記課程進度。"
      />
    )
  }

  return (
    <div className="space-y-5">
      {/* 班別選擇 */}
      <Pills
        options={classes.map((c) => ({ id: c.id, label: c.name }))}
        active={activeClass?.id ?? ''}
        onChange={setClassId}
      />

      {/* 頂部統計 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="總課題" value={topics.length} unit="個" icon="📚" />
        <StatCard label="已完成" value={doneCount} unit="個" icon="✅" />
        <StatCard label="進行中" value={inProgressCount} unit="個" icon="⏳" />
        <StatCard label="完成度" value={pct} unit="%" icon="🎯" highlight />
      </div>

      {/* 整體進度 */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {activeClass?.name} 整體進度
          </span>
          <span className="text-sm font-bold text-accent-strong">
            {doneCount}/{topics.length}（{pct}%）
          </span>
        </div>
        <ProgressBar value={pct} className="mt-2" />
        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
          撳課題右邊嘅狀態掣可以循環：未開始 → 進行中 → 完成
        </p>
      </Card>

      {/* 課題列表 */}
      <div>
        <SectionTitle
          right={
            grouped.length > 0 ? (
              <button
                onClick={toggleAll}
                className="text-xs font-medium text-accent-strong hover:underline"
              >
                {allCollapsed ? '全部展開' : '全部收起'}
              </button>
            ) : undefined
          }
        >
          課題清單
        </SectionTitle>

        {grouped.length === 0 ? (
          <EmptyState
            icon="📝"
            title="仲未有課題"
            hint="課題資料載入後會喺度顯示。"
          />
        ) : (
          <div className="space-y-4">
            {grouped.map((part) => {
              const isCollapsed = !!collapsed[part.part]
              const partItems = part.areas.flatMap((a) => a.items)
              const partDone = partItems.filter(
                (t) => statusOf(t.id) === 'done',
              ).length
              return (
                <div key={part.part}>
                  <button
                    onClick={() => togglePart(part.part)}
                    className="flex w-full items-center justify-between gap-2 py-1.5"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        {part.part}
                      </span>
                      <Badge tone="slate">
                        {partDone}/{partItems.length}
                      </Badge>
                    </span>
                    <IconButton
                      label={isCollapsed ? '展開' : '收起'}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        className={`transition-transform ${
                          isCollapsed ? '' : 'rotate-180'
                        }`}
                      >
                        <path
                          d="M6 9l6 6 6-6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </IconButton>
                  </button>

                  {!isCollapsed && (
                    <div className="mt-2 space-y-3">
                      {part.areas.map((area) => {
                        const total = area.items.length
                        const done = area.items.filter(
                          (t) => statusOf(t.id) === 'done',
                        ).length
                        const areaPct = total
                          ? Math.round((done / total) * 100)
                          : 0
                        return (
                          <Card key={area.area} className="overflow-hidden">
                            <div className="bg-slate-50 px-4 py-2.5 dark:bg-slate-800/50">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                  {area.area}
                                </span>
                                <span className="shrink-0 text-xs font-medium text-slate-400 dark:text-slate-500">
                                  {done}/{total}
                                </span>
                              </div>
                              <ProgressBar
                                value={areaPct}
                                className="mt-2 h-1.5"
                              />
                            </div>
                            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                              {area.items.map((tp) => {
                                const rec = recordOf(tp.id)
                                const st = rec?.status ?? 'not_started'
                                const cfg = STATUS[st]
                                const dateLabel =
                                  st === 'done' ? fmtDate(rec?.dateDone) : ''
                                return (
                                  <li
                                    key={tp.id}
                                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                                  >
                                    <span className="flex min-w-0 items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                                      <span
                                        className={`h-2 w-2 shrink-0 rounded-full ${cfg.dot}`}
                                      />
                                      <span className="truncate">
                                        {tp.topic}
                                      </span>
                                      {dateLabel && (
                                        <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
                                          ✓ {dateLabel}
                                        </span>
                                      )}
                                    </span>
                                    <button
                                      onClick={() => cycle(tp.id)}
                                      className="shrink-0"
                                      aria-label={`切換狀態：${cfg.label}`}
                                    >
                                      <Badge tone={cfg.tone}>{cfg.label}</Badge>
                                    </button>
                                  </li>
                                )
                              })}
                            </ul>
                          </Card>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
