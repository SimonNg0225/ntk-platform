import { useMemo, useState } from 'react'
import { Check, Info, Sparkles, Wand2, FileText, X } from 'lucide-react'
import {
  Button,
  Field,
  Modal,
  Select,
  Textarea,
  SegmentedControl,
  Tooltip,
  cx,
} from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import type { AIModel } from '../../../lib/aiClient'
import type { Topic } from '../../../data/types'
import { groupTopicsBySubject } from '../../../data/subjects'
import { PEDAGOGY_OPTIONS, generateLesson, type LessonGen, type GenSkeleton } from './lessonAi'
import { templatesForSubject, type BuiltinLessonTemplate } from './subjectTemplates'

// ============================================================
//  AI 教案生成 Modal —— 選擇課題 + 簡填今日內容（可選範本骨架）→ AI 出教案
//  ------------------------------------------------------------
//  成功後 onGenerated 將結果 + 課題/班別交返 LessonPlanner，預填編輯器。
// ============================================================

const MODEL_OPTS: { id: AIModel; label: string }[] = [
  { id: 'gemini-2.5-flash', label: 'Flash' },
  { id: 'gemini-2.5-pro', label: 'Pro' },
]
const DURATION_OPTS = [35, 40, 45, 55, 70, 80]
const MAX_PEDAGOGY = 4

export interface GeneratedLesson {
  gen: LessonGen
  topic: Topic
  classId: string
  /** 用了哪個範本（顯示用，可選） */
  templateName?: string
}

export default function GenerateModal({
  topics,
  classes,
  subjectId,
  subjectName,
  defaultModel,
  onGenerated,
  onClose,
}: {
  topics: Topic[]
  classes: { id: string; name: string }[]
  subjectId?: string
  subjectName?: string
  defaultModel: AIModel
  onGenerated: (r: GeneratedLesson) => void
  onClose: () => void
}) {
  const toast = useToast()
  const builtinTemplates = useMemo(() => templatesForSubject(subjectId), [subjectId])
  // 課題按科目分組（老師可同時載入多科 → 用 optgroup 分區，不要一鋪過撈埋）
  const topicGroups = useMemo(() => groupTopicsBySubject(topics), [topics])

  const [topicId, setTopicId] = useState(topics[0]?.id ?? '')
  const [brief, setBrief] = useState('')
  const [classId, setClassId] = useState('')
  const [durationMin, setDurationMin] = useState(55)
  const [model, setModel] = useState<AIModel>(defaultModel)
  const [tplId, setTplId] = useState('') // '' = 不用範本骨架
  const [pedagogyIds, setPedagogyIds] = useState<string[]>([])
  const [pedagogyHelpId, setPedagogyHelpId] = useState('')
  const [busy, setBusy] = useState(false)

  const topic = topics.find((t) => t.id === topicId)
  const tpl: BuiltinLessonTemplate | undefined = builtinTemplates.find((t) => t.id === tplId)
  const helpOption = PEDAGOGY_OPTIONS.find((o) => o.id === pedagogyHelpId)

  function togglePedagogy(id: string) {
    if (pedagogyIds.includes(id)) {
      setPedagogyIds((prev) => prev.filter((x) => x !== id))
      return
    }
    if (pedagogyIds.length >= MAX_PEDAGOGY) {
      toast.info(`最多選擇 ${MAX_PEDAGOGY} 個教學設計元素，避免教案失焦。`)
      return
    }
    setPedagogyIds((prev) => [...prev, id])
  }

  async function run() {
    if (busy || !topic) return
    setBusy(true)
    try {
      const skeleton: GenSkeleton | undefined = tpl
        ? { name: tpl.name, phases: tpl.phases.map((p) => ({ label: p.label, minutes: p.minutes })) }
        : undefined
      const gen = await generateLesson(
        {
          subjectName,
          topic: topic.topic,
          brief,
          className: classes.find((c) => c.id === classId)?.name,
          durationMin,
          skeleton,
          pedagogyIds,
        },
        model,
      )
      onGenerated({ gen, topic, classId, templateName: tpl?.name })
    } catch (e) {
      toast.error((e as Error).message || 'AI 生成失敗，請再試。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="AI 生成教案"
      size="lg"
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button icon={Sparkles} onClick={run} loading={busy} disabled={!topic}>
            {busy ? '生成中…' : '生成教案'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] text-slate-500 dark:text-slate-400">
            選擇課題、簡單記錄今日想教什麼，再加入合適的教學設計元素，AI 會生成一份可直接修改的完整教案。
          </p>
          <Tooltip label="Flash 快 · Pro 強">
            <SegmentedControl size="sm" options={MODEL_OPTS} value={model} onChange={setModel} />
          </Tooltip>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="課題">
            {topics.length > 0 ? (
              <Select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
                {topicGroups.map((g) => (
                  <optgroup key={g.key} label={g.name}>
                    {g.topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.topic}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            ) : (
              <p className="text-[13px] text-amber-600 dark:text-amber-400">
                未有課題 —— 去「課程進度」加課題，或在設定選擇任教科目。
              </p>
            )}
          </Field>
          <Field label="班別（選填）">
            <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">— 不指定 —</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="今日教學內容 / 活動（簡單寫幾句）">
          <Textarea
            rows={3}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="例：教收入確認五步模型，用零售個案，最後做一份工作紙。"
          />
        </Field>

        <Field label="課堂時長">
          <div className="flex flex-wrap gap-1.5">
            {DURATION_OPTS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setDurationMin(m)}
                aria-pressed={durationMin === m}
                className={cx(
                  'inline-flex min-h-11 items-center rounded-lg border px-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.97]',
                  durationMin === m
                    ? 'border-accent bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent'
                    : 'border-black/[0.08] text-slate-600 hover:bg-black/[0.03] dark:border-white/10 dark:text-slate-300',
                )}
              >
                {m} 分鐘
              </button>
            ))}
          </div>
        </Field>

        <Field
          label={`教學設計元素（選填 · 已選 ${pedagogyIds.length}/${MAX_PEDAGOGY}）`}
          hint={`點選即可；按資訊圖示查看簡短說明；最多選 ${MAX_PEDAGOGY} 個。AI 會把所選元素融入目標、活動和評估。`}
        >
          <div className="flex flex-wrap gap-1.5">
            {PEDAGOGY_OPTIONS.map((o) => {
              const selected = pedagogyIds.includes(o.id)
              const activeHelp = pedagogyHelpId === o.id
              return (
                <div
                  key={o.id}
                  className={cx(
                    'group inline-flex min-h-11 overflow-hidden rounded-full border bg-white text-sm transition dark:bg-slate-900/60',
                    selected
                      ? 'border-accent bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent'
                      : activeHelp
                        ? 'border-accent/45 text-slate-700 dark:border-accent/50 dark:text-slate-200'
                        : 'border-black/[0.08] text-slate-600 hover:border-accent/40 dark:border-white/10 dark:text-slate-300',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => togglePedagogy(o.id)}
                    aria-pressed={selected}
                    className={cx(
                      'inline-flex cursor-pointer items-center gap-1.5 px-3 py-2 text-left text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40',
                      selected ? '' : 'hover:bg-accent-soft/35 dark:hover:bg-accent/10',
                    )}
                  >
                    {selected && <Check size={13} strokeWidth={3} />}
                    <span>{o.shortLabel}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPedagogyHelpId(activeHelp ? '' : o.id)}
                    aria-label={`了解${o.label}`}
                    className={cx(
                      'inline-flex w-10 shrink-0 cursor-pointer items-center justify-center border-l transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40',
                      activeHelp
                        ? 'border-accent/30 bg-accent text-white'
                        : 'border-black/[0.06] text-slate-400 hover:bg-black/[0.03] hover:text-accent-strong dark:border-white/10 dark:text-slate-500 dark:hover:bg-white/5 dark:hover:text-accent',
                    )}
                  >
                    <Info size={13} />
                  </button>
                </div>
              )
            })}
          </div>
          {helpOption && (
            <div className="mt-2 rounded-lg border border-accent/15 bg-accent-soft/35 px-3 py-2.5 text-xs text-slate-700 dark:border-accent/25 dark:bg-accent/10 dark:text-slate-200">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-accent-strong dark:text-accent">
                    {helpOption.label}
                  </p>
                  <p className="mt-1 leading-5 text-slate-600 dark:text-slate-300">
                    {helpOption.description}
                  </p>
                  <p className="mt-1 leading-5 text-slate-600 dark:text-slate-300">
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      課堂用法：
                    </span>
                    {helpOption.classroomUse}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPedagogyHelpId('')}
                  aria-label="關閉教學設計元素說明"
                  className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/70 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:hover:bg-white/10 dark:hover:text-slate-200"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}
        </Field>

        {/* 範本骨架（可選）—— 跟科目 */}
        <Field
          label={
            subjectName ? `範本骨架（選填 · ${subjectName}）` : '範本骨架（選填）'
          }
          hint="選擇一個範本，AI 會沿用其分段結構填入內容；不選擇就由 AI 自由設計。"
        >
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setTplId('')}
              aria-pressed={tplId === ''}
              className={cx(
                'inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.97]',
                tplId === ''
                  ? 'border-accent bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent'
                  : 'border-black/[0.08] text-slate-600 hover:bg-black/[0.03] dark:border-white/10 dark:text-slate-300',
              )}
            >
              <Wand2 size={13} /> AI 自由設計
            </button>
            {builtinTemplates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTplId(t.id)}
                aria-pressed={tplId === t.id}
                title={t.phases.map((p) => `${p.label}(${p.minutes}')`).join(' → ')}
                className={cx(
                  'inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.97]',
                  tplId === t.id
                    ? 'border-accent bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent'
                    : 'border-black/[0.08] text-slate-600 hover:bg-black/[0.03] dark:border-white/10 dark:text-slate-300',
                )}
              >
                <FileText size={13} />
                <span>{t.name}</span>
                <span className="rounded bg-black/[0.06] px-1 text-[10px] text-slate-500 dark:bg-white/10 dark:text-slate-400">
                  {t.style}
                </span>
              </button>
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  )
}
