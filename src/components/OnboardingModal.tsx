import { useState } from 'react'
import {
  ArrowRight,
  BarChart3,
  ClipboardList,
  Database,
  FileText,
  Files,
  type LucideIcon,
} from 'lucide-react'
import { Modal } from '../ui'
import { SUBJECT_PACKS } from '../data/subjects'
import { useSettings } from '../context/SettingsContext'
import { loadTopicsForSubjects } from '../features/work/topicImport/applyTopics'
import type { ComposerMaterialTool } from '../features/shared/composerHandoff'

export interface OnboardingStart {
  taskId: StartTaskId
  featureId: string
  prompt?: string
  materialTool?: ComposerMaterialTool
  hasSubject: boolean
  hasTopic: boolean
}

type StartTaskId = 'lesson' | 'worksheet' | 'grades' | 'admin'

type StartTask = {
  id: StartTaskId
  title: string
  outcome: string
  icon: LucideIcon
  featureId: string
  materialTool?: ComposerMaterialTool
}

const START_TASKS: StartTask[] = [
  {
    id: 'lesson',
    title: '建立課堂套裝',
    outcome: '教案、工作紙和簡報',
    icon: ClipboardList,
    featureId: 'work-classroom-pack',
  },
  {
    id: 'worksheet',
    title: '出工作紙 / 小測',
    outcome: '題目、答案和評分準則',
    icon: FileText,
    featureId: 'work-generate',
    materialTool: 'worksheet',
  },
  {
    id: 'grades',
    title: '分析成績',
    outcome: '弱項、預測和跟進',
    icon: BarChart3,
    featureId: 'work-grade-analytics',
  },
  {
    id: 'admin',
    title: '整理行政文件',
    outcome: '摘要、重點和待辦',
    icon: Files,
    featureId: 'work-doc-digest',
  },
]

function promptFor(task: StartTaskId, topic: string): string | undefined {
  const subject = topic.trim() || '下一個課題'
  if (task === 'lesson') {
    return `為「${subject}」建立課堂套裝，包括教案、工作紙及簡報`
  }
  if (task === 'worksheet') {
    return `生成一份「${subject}」工作紙，連答案和評分準則`
  }
  if (task === 'grades') return '分析今次測驗成績、預測等級和找出弱項'
  return '把這份行政文件摘要成重點和待辦'
}

export function OnboardingModal({
  open,
  onClose,
  onLoadDemo,
  onStart,
}: {
  open: boolean
  onClose: () => void
  onLoadDemo: () => void
  onStart: (task: OnboardingStart) => void
}) {
  const { subjectPackId, setSubjectPackId } = useSettings()
  const [subject, setSubject] = useState(subjectPackId)
  const [topic, setTopic] = useState('')
  const [taskId, setTaskId] = useState<StartTaskId>('lesson')

  const start = () => {
    const task = START_TASKS.find((item) => item.id === taskId) ?? START_TASKS[0]
    setSubjectPackId(subject)
    if (subject) loadTopicsForSubjects([subject])
    try {
      const value = topic.trim()
      if (value) localStorage.setItem('eziteach.nextLessonTopic', value)
    } catch {
      /* ignore */
    }
    onStart({
      taskId: task.id,
      featureId: task.featureId,
      prompt: promptFor(task.id, topic),
      materialTool: task.materialTool,
      hasSubject: Boolean(subject),
      hasTopic: Boolean(topic.trim()),
    })
  }

  return (
    <Modal open={open} onClose={onClose} title="設定你的教學工作台" size="lg">
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            先完成今晚最急的一件事
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-slate-600 dark:text-slate-300">
            告訴我任教科目和課題，EziTeach 會直接打開最合適的工作區。
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
              任教科目
            </span>
            <select
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="">稍後設定</option>
              {SUBJECT_PACKS.filter((pack) => pack.id !== 'custom').map((pack) => (
                <option key={pack.id} value={pack.id}>
                  {pack.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
              今晚的課題
            </span>
            <input
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') start()
              }}
              placeholder="例如：百分比應用"
              className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-accent/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
        </div>

        <fieldset>
          <legend className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            你想先完成什麼？
          </legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {START_TASKS.map((task) => {
              const Icon = task.icon
              const selected = task.id === taskId
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => setTaskId(task.id)}
                  aria-pressed={selected}
                  className={`flex min-h-[72px] items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                    selected
                      ? 'border-accent bg-accent-soft/70 text-accent-strong dark:bg-accent/15 dark:text-accent'
                      : 'border-slate-200 bg-white text-slate-800 hover:border-accent/35 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
                  }`}
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${selected ? 'bg-accent text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}>
                    <Icon size={18} strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{task.title}</span>
                    <span className={`mt-0.5 block text-xs ${selected ? 'text-accent-strong/75 dark:text-accent/80' : 'text-slate-500 dark:text-slate-400'}`}>
                      {task.outcome}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onLoadDemo}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <Database size={16} strokeWidth={1.8} />
            載入試用資料
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 flex-1 rounded-lg px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:text-slate-300 dark:hover:bg-slate-800 sm:flex-none"
            >
              先看看工作台
            </button>
            <button
              type="button"
              onClick={start}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-5 text-sm font-semibold text-white transition hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 sm:flex-none"
            >
              開始準備
              <ArrowRight size={16} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
