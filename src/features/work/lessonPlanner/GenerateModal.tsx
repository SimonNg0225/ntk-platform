import { useMemo, useState } from 'react'
import { Sparkles, Wand2, FileText } from 'lucide-react'
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
import { generateLesson, type LessonGen, type GenSkeleton } from './lessonAi'
import { templatesForSubject, type BuiltinLessonTemplate } from './subjectTemplates'

// ============================================================
//  AI 教案生成 Modal —— 揀課題 + 簡填今日內容（可選範本骨架）→ AI 出教案
//  ------------------------------------------------------------
//  成功後 onGenerated 將結果 + 課題/班別交返 LessonPlanner，預填編輯器。
// ============================================================

const MODEL_OPTS: { id: AIModel; label: string }[] = [
  { id: 'gemini-2.5-flash', label: 'Flash' },
  { id: 'gemini-2.5-pro', label: 'Pro' },
]
const DURATION_OPTS = [35, 40, 45, 55, 70, 80]

export interface GeneratedLesson {
  gen: LessonGen
  topic: Topic
  classId: string
  /** 用咗邊個範本（顯示用，可選） */
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
  // 課題按科目分組（老師可同時載入多科 → 用 optgroup 分區，唔好一鋪過撈埋）
  const topicGroups = useMemo(() => groupTopicsBySubject(topics), [topics])

  const [topicId, setTopicId] = useState(topics[0]?.id ?? '')
  const [brief, setBrief] = useState('')
  const [classId, setClassId] = useState('')
  const [durationMin, setDurationMin] = useState(55)
  const [model, setModel] = useState<AIModel>(defaultModel)
  const [tplId, setTplId] = useState('') // '' = 唔用範本骨架
  const [busy, setBusy] = useState(false)

  const topic = topics.find((t) => t.id === topicId)
  const tpl: BuiltinLessonTemplate | undefined = builtinTemplates.find((t) => t.id === tplId)

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
      title="AI 整教案"
      size="lg"
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button icon={Sparkles} onClick={run} loading={busy} disabled={!topic}>
            {busy ? '生成緊…' : '生成教案'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] text-slate-500 dark:text-slate-400">
            揀課題、簡單寫低今日想教咩，AI 幫你出一份完整教案（學習目標、分段時間、活動、教材），出咗仲可以逐項改。
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
                未有課題 —— 去「課程進度」加課題，或喺設定揀任教科目。
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
                  'rounded-lg border px-2.5 py-1 text-xs font-medium transition active:scale-[0.97]',
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

        {/* 範本骨架（可選）—— 跟科目 */}
        <Field
          label={
            subjectName ? `範本骨架（選填 · ${subjectName}）` : '範本骨架（選填）'
          }
          hint="揀一個範本，AI 會跟住佢嘅分段結構填內容；唔揀就由 AI 自由設計。"
        >
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setTplId('')}
              aria-pressed={tplId === ''}
              className={cx(
                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition active:scale-[0.97]',
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
                  'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition active:scale-[0.97]',
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
