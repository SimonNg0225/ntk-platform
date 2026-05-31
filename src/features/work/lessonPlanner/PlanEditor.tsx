import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Field,
  IconButton,
  Input,
  Modal,
  Pills,
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

function fmtMin(min: number): string {
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={mode === 'edit' ? '編輯教案' : '新增教案'}
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
        {/* 分頁 */}
        <Pills
          options={[
            { id: 'basic', label: '基本資料' },
            { id: 'flow', label: '教學流程' },
            { id: 'materials', label: '教材清單' },
          ]}
          active={tab}
          onChange={setTab}
          size="sm"
          counts={{
            flow: d.phases.length || undefined,
            materials: d.materials.length || undefined,
          }}
        />

        {/* ─────── 基本資料 ─────── */}
        {tab === 'basic' && (
          <div className="space-y-3">
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

            <Field label="教學目標" hint="逐行寫，列印時會原樣保留換行">
              <Textarea
                value={d.objectives}
                onChange={(e) => set('objectives', e.target.value)}
                placeholder={'1. 學生能…\n2. 學生能…'}
                rows={4}
              />
            </Field>
          </div>
        )}

        {/* ─────── 教學流程（環節時間軸）─────── */}
        {tab === 'flow' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300">
                <Clock size={15} className="text-slate-400" />
                課堂總時長
                <span
                  className={cx(
                    'tabular-nums',
                    totalMin > 0
                      ? 'text-accent-strong dark:text-accent'
                      : 'text-slate-400',
                  )}
                >
                  {fmtMin(totalMin)}
                </span>
              </div>
              {d.phases.length === 0 && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={Sparkles}
                  onClick={fillPreset}
                >
                  套用三段式
                </Button>
              )}
            </div>

            {d.phases.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-500">
                仲未有教學環節。撳「套用三段式」快速開始，或自行新增。
              </div>
            ) : (
              <ul className="space-y-2">
                {d.phases.map((p, i) => {
                  const pct = totalMin ? ((Number(p.minutes) || 0) / totalMin) * 100 : 0
                  return (
                    <li
                      key={p.id}
                      className="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800/60"
                    >
                      <div className="flex items-start gap-2">
                        {/* 排序握把 */}
                        <div className="flex flex-col items-center pt-1">
                          <button
                            type="button"
                            aria-label="上移"
                            onClick={() => movePhase(p.id, -1)}
                            disabled={i === 0}
                            className="text-slate-300 transition hover:text-accent disabled:opacity-30 dark:text-slate-600"
                          >
                            <GripVertical size={14} />
                          </button>
                          <span className="text-[10px] font-semibold tabular-nums text-slate-400">
                            {i + 1}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex gap-2">
                            <Input
                              value={p.label}
                              onChange={(e) =>
                                updPhase(p.id, { label: e.target.value })
                              }
                              placeholder="環節名稱（如：引入）"
                              className="flex-1"
                            />
                            <div className="relative w-24 shrink-0">
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
                                className="pr-9 text-right"
                              />
                              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
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

        {/* ─────── 教材清單 ─────── */}
        {tab === 'materials' && (
          <div className="space-y-3">
            {d.materials.length > 0 && (
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>備課準備進度</span>
                <span className="tabular-nums">
                  {matDone}/{d.materials.length} 已備妥
                </span>
              </div>
            )}

            {d.materials.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-500">
                列出簡報、工作紙、影片連結等。剔咗 = 已準備好。
              </div>
            ) : (
              <ul className="space-y-1.5">
                {d.materials.map((m) => (
                  <li key={m.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={m.done}
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

            <Field label="課後反思（選填）" hint="教完後記低成效、學生反應、可改善處">
              <Textarea
                value={d.reflection}
                onChange={(e) => set('reflection', e.target.value)}
                placeholder="今堂…"
                rows={3}
              />
            </Field>
          </div>
        )}
      </div>
    </Modal>
  )
}
