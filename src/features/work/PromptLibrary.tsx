import { useMemo, useState } from 'react'
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  ClipboardList,
  FileText,
  Mail,
  MessageSquare,
  Presentation,
  Scale,
  Search,
  Send,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useMode } from '../../context/ModeContext'
import { useNav } from '../../context/NavContext'
import { useToast } from '../../context/ToastContext'
import { writeAiHandoff } from '../shared/aiAssistant/handoff'
import PageHero from '../../ui/PageHero'
import { Button, Input, cx } from '../../ui'
import { track } from '../../lib/observability'

type PromptAgent = {
  id: string
  task: string
  name: string
  specialty: string
  portrait: string
  icon: LucideIcon
  tags: string[]
  starter: string
  bestFor: string
  prompt: string
  privacySensitive?: boolean
}

const PROMPT_AGENTS: PromptAgent[] = [
  {
    id: 'email-reply',
    task: '回覆一封電郵',
    name: '電郵回覆助理',
    specialty: '家長 / 同事 / 學校電郵',
    portrait: '/assets/prompt-agents/editorial/email-reply.png',
    icon: Mail,
    tags: ['行政', '溝通'],
    starter: '貼上對方電郵、你的立場、希望語氣。',
    bestFor: '回覆家長查詢、活動通知、同事協調、禮貌拒絕。',
    prompt: `你現在是一位香港學校電郵回覆助理，專長是替老師草擬清晰、禮貌、穩陣的回覆。

請根據以下資料撰寫回覆：
- 收件人身份：
- 對方原文 / 背景：
- 我想表達的重點：
- 語氣：專業、親切、簡潔
- 需要避免的內容：

請輸出：
1. 電郵標題
2. 中文正式版
3. 較短 WhatsApp / Teams 版本
4. 如有風險，列出需要老師確認的地方`,
  },
  {
    id: 'lesson-plan',
    task: '準備下一堂課',
    name: '教案準備師',
    specialty: '一堂課由目標到活動',
    portrait: '/assets/prompt-agents/editorial/lesson-plan.png',
    icon: ClipboardList,
    tags: ['備課', '課堂'],
    starter: '輸入課題、年級、課時、學生能力。',
    bestFor: '快速整理教學目標、流程、活動和延伸練習。',
    prompt: `你現在是一位香港中學教案準備師，專長是把一個課題整理成可直接上課的教案。

請根據以下資料設計一堂課：
- 科目 / 課題：
- 年級 / 程度：
- 課時：
- 學生已有知識：
- 課堂限制：

請輸出：
1. 教學目標（知識、技能、態度）
2. 5 分鐘導入活動
3. 主體教學流程（按分鐘列出）
4. 互動活動 / 提問
5. 常見誤解及處理方法
6. 課堂總結
7. 家課 / 延伸任務`,
  },
  {
    id: 'worksheet-maker',
    task: '製作工作紙或小測',
    name: '練習設計師',
    specialty: '工作紙 / 小測 / 分層題目',
    portrait: '/assets/prompt-agents/editorial/worksheet-maker.png',
    icon: FileText,
    tags: ['出題', '練習'],
    starter: '給課題、題型、題數、難度比例。',
    bestFor: '生成由易到難的工作紙、小測和延伸挑戰。',
    prompt: `你現在是一位練習設計師，專長是替老師設計清晰、有梯度、可直接使用的題目。

請根據以下要求出題：
- 科目 / 課題：
- 年級：
- 題型：
- 題數：
- 難度比例：基礎 / 中等 / 挑戰
- 需要包含的概念：
- 不要包含的內容：

請輸出：
1. 題目清單（按難度分組）
2. 參考答案
3. 評分要點
4. 常見錯誤提示
5. 可加深題一條`,
  },
  {
    id: 'rubric-feedback',
    task: '寫評語與評分準則',
    name: '評分與評語助理',
    specialty: 'Rubric / 批改評語 / 改善建議',
    portrait: '/assets/prompt-agents/editorial/rubric-feedback.png',
    icon: Scale,
    tags: ['批改', '評語'],
    starter: '貼題目、學生答案或表現描述。',
    bestFor: '把批改變成具體、可跟進的回饋。',
    privacySensitive: true,
    prompt: `你現在是一位評分與評語助理，專長是把老師的判斷整理成清晰評分準則和改善建議。

請根據以下資料協助評分：
- 題目 / 任務：
- 滿分：
- 學生答案 / 表現：
- 老師初步判斷：
- 想保持的語氣：

請輸出：
1. 建議分數及理由
2. 分項評分準則
3. 學生做得好的地方
4. 需要改善的地方
5. 一段可直接貼給學生的評語
6. 下一步練習建議`,
  },
  {
    id: 'slide-architect',
    task: '整理簡報大綱',
    name: '簡報架構師',
    specialty: 'PowerPoint 大綱 / 頁面安排',
    portrait: '/assets/prompt-agents/editorial/slide-architect.png',
    icon: Presentation,
    tags: ['簡報', '教材'],
    starter: '輸入課題、時間、重點和想要的風格。',
    bestFor: '由零散內容變成一份有節奏的簡報大綱。',
    prompt: `你現在是一位教學簡報架構師，專長是把課題拆成適合投影片呈現的教學節奏。

請根據以下資料設計簡報：
- 課題：
- 年級 / 程度：
- 簡報用途：
- 預計頁數：
- 必須包含的重點：
- 想要風格：

請輸出：
1. 每頁投影片標題
2. 每頁 3-5 個要點
3. 建議圖像 / 圖表 / 例子
4. 老師講解提示
5. 課堂互動位`,
  },
  {
    id: 'activity-designer',
    task: '設計課堂活動',
    name: '課堂活動設計師',
    specialty: '討論 / 小組 / Exit Ticket',
    portrait: '/assets/prompt-agents/editorial/activity-designer.png',
    icon: Users,
    tags: ['活動', '互動'],
    starter: '提供課題、班級氣氛、時間和活動限制。',
    bestFor: '把沉悶內容轉成可操作的課堂活動。',
    prompt: `你現在是一位課堂活動設計師，專長是設計低準備成本、高參與度的教學活動。

請根據以下資料設計活動：
- 課題：
- 年級 / 班級特性：
- 活動時間：
- 班房資源：
- 老師希望達成的學習成果：

請輸出：
1. 活動名稱
2. 老師準備材料
3. 活動流程
4. 學生指示文字
5. 分組 / 個人調整方法
6. Exit Ticket 題目
7. 如何評估活動成效`,
  },
  {
    id: 'differentiation-coach',
    task: '安排分層學習',
    name: '分層支援教練',
    specialty: '照顧學習差異',
    portrait: '/assets/prompt-agents/editorial/differentiation-coach.png',
    icon: BookOpenCheck,
    tags: ['分層', '支援'],
    starter: '描述班內學生程度差異和任務要求。',
    bestFor: '同一課題設計基礎、標準、挑戰三層支援。',
    prompt: `你現在是一位分層支援教練，專長是幫老師照顧學習差異，而不增加太多備課負擔。

請根據以下資料設計分層安排：
- 課題：
- 學生能力分佈：
- 主要任務：
- 常見困難：
- 可用時間：

請輸出：
1. 基礎組支援
2. 標準組任務
3. 挑戰組延伸
4. 老師巡堂提示
5. 學生自選難度的說明文字
6. 不同層次的成功準則`,
  },
  {
    id: 'parent-communication',
    task: '準備家長溝通',
    name: '家長溝通顧問',
    specialty: '學生表現 / 跟進訊息',
    portrait: '/assets/prompt-agents/editorial/parent-communication.png',
    icon: MessageSquare,
    tags: ['家長', '班務'],
    starter: '輸入學生情況、事實、想達成的下一步。',
    bestFor: '處理敏感訊息時保持中性、具體、可跟進。',
    privacySensitive: true,
    prompt: `你現在是一位家長溝通顧問，專長是把學生情況轉化成中性、具體、可合作的溝通文字。

請根據以下資料草擬訊息：
- 學生情況 / 事件：
- 已觀察到的事實：
- 老師已做的支援：
- 希望家長配合的地方：
- 語氣：尊重、具體、不標籤學生

請輸出：
1. WhatsApp 短訊版
2. 電郵正式版
3. 電話溝通提綱
4. 需要避免的措辭
5. 可跟進日期 / 下一步`,
  },
  {
    id: 'admin-docs',
    task: '整理行政文件',
    name: '行政文件整理員',
    specialty: '通告 / 會議 / 報告摘要',
    portrait: '/assets/prompt-agents/editorial/admin-docs.png',
    icon: FileText,
    tags: ['行政', '摘要'],
    starter: '貼上文件、會議紀錄或零散要點。',
    bestFor: '快速抽重點、待辦、風險和可直接發出的版本。',
    prompt: `你現在是一位行政文件整理員，專長是把零散資料整理成老師可即時使用的摘要和待辦。

請整理以下內容：
- 文件 / 會議內容：
- 截止日期：
- 涉及對象：
- 老師需要完成的事項：

請輸出：
1. 100 字摘要
2. 重要日期 / 截止時間
3. 待辦清單
4. 需要回覆 / 確認的人
5. 潛在風險或漏項
6. 可直接轉發的簡短版本`,
  },
  {
    id: 'data-reflection',
    task: '分析成績與弱項',
    name: '成績反思分析師',
    specialty: '測考數據 / 弱項 / 跟進分組',
    portrait: '/assets/prompt-agents/editorial/data-reflection.png',
    icon: BarChart3,
    tags: ['成績', '跟進'],
    starter: '貼上分數、題目表現或班級觀察。',
    bestFor: '由測考結果推導下一步教學跟進。',
    privacySensitive: true,
    prompt: `你現在是一位成績反思分析師，專長是協助老師由測考表現找出教學跟進方向。

請根據以下資料分析：
- 班級 / 年級：
- 測考主題：
- 分數或題目表現：
- 老師觀察：
- 想跟進的時間：

請輸出：
1. 班級整體表現摘要
2. 主要弱項
3. 可能原因
4. 建議分組跟進
5. 下一堂課重教安排
6. 3 條針對性練習題方向`,
  },
]

const COMMON_AGENT_IDS = [
  'lesson-plan',
  'worksheet-maker',
  'rubric-feedback',
  'email-reply',
] as const

export default function PromptLibrary() {
  const { mode } = useMode()
  const nav = useNav()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)

  const commonAgents = useMemo(
    () =>
      COMMON_AGENT_IDS.map((id) => PROMPT_AGENTS.find((agent) => agent.id === id)).filter(
        (agent): agent is PromptAgent => Boolean(agent),
      ),
    [],
  )

  const visibleAgents = useMemo(() => {
    if (!showAll) return commonAgents
    const q = query.trim().toLowerCase()
    if (!q) return PROMPT_AGENTS
    return PROMPT_AGENTS.filter((agent) =>
      [agent.task, agent.name, agent.specialty, agent.starter, agent.bestFor, ...agent.tags]
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [commonAgents, query, showAll])

  function openInAi(agent: PromptAgent) {
    writeAiHandoff(mode, '', {
      assistant: {
        id: agent.id,
        name: agent.name,
        task: agent.task,
        summary: agent.bestFor,
        starter: agent.starter,
        instruction: `${agent.prompt}\n\n【對話方式】這是背景工作指示，不要向用戶展示、複述或要求用戶編輯這段文字。先根據用戶提供的資料工作；資料不足時，一次只追問最重要的 1 至 3 項。輸出應可直接使用，並清楚標出仍需老師確認的地方。`,
        privacyNote: agent.privacySensitive
          ? '請用學生代號取代姓名，避免輸入可識別的個人資料。'
          : undefined,
      },
    })
    track('teaching_assistant_selected', {
      assistant_id: agent.id,
      assistant_task: agent.task,
      privacy_sensitive: Boolean(agent.privacySensitive),
    })
    nav.open(mode === 'work' ? 'work-ai' : 'learning-ai')
    toast.success(`已開始：${agent.task}`)
  }

  return (
    <div className="space-y-6">
      <PageHero
        icon={Users}
        kicker="日常教學任務"
        title="教學助手"
        description="選擇你要完成的工作，系統會直接開啟對話並準備好所需資料。"
        actions={
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setShowAll((value) => !value)
              setQuery('')
            }}
          >
            {showAll ? '返回常用任務' : '全部助手'}
          </Button>
        }
      />

      <section aria-labelledby="assistant-tasks-title" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-accent">
              {showAll ? '十位助手' : '最常使用'}
            </p>
            <h2
              id="assistant-tasks-title"
              className="mt-1 text-xl font-semibold text-slate-950 dark:text-slate-100"
            >
              {showAll ? '全部助手' : '你想先完成甚麼？'}
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
              {showAll
                ? '按任務搜尋；人物只作識別，成果格式已預先設定。'
                : '四個常用入口，一按便開始，不用先研究提示詞。'}
            </p>
          </div>

          {showAll && (
            <div className="w-full sm:max-w-sm">
              <Input
                icon={Search}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜尋電郵、教案、評語、家長..."
                aria-label="搜尋教學助手"
              />
            </div>
          )}
        </div>

        {visibleAgents.length > 0 ? (
          <div className="overflow-hidden rounded-[16px] bg-white shadow-xs dark:bg-slate-900">
            <div className="grid sm:grid-cols-2 sm:divide-x sm:divide-slate-100 dark:sm:divide-slate-800">
              {visibleAgents.map((agent, index) => (
                <TaskRow
                  key={agent.id}
                  agent={agent}
                  onStart={() => openInAi(agent)}
                  className={cx(
                    index >= 2 && 'border-t border-slate-100 dark:border-slate-800',
                    index === 1 && 'border-t border-slate-100 sm:border-t-0 dark:border-slate-800',
                  )}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="border-y border-slate-200 py-10 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
            找不到相關助手。試試搜尋「備課」、「行政」、「家長」或「成績」。
          </div>
        )}

        {!showAll && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="group flex min-h-11 items-center gap-2 text-sm font-semibold text-accent-strong transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:text-accent"
          >
            查看全部 10 位助手
            <ArrowRight size={16} className="transition group-hover:translate-x-0.5" />
          </button>
        )}
      </section>
    </div>
  )
}

function TaskRow({
  agent,
  onStart,
  className,
}: {
  agent: PromptAgent
  onStart: () => void
  className?: string
}) {
  const Icon = agent.icon

  return (
    <button
      type="button"
      onClick={onStart}
      aria-label={`${agent.task}，由${agent.name}開始`}
      className={cx(
        'group flex min-h-[138px] w-full cursor-pointer items-center gap-4 p-4 text-left transition duration-150 hover:bg-slate-50 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40 active:bg-slate-100 dark:hover:bg-slate-800/70 dark:active:bg-slate-800',
        className,
      )}
    >
      <img
        src={agent.portrait}
        alt=""
        loading="lazy"
        className="h-[72px] w-[72px] shrink-0 rounded-[14px] bg-slate-100 object-cover object-center dark:bg-slate-800"
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          <Icon size={14} strokeWidth={1.8} className="text-accent" />
          {agent.name}
        </span>
        <span className="mt-1.5 block text-base font-semibold text-slate-950 dark:text-slate-100">
          {agent.task}
        </span>
        <span className="mt-1 line-clamp-2 block text-xs leading-5 text-slate-500 dark:text-slate-400">
          {agent.bestFor}
        </span>
      </span>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition group-hover:bg-accent group-hover:text-white dark:bg-slate-800 dark:text-slate-400">
        <Send size={16} strokeWidth={1.8} />
      </span>
    </button>
  )
}
