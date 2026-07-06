import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getFeature } from '../features/registry'
import { FeatureIcon } from '../features/featureIcons'
import type { ModeId } from '../modes/modes'
import { featDesc, featName } from '../i18n/appEn'
import { cx } from '../ui'

type Step = {
  id: string
  label?: string
  desc?: string
}

type Flow = {
  title: string
  hint: string
  steps: Step[]
}

const WORK_FLOWS: Record<string, Flow> = {
  'work-lesson-plan': {
    title: '把教案變成可上堂材料',
    hint: '下一步通常是補教學指引、出練習，或者做簡報。',
    steps: [
      { id: 'work-teach-guide', desc: '補教學重點與常見誤解' },
      { id: 'work-generate', desc: '生成工作紙、小測或試卷' },
      { id: 'work-slides', desc: '整理成 PowerPoint 初稿' },
    ],
  },
  'work-teach-guide': {
    title: '由教學指引接到課堂產出',
    hint: '把重點轉成教案、教材或公開試風格操練。',
    steps: [
      { id: 'work-lesson-plan', desc: '寫成完整教案' },
      { id: 'work-generate', desc: '生成練習與題目' },
      { id: 'work-dse', desc: '轉成 DSE 操練' },
    ],
  },
  'work-generate': {
    title: '把教材放入可重用流程',
    hint: '生成後最有價值是存題、補評分準則，再回到備課。',
    steps: [
      { id: 'work-questions', desc: '管理與重用題目' },
      { id: 'work-rubric', desc: '補答案與評分準則' },
      { id: 'work-lesson-plan', desc: '放回下一堂課' },
    ],
  },
  'work-questions': {
    title: '由題庫繼續出卷與評核',
    hint: '把題目變成練習、試卷或評分材料。',
    steps: [
      { id: 'work-generate', desc: '用 AI 補題或組卷' },
      { id: 'work-rubric', desc: '生成評分準則' },
      { id: 'work-dse', desc: '做公開試操練' },
    ],
  },
  'work-rubric': {
    title: '把評分準則接到跟進',
    hint: '評分準則完成後，可回到題目、生成補充練習，或落待辦。',
    steps: [
      { id: 'work-generate', desc: '補充練習與答案' },
      { id: 'work-questions', desc: '回到題庫整理' },
      { id: 'work-tasks', desc: '記低批改與跟進' },
    ],
  },
  'work-slides': {
    title: '把簡報接回教學流程',
    hint: '簡報是課堂的一部分，可接回教案和教材。',
    steps: [
      { id: 'work-lesson-plan', desc: '配合教案流程' },
      { id: 'work-generate', desc: '生成課堂練習' },
      { id: 'work-resources', desc: '存入教學資源庫' },
    ],
  },
  'work-doc-digest': {
    title: '文件讀完後要變成行動',
    hint: '把行政文件變成待辦、會議記錄或可查資料。',
    steps: [
      { id: 'work-tasks', desc: '轉成待辦和跟進' },
      { id: 'work-meeting-notes', desc: '整理成會議記錄' },
      { id: 'ask-data', label: '問資料', desc: '用已有資料追問' },
    ],
  },
  'work-transcribe': {
    title: '逐字稿下一步是整理和跟進',
    hint: '錄音轉文字後，可變會議記錄、文件摘要或觀課記錄。',
    steps: [
      { id: 'work-meeting-notes', desc: '生成會議筆記' },
      { id: 'work-doc-digest', desc: '抽重點與待辦' },
      { id: 'work-observation', desc: '做觀課 / 評課撮要' },
    ],
  },
  'work-meeting-notes': {
    title: '會議記錄要落到跟進',
    hint: '把決議轉成待辦，或用 AI 找回舊記錄。',
    steps: [
      { id: 'work-tasks', desc: '轉成跟進清單' },
      { id: 'work-report', desc: '整理入工作週報' },
      { id: 'search', label: '搜尋', desc: '找回相關記錄' },
    ],
  },
  'work-tasks': {
    title: '待辦可以接回教學工作',
    hint: '完成跟進後，繼續備課、整理文件或做週報。',
    steps: [
      { id: 'work-lesson-plan', desc: '處理下一堂課' },
      { id: 'work-doc-digest', desc: '整理行政文件' },
      { id: 'work-report', desc: '輸出工作週報' },
    ],
  },
  'work-resources': {
    title: '資源庫不是終點',
    hint: '找到教材後，可直接做教案、工作紙或簡報。',
    steps: [
      { id: 'work-lesson-plan', desc: '放入教案' },
      { id: 'work-generate', desc: '延伸成工作紙' },
      { id: 'work-slides', desc: '做成簡報' },
    ],
  },
  search: {
    title: '找到資料後繼續處理',
    hint: '搜尋結果應該回到任務，而不是停在清單。',
    steps: [
      { id: 'ask-data', label: '問資料', desc: '用資料回答問題' },
      { id: 'work-lesson-plan', desc: '接回備課' },
      { id: 'work-tasks', desc: '記低下一步' },
    ],
  },
  'ask-data': {
    title: '把回答變成下一個行動',
    hint: '資料 AI 回答後，通常要落待辦、備課或找原始資料。',
    steps: [
      { id: 'work-tasks', desc: '變成跟進清單' },
      { id: 'work-lesson-plan', desc: '接回下一堂課' },
      { id: 'search', label: '搜尋', desc: '找回原始資料' },
    ],
  },
}

const LEARNING_FLOWS: Record<string, Flow> = {
  'learning-ai': {
    title: '把 AI 回答變成學習材料',
    hint: '問完之後，最好落筆記或知識卡。',
    steps: [
      { id: 'learning-notes', desc: '整理成筆記' },
      { id: 'learning-card-generator', desc: '生成知識卡' },
      { id: 'learning-goals', desc: '變成下一步目標' },
    ],
  },
  'learning-notes': {
    title: '筆記下一步是複習',
    hint: '把內容轉成知識卡或目標，形成循環。',
    steps: [
      { id: 'learning-card-generator', desc: '生成知識卡' },
      { id: 'learning-flashcards', desc: '開始複習' },
      { id: 'ask-data', label: '問資料', desc: '追問自己的資料' },
    ],
  },
}

const DEFAULT_WORK_FLOW: Flow = {
  title: '繼續完成教學工作流',
  hint: '把目前成果接到備課、跟進或資料查找。',
  steps: [
    { id: 'work-lesson-plan', desc: '回到備課' },
    { id: 'work-tasks', desc: '記低跟進' },
    { id: 'search', label: '搜尋', desc: '找回資料' },
  ],
}

export default function NextStepsBar({
  activeId,
  mode,
  onOpen,
}: {
  activeId: string
  mode: ModeId
  onOpen: (id: string) => void
}) {
  const { t } = useTranslation()
  const flow =
    mode === 'work'
      ? WORK_FLOWS[activeId] ?? DEFAULT_WORK_FLOW
      : LEARNING_FLOWS[activeId]
  if (!flow) return null

  const steps = flow.steps
    .filter((step) => step.id !== activeId)
    .map((step) => ({ step, feature: getFeature(step.id) }))
    .filter((item): item is { step: Step; feature: NonNullable<ReturnType<typeof getFeature>> } =>
      Boolean(item.feature),
    )
    .slice(0, 3)

  if (steps.length === 0) return null

  return (
    <section className="rounded-[18px] border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase text-accent">
            <CheckCircle2 size={13} strokeWidth={2} />
            Next step
          </p>
          <h2 className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
            {flow.title}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {flow.hint}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 lg:grid-cols-3">
        {steps.map(({ step, feature }, index) => (
          <button
            key={step.id}
            type="button"
            onClick={() => onOpen(step.id)}
            className={cx(
              'group flex min-h-[76px] cursor-pointer items-center gap-3 rounded-[15px] border px-3.5 py-3 text-left transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
              index === 0
                ? 'border-accent/35 bg-accent-soft/70 hover:border-accent/45 dark:bg-accent/15'
                : 'border-slate-200 bg-white hover:border-accent/35 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800',
            )}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white text-accent shadow-xs dark:bg-slate-800">
              <FeatureIcon icon={feature.icon} size={18} strokeWidth={1.8} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                {step.label ?? featName(t, feature)}
              </span>
              <span className="mt-0.5 line-clamp-1 block text-xs text-slate-500 dark:text-slate-400">
                {step.desc ?? featDesc(t, feature)}
              </span>
            </span>
            <ArrowRight
              size={15}
              className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-accent"
            />
          </button>
        ))}
      </div>
    </section>
  )
}
