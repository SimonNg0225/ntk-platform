import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Button,
  Field,
  IconButton,
  Input,
  Modal,
  ProgressBar,
  Select,
  Textarea,
  Tooltip,
  cx,
} from '../../../ui'
import {
  GripVertical,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Clock,
  GraduationCap,
  NotebookPen,
  ListChecks,
  PackageOpen,
  CalendarDays,
  X,
} from 'lucide-react'
import type { Klass, LessonPlan, Topic } from '../../../data/types'
import { useToast } from '../../../context/ToastContext'
import {
  PHASE_PRESETS,
  STATUS_META,
  STATUS_ORDER,
  makeMaterial,
  makePhase,
  totalPhaseMinutes,
  type LessonPhase,
  type MaterialItem,
  type PlanMeta,
  type PlanStatus,
  type PlanTemplate,
} from './util'

// ============================================================
//  教案編輯器 — 完整備課表（目標 / 環節時間軸 / 教材清單 / 狀態）
//  喺呢度只負責「收集 draft」並交返 onSubmit；持久化由父層處理。
// ============================================================

export interface PlanDraft {
  title: string
  classId: string
  topicId: string
  date: string
  objectives: string
  resourcesNote: string
  // meta
  status: PlanStatus
  period: string // 文字輸入，提交時轉 number
  taughtDate: string
  phases: LessonPhase[]
  materials: MaterialItem[]
  reflection: string
}

export const emptyDraft: PlanDraft = {
  title: '',
  classId: '',
  topicId: '',
  date: '',
  objectives: '',
  resourcesNote: '',
  status: 'draft',
  period: '',
  taughtDate: '',
  phases: [],
  materials: [],
  reflection: '',
}

export function planToDraft(p: LessonPlan, meta: PlanMeta | undefined): PlanDraft {
  return {
    title: p.title,
    classId: p.classId ?? '',
    topicId: p.topicId ?? '',
    date: p.date ?? '',
    objectives: p.objectives ?? '',
    resourcesNote: p.resourcesNote ?? '',
    status: meta?.status ?? 'draft',
    period: meta?.period != null ? String(meta.period) : '',
    taughtDate: meta?.taughtDate ?? '',
    phases: meta?.phases?.map((x) => ({ ...x })) ?? [],
    materials: meta?.materials?.map((x) => ({ ...x })) ?? [],
    reflection: meta?.reflection ?? '',
  }
}

export function fmtMin(min: number): string {
  if (min < 60) return `${min} 分鐘`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} 小時 ${m} 分` : `${h} 小時`
}

export default function PlanEditor({
  open,
  mode,
  initial,
  classes,
  topics,
  templates,
  onClose,
  onSubmit,
  onSaveAsTemplate,
}: {
  open: boolean
  mode: 'create' | 'edit'
  initial: PlanDraft
  classes: Klass[]
  topics: Topic[]
  templates: PlanTemplate[]
  onClose: () => void
  onSubmit: (draft: PlanDraft) => void
  onSaveAsTemplate: (draft: PlanDraft) => void
}) {
  const toast = useToast()
  const [d, setD] = useState<PlanDraft>(initial)
  const [tab, setTab] = useState<'basic' | 'flow' | 'materials'>('basic')

  // 每次開新 modal 同步 initial
  useEffect(() => {
    if (open) {
      setD(initial)
      setTab('basic')
    }
  }, [open, initial])

  const set = <K extends keyof PlanDraft>(k: K, v: PlanDraft[K]) =>
    setD((s) => ({ ...s, [k]: v }))

  const totalMin = useMemo(() => totalPhaseMinutes(d.phases), [d.phases])

  // ── 環節操作 ──
  const addPhase = () => set('phases', [...d.phases, makePhase('', 10)])
  const updPhase = (id: string, patch: Partial<LessonPhase>) =>
    set(
      'phases',
      d.phases.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    )
  const delPhase = (id: string) =>
    set(
      'phases',
      d.phases.filter((p) => p.id !== id),
    )
  const movePhase = (id: string, dir: -1 | 1) => {
    const idx = d.phases.findIndex((p) => p.id === id)
    const next = idx + dir
    if (idx < 0 || next < 0 || next >= d.phases.length) return
    const arr = [...d.phases]
    ;[arr[idx], arr[next]] = [arr[next], arr[idx]]
    set('phases', arr)
  }
  const fillPreset = () => {
    set(
      'phases',
      PHASE_PRESETS.map((p) => makePhase(p.label, p.minutes)),
    )
    toast.success('已套用三段式範本')
  }

  // ── 教材操作 ──
  const addMaterial = () => set('materials', [...d.materials, makeMaterial('')])
  const updMaterial = (id: string, patch: Partial<MaterialItem>) =>
    set(
      'materials',
      d.materials.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    )
  const delMaterial = (id: string) =>
    set(
      'materials',
      d.materials.filter((m) => m.id !== id),
    )

  // ── 套用範本 ──
  const applyTemplate = (id: string) => {
    if (!id) return
    const tpl = templates.find((t) => t.id === id)
    if (!tpl) return
    setD((s) => ({
      ...s,
      objectives: s.objectives.trim() ? s.objectives : tpl.objectives,
      phases: tpl.phases.map((p) => makePhase(p.label, p.minutes)),
      materials: tpl.materials.map((m) => makeMaterial(m.text)),
    }))
    toast.success(`已套用範本「${tpl.name}」`)
    setTab('flow')
  }

  const canSubmit = d.title.trim().length > 0
  const matDone = d.materials.filter((m) => m.done).length

  // ── masthead 即時情境（粉筆寫喺黑板上嘅課堂頭）──
  const className = classes.find((c) => c.id === d.classId)?.name
  const topicName = topics.find((t) => t.id === d.topicId)?.topic
  const dateLabel = d.date
    ? new Date(d.date + 'T00:00:00').toLocaleDateString('zh-HK', {
        month: 'short',
        day: 'numeric',
        weekday: 'short',
      })
    : ''
  const sMeta = STATUS_META[d.status]

  // ── 章節（黑板上嘅分欄；用返同一個 tab state）──
  const SECTIONS: {
    id: typeof tab
    label: string
    hint: string
    icon: typeof NotebookPen
    count?: number
  }[] = [
    { id: 'basic', label: '課堂概要', hint: '標題 · 班別 · 目標', icon: NotebookPen },
    {
      id: 'flow',
      label: '課堂節奏',
      hint: '教學環節時間軸',
      icon: ListChecks,
      count: d.phases.length || undefined,
    },
    {
      id: 'materials',
      label: '備課清單',
      hint: '教材 · 課後反思',
      icon: PackageOpen,
      count: d.materials.length || undefined,
    },
  ]

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      footer={
        <>
          <div className="mr-auto flex items-center gap-2">
            {mode === 'edit' && (
              <Tooltip label="將呢個教案嘅環節 / 教材存成可重用範本">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Sparkles}
                  onClick={() => onSaveAsTemplate(d)}
                  disabled={!d.phases.length && !d.materials.length}
                >
                  存為範本
                </Button>
              </Tooltip>
            )}
          </div>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button icon={Save} onClick={() => onSubmit(d)} disabled={!canSubmit}>
            {mode === 'edit' ? '儲存' : '加入'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* ───────── 黑板課堂頭：粉筆 serif 標題 + 即時情境 ───────── */}
        <div className="relative -mx-5 -mt-5 overflow-hidden border-b border-slate-700/60 bg-slate-800 px-5 pb-4 pt-5 text-slate-100 dark:bg-slate-900 sm:-mx-6 sm:-mt-6 sm:px-6">
          {/* 暖光暈（呼應主畫面黑板暖感） */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full bg-accent/20 blur-3xl"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-16 -left-8 h-36 w-36 rounded-full bg-amber-400/10 blur-3xl"
          />
          {/* 自家關閉鍵（Modal 唔再畫 header；Esc / focus-trap 照常） */}
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉"
            className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <X size={18} />
          </button>

          <div className="relative flex items-start gap-3 pr-9">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white shadow-inner ring-1 ring-inset ring-white/15 backdrop-blur-sm">
              <GraduationCap size={22} strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-accent-soft/90">
                {mode === 'edit' ? '修訂備課' : '課堂備課表'}
              </p>
              <h2 className="mt-0.5 truncate text-[22px] font-semibold leading-tight tracking-tight text-white sm:text-2xl">
                {d.title.trim() || (mode === 'edit' ? '編輯教案' : '新增教案')}
              </h2>
              {/* 粉筆情境行：班別 · 課題 · 日期 · 時長 */}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-300/90">
                <span className="inline-flex items-center gap-1 font-medium text-accent-soft">
                  <span
                    aria-hidden="true"
                    className={cx(
                      'h-1.5 w-1.5 rounded-full',
                      d.status === 'taught'
                        ? 'bg-emerald-400'
                        : d.status === 'ready'
                          ? 'bg-amber-400'
                          : 'bg-slate-400',
                    )}
                  />
                  {sMeta.label}
                </span>
                {className && (
                  <>
                    <Sep />
                    <span>{className}</span>
                  </>
                )}
                {topicName && (
                  <>
                    <Sep />
                    <span className="truncate">{topicName}</span>
                  </>
                )}
                {dateLabel && (
                  <>
                    <Sep />
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <CalendarDays size={12} />
                      {dateLabel}
                    </span>
                  </>
                )}
                {totalMin > 0 && (
                  <>
                    <Sep />
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Clock size={12} />
                      {fmtMin(totalMin)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 黑板分欄：粉筆 section-tabs（白堊底線標示當前欄）*/}
          <div
            role="tablist"
            aria-label="教案編輯分欄"
            className="relative mt-4 flex gap-1 border-t border-white/10 pt-2"
          >
            {SECTIONS.map((s) => {
              const on = tab === s.id
              const SIcon = s.icon
              return (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setTab(s.id)}
                  className={cx(
                    'group relative -mb-px flex items-center gap-1.5 rounded-t-lg px-2.5 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:px-3',
                    on ? 'text-white' : 'text-slate-400 hover:text-slate-200',
                  )}
                >
                  <SIcon size={15} strokeWidth={on ? 2 : 1.75} className="shrink-0" />
                  <span className="text-[13px] font-semibold">{s.label}</span>
                  {typeof s.count === 'number' && (
                    <span
                      className={cx(
                        'rounded-full px-1.5 text-[10px] font-semibold tabular-nums',
                        on
                          ? 'bg-white/20 text-white'
                          : 'bg-white/10 text-slate-300',
                      )}
                    >
                      {s.count}
                    </span>
                  )}
                  {/* 粉筆底線（當前欄）*/}
                  <span
                    aria-hidden="true"
                    className={cx(
                      'absolute inset-x-1.5 -bottom-px h-0.5 rounded-full transition-opacity',
                      on
                        ? 'bg-gradient-to-r from-accent-soft/40 via-white to-accent-soft/40 opacity-100'
                        : 'bg-white/40 opacity-0 group-hover:opacity-40',
                    )}
                  />
                </button>
              )
            })}
          </div>
        </div>

        {/* 當前欄副題（粉筆刻度導引）*/}
        <p className="-mt-1 flex items-center gap-1.5 px-0.5 text-xs text-slate-400 dark:text-slate-500">
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
            ✎
          </span>
          {SECTIONS.find((s) => s.id === tab)?.hint}
        </p>

        {/* ─────── 課堂概要 ─────── */}
        {tab === 'basic' && (
          <div className="space-y-4">
            <Field label="教案標題" required>
              <Input
                value={d.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="如：香港營商環境導論"
                autoFocus
              />
            </Field>

            {templates.length > 0 && mode === 'create' && (
              <Field
                label="由範本開始（選填）"
                hint="套用後可再修改；唔會覆蓋已填嘅標題"
              >
                <Select defaultValue="" onChange={(e) => applyTemplate(e.target.value)}>
                  <option value="">不使用範本</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            {/* 歸檔資料卡（hairline · 紙質，呼應教案卡）*/}
            <section className="space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3.5 dark:border-slate-700/60 dark:bg-slate-800/40">
              <SectionHeading
                kicker="Filing"
                title="歸檔與排程"
                icon={CalendarDays}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="班別">
                  <Select
                    value={d.classId}
                    onChange={(e) => set('classId', e.target.value)}
                  >
                    <option value="">未指定</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="課題">
                  <Select
                    value={d.topicId}
                    onChange={(e) => set('topicId', e.target.value)}
                  >
                    <option value="">未指定</option>
                    {topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.topic}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="授課日期">
                  <Input
                    type="date"
                    value={d.date}
                    onChange={(e) => set('date', e.target.value)}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="狀態">
                  <Select
                    value={d.status}
                    onChange={(e) => set('status', e.target.value as PlanStatus)}
                  >
                    {STATUS_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_META[s].label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="第幾節（配合時間表）">
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={d.period}
                    onChange={(e) => set('period', e.target.value)}
                    placeholder="如 3"
                  />
                </Field>
              </div>

              {d.status === 'taught' && (
                <Field label="實際授課日">
                  <Input
                    type="date"
                    value={d.taughtDate}
                    onChange={(e) => set('taughtDate', e.target.value)}
                  />
                </Field>
              )}
            </section>

            {/* 教學目標（serif 引導）*/}
            <div className="space-y-2.5">
              <SectionHeading
                kicker="Objectives"
                title="教學目標"
                icon={NotebookPen}
              />
              <Field hint="逐行寫，列印時會原樣保留換行">
                <Textarea
                  value={d.objectives}
                  onChange={(e) => set('objectives', e.target.value)}
                  placeholder={'1. 學生能…\n2. 學生能…'}
                  rows={4}
                />
              </Field>
            </div>
          </div>
        )}

        {/* ─────── 教學流程（環節時間軸）─────── */}
        {tab === 'flow' && (
          <div className="space-y-3">
            <SectionHeading
              kicker="Lesson flow"
              title="課堂節奏"
              icon={ListChecks}
              trailing={
                <span
                  className={cx(
                    'inline-flex items-center gap-1 text-xs tabular-nums',
                    totalMin > 0
                      ? 'font-semibold text-accent-strong dark:text-accent'
                      : 'text-slate-400 dark:text-slate-500',
                  )}
                >
                  <Clock size={13} />
                  {fmtMin(totalMin)}
                </span>
              }
            />

            {d.phases.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-9 text-center dark:border-slate-700 dark:bg-slate-800/40">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                  <Clock size={20} strokeWidth={1.75} />
                </span>
                <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">
                  鋪排返堂課嘅節奏
                </p>
                <p className="mt-1 max-w-xs text-xs text-slate-400 dark:text-slate-500">
                  撳「套用三段式」即刻有引入、講解、活動框架，或自行逐個環節加。
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={Sparkles}
                  onClick={fillPreset}
                  className="mt-4"
                >
                  套用三段式
                </Button>
              </div>
            ) : (
              <ul className="space-y-2">
                {d.phases.map((p, i) => {
                  const pct = totalMin ? ((Number(p.minutes) || 0) / totalMin) * 100 : 0
                  return (
                    <li
                      key={p.id}
                      className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-3 pl-4 transition-colors hover:border-slate-300 dark:border-slate-700/60 dark:bg-slate-800/60 dark:hover:border-slate-600"
                    >
                      {/* 環節色脊（粉筆刻度，呼應教案卡書脊）*/}
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-accent/50 dark:bg-accent/40"
                      />
                      <div className="flex items-start gap-2">
                        {/* 環節序號 + 排序握把（白堊節數）*/}
                        <div className="flex flex-col items-center gap-1 pt-0.5">
                          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold tabular-nums text-slate-500 ring-1 ring-inset ring-slate-200/80 dark:bg-slate-700/70 dark:text-slate-300 dark:ring-slate-600/60">
                            {i + 1}
                          </span>
                          <button
                            type="button"
                            aria-label="上移環節"
                            onClick={() => movePhase(p.id, -1)}
                            disabled={i === 0}
                            className="text-slate-300 transition hover:text-accent disabled:opacity-25 dark:text-slate-600"
                          >
                            <GripVertical size={14} />
                          </button>
                        </div>
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex gap-2">
                            <Input
                              value={p.label}
                              onChange={(e) =>
                                updPhase(p.id, { label: e.target.value })
                              }
                              placeholder="環節名稱（如：引入）"
                              className="min-w-0 flex-1"
                            />
                            <div className="relative w-16 shrink-0">
                              <Input
                                type="number"
                                min={0}
                                max={300}
                                value={String(p.minutes)}
                                onChange={(e) =>
                                  updPhase(p.id, {
                                    minutes: Math.max(
                                      0,
                                      Number(e.target.value) || 0,
                                    ),
                                  })
                                }
                                className="pr-7 text-right"
                              />
                              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                                分
                              </span>
                            </div>
                            <IconButton
                              label="刪除環節"
                              tone="danger"
                              onClick={() => delPhase(p.id)}
                            >
                              <Trash2 size={16} strokeWidth={1.8} />
                            </IconButton>
                          </div>
                          <Textarea
                            value={p.detail}
                            onChange={(e) =>
                              updPhase(p.id, { detail: e.target.value })
                            }
                            placeholder="活動內容、提問、分組安排…"
                            rows={2}
                            className="min-h-[44px] text-xs"
                          />
                          {/* 時間佔比迷你條 */}
                          <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                            <div
                              className="h-full rounded-full bg-accent/70 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            <Button
              variant="secondary"
              size="sm"
              icon={Plus}
              onClick={addPhase}
              fullWidth
            >
              新增環節
            </Button>
          </div>
        )}

        {/* ─────── 備課清單 ─────── */}
        {tab === 'materials' && (
          <div className="space-y-3">
            <SectionHeading
              kicker="Prep checklist"
              title="備課清單"
              icon={PackageOpen}
              trailing={
                d.materials.length > 0 ? (
                  <span className="text-xs tabular-nums text-slate-400 dark:text-slate-500">
                    {matDone}/{d.materials.length} 已備妥
                  </span>
                ) : undefined
              }
            />

            {d.materials.length > 0 && (
              <ProgressBar
                value={
                  d.materials.length ? (matDone / d.materials.length) * 100 : 0
                }
                size="sm"
                tone={matDone === d.materials.length ? 'green' : 'accent'}
              />
            )}

            {d.materials.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-9 text-center dark:border-slate-700 dark:bg-slate-800/40">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                  <PackageOpen size={20} strokeWidth={1.75} />
                </span>
                <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">
                  列齊上堂要用嘅嘢
                </p>
                <p className="mt-1 max-w-xs text-xs text-slate-400 dark:text-slate-500">
                  簡報、工作紙、影片連結都寫低；準備好就剔一剔，一眼睇晒進度。
                </p>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {d.materials.map((m) => (
                  <li key={m.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={m.done}
                      aria-label={m.text}
                      onClick={() => updMaterial(m.id, { done: !m.done })}
                      className={cx(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
                        m.done
                          ? 'border-accent bg-accent text-white'
                          : 'border-slate-300 bg-white hover:border-accent dark:border-slate-600 dark:bg-slate-800',
                      )}
                    >
                      {m.done && (
                        <svg viewBox="0 0 20 20" className="h-3 w-3" fill="currentColor">
                          <path d="M16.7 5.3a1 1 0 010 1.4l-7 7a1 1 0 01-1.4 0l-3-3a1 1 0 011.4-1.4l2.3 2.3 6.3-6.3a1 1 0 011.4 0z" />
                        </svg>
                      )}
                    </button>
                    <Input
                      value={m.text}
                      onChange={(e) => updMaterial(m.id, { text: e.target.value })}
                      aria-label="教材名稱"
                      placeholder="如：第 3 章工作紙"
                      className={cx(
                        'flex-1',
                        m.done && 'text-slate-400 line-through dark:text-slate-500',
                      )}
                    />
                    <IconButton
                      label="刪除教材"
                      tone="danger"
                      onClick={() => delMaterial(m.id)}
                    >
                      <Trash2 size={16} strokeWidth={1.8} />
                    </IconButton>
                  </li>
                ))}
              </ul>
            )}

            <Button
              variant="secondary"
              size="sm"
              icon={Plus}
              onClick={addMaterial}
              fullWidth
            >
              新增教材
            </Button>

            {/* 課後反思（serif 引導，呼應反思隨筆）*/}
            <div className="space-y-2.5 pt-1">
              <SectionHeading
                kicker="Reflection"
                title="課後反思"
                icon={NotebookPen}
              />
              <Field hint="教完後記低成效、學生反應、可改善處（選填）">
                <Textarea
                  value={d.reflection}
                  onChange={(e) => set('reflection', e.target.value)}
                  placeholder="今堂…"
                  rows={3}
                />
              </Field>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ───────── 黑板情境行分隔點（粉筆灰）─────────
function Sep() {
  return (
    <span aria-hidden="true" className="text-slate-600">
      ·
    </span>
  )
}

// ───────── 章節標題（serif + uppercase kicker，呼應教案卡）─────────
function SectionHeading({
  kicker,
  title,
  icon: I,
  trailing,
}: {
  kicker: string
  title: string
  icon: typeof NotebookPen
  trailing?: ReactNode
}) {
  return (
    <div className="flex items-end justify-between gap-2 border-b border-dashed border-slate-200/80 pb-2 dark:border-slate-700/60">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
          <I size={12} className="text-accent/70" />
          {kicker}
        </p>
        <h3 className="mt-0.5 text-[15px] font-semibold tracking-tight text-slate-800 dark:text-slate-100">
          {title}
        </h3>
      </div>
      {trailing}
    </div>
  )
}
