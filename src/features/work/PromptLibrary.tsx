import { useMemo, useState } from 'react'
import {
  BarChart3,
  BookOpenCheck,
  CheckSquare,
  ClipboardCheck,
  ClipboardList,
  Copy,
  FileText,
  Mail,
  MessageSquare,
  PenLine,
  Presentation,
  Scale,
  Search,
  Send,
  Sparkles,
  Users,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react'
import { useMode } from '../../context/ModeContext'
import { useNav } from '../../context/NavContext'
import { useToast } from '../../context/ToastContext'
import { writeAiHandoff } from '../shared/aiAssistant/handoff'
import PageHero from '../../ui/PageHero'
import { Badge, Button, Card, Input, Textarea, cx } from '../../ui'

type PromptAgent = {
  id: string
  name: string
  specialty: string
  portrait: string
  icon: LucideIcon
  tone: 'accent' | 'green' | 'amber' | 'blue' | 'rose' | 'slate'
  tags: string[]
  starter: string
  bestFor: string
  prompt: string
}

const PROMPT_AGENTS: PromptAgent[] = [
  {
    id: 'email-reply',
    name: '電郵回覆助理',
    specialty: '家長 / 同事 / 學校電郵',
    portrait: '/assets/prompt-agents/email-reply.jpg',
    icon: Mail,
    tone: 'blue',
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
    name: '教案準備師',
    specialty: '一堂課由目標到活動',
    portrait: '/assets/prompt-agents/lesson-plan.jpg',
    icon: ClipboardList,
    tone: 'accent',
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
    name: '練習設計師',
    specialty: '工作紙 / 小測 / 分層題目',
    portrait: '/assets/prompt-agents/worksheet-maker.jpg',
    icon: WandSparkles,
    tone: 'green',
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
    name: '評分與評語助理',
    specialty: 'Rubric / 批改評語 / 改善建議',
    portrait: '/assets/prompt-agents/rubric-feedback.jpg',
    icon: Scale,
    tone: 'amber',
    tags: ['批改', '評語'],
    starter: '貼題目、學生答案或表現描述。',
    bestFor: '把批改變成具體、可跟進的回饋。',
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
    name: '簡報架構師',
    specialty: 'PowerPoint 大綱 / 頁面安排',
    portrait: '/assets/prompt-agents/slide-architect.jpg',
    icon: Presentation,
    tone: 'rose',
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
    name: '課堂活動設計師',
    specialty: '討論 / 小組 / Exit Ticket',
    portrait: '/assets/prompt-agents/activity-designer.jpg',
    icon: Users,
    tone: 'green',
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
    name: '分層支援教練',
    specialty: '照顧學習差異',
    portrait: '/assets/prompt-agents/differentiation-coach.jpg',
    icon: BookOpenCheck,
    tone: 'blue',
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
    name: '家長溝通顧問',
    specialty: '學生表現 / 跟進訊息',
    portrait: '/assets/prompt-agents/parent-communication.jpg',
    icon: MessageSquare,
    tone: 'amber',
    tags: ['家長', '班務'],
    starter: '輸入學生情況、事實、想達成的下一步。',
    bestFor: '處理敏感訊息時保持中性、具體、可跟進。',
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
    name: '行政文件整理員',
    specialty: '通告 / 會議 / 報告摘要',
    portrait: '/assets/prompt-agents/admin-docs.jpg',
    icon: FileText,
    tone: 'slate',
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
    name: '成績反思分析師',
    specialty: '測考數據 / 弱項 / 跟進分組',
    portrait: '/assets/prompt-agents/data-reflection.jpg',
    icon: BarChart3,
    tone: 'accent',
    tags: ['成績', '跟進'],
    starter: '貼上分數、題目表現或班級觀察。',
    bestFor: '由測考結果推導下一步教學跟進。',
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

export default function PromptLibrary() {
  const { mode } = useMode()
  const nav = useNav()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(PROMPT_AGENTS[0].id)

  const filteredAgents = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return PROMPT_AGENTS
    return PROMPT_AGENTS.filter((agent) => {
      const haystack = [
        agent.name,
        agent.specialty,
        agent.starter,
        agent.bestFor,
        ...agent.tags,
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [query])

  const selected =
    filteredAgents.find((agent) => agent.id === selectedId) ??
    PROMPT_AGENTS.find((agent) => agent.id === selectedId) ??
    PROMPT_AGENTS[0]
  const SelectedIcon = selected.icon

  async function copyPrompt(prompt: string) {
    try {
      await navigator.clipboard.writeText(prompt)
      toast.success('已複製 prompt')
    } catch {
      toast.error('複製失敗')
    }
  }

  function openInAi(agent: PromptAgent) {
    writeAiHandoff(mode, agent.prompt)
    nav.open(mode === 'work' ? 'work-ai' : 'learning-ai')
    toast.success(`已開啟「${agent.name}」`)
  }

  return (
    <div className="space-y-5">
      <PageHero
        icon={Sparkles}
        kicker="Teaching Assistants"
        title="教學助手"
        description="按工作情境選擇一位助手，系統會把對應 prompt 帶到對話畫面。老師補資料後即可生成。"
      />

      <section className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">
              Assistant Library
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-100">
              點擊助手直接開始
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              按工作情境選擇：備課、出題、評語、簡報、家長溝通、行政整理等。
            </p>
          </div>

          <div className="w-full lg:max-w-sm">
            <Input
              icon={Search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜尋：電郵、教案、評語、家長..."
              aria-label="搜尋 prompt agent"
            />
          </div>
        </div>

        {filteredAgents.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
            {filteredAgents.map((agent) => (
              <ExpertCard
                key={agent.id}
                agent={agent}
                active={selected.id === agent.id}
                onPreview={() => setSelectedId(agent.id)}
                onStart={() => openInAi(agent)}
              />
            ))}
          </div>
        ) : (
          <Card padded className="text-sm text-slate-500 dark:text-slate-400">
            找不到相關助手。試試搜尋「備課」、「行政」、「家長」或「成績」。
          </Card>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,390px)_minmax(0,1fr)]">
        <Card clip className="overflow-hidden">
          <div className="aspect-[5/4] bg-slate-100 p-2 dark:bg-slate-800">
            <img
              src={selected.portrait}
              alt={`${selected.name}形象`}
              className="h-full w-full object-contain"
            />
          </div>
          <div className="space-y-4 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-accent-soft text-accent-strong ring-1 ring-inset ring-accent/20 dark:bg-accent/15 dark:text-accent">
                <SelectedIcon size={22} strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <h2 className="text-xl font-semibold leading-tight text-slate-950 dark:text-slate-100">
                  {selected.name}
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  {selected.specialty}
                </p>
              </div>
            </div>

            <div className="space-y-3 border-t border-slate-200/80 pt-4 dark:border-slate-700/70">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <CheckSquare size={14} strokeWidth={1.8} />
                  起手資料
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-200">
                  {selected.starter}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <ClipboardCheck size={14} strokeWidth={1.8} />
                  最適合
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-200">
                  {selected.bestFor}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {selected.tags.map((tag) => (
                <Badge key={tag} tone={selected.tone} className="px-2 py-0.5 text-[11px]">
                  {tag}
                </Badge>
              ))}
            </div>

            <Button type="button" icon={Send} onClick={() => openInAi(selected)} fullWidth>
              開始任務
            </Button>
          </div>
        </Card>

        <Card padded className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-accent">
                <PenLine size={14} strokeWidth={1.8} />
                Prompt setup
              </div>
              <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-100">
                {selected.name}的預設任務
              </h3>
              <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                保留完整身份、輸入欄位和輸出格式。老師可以先複製，或者直接送去 AI 後補資料。
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                icon={Copy}
                onClick={() => void copyPrompt(selected.prompt)}
              >
                複製
              </Button>
              <Button type="button" icon={Send} onClick={() => openInAi(selected)}>
                送去 AI
              </Button>
            </div>
          </div>

          <Textarea
            readOnly
            value={selected.prompt}
            className="h-[420px] resize-none font-mono text-[13px] leading-6"
            aria-label={`${selected.name} prompt`}
          />
        </Card>
      </section>
    </div>
  )
}

function ExpertCard({
  agent,
  active,
  onPreview,
  onStart,
}: {
  agent: PromptAgent
  active: boolean
  onPreview: () => void
  onStart: () => void
}) {
  const Icon = agent.icon

  return (
    <button
      type="button"
      onClick={onStart}
      onFocus={onPreview}
      onMouseEnter={onPreview}
      aria-label={`${agent.name}，開始任務`}
      className={cx(
        'group flex min-h-[300px] cursor-pointer flex-col overflow-hidden rounded-[16px] border bg-white text-left shadow-xs transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-slate-900 dark:focus-visible:ring-offset-slate-950',
        active
          ? 'border-accent/45 dark:border-accent/50'
          : 'border-slate-200/80 hover:border-accent/35 hover:shadow-md dark:border-slate-700/70 dark:hover:border-accent/40',
      )}
    >
      <div className="relative aspect-[5/4] w-full overflow-hidden bg-slate-100 p-2 dark:bg-slate-800">
        <img
          src={agent.portrait}
          alt={`${agent.name}形象`}
          loading="lazy"
          className="h-full w-full object-contain"
        />
        <span className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-[12px] bg-white/90 text-accent-strong shadow-sm ring-1 ring-inset ring-white/70 backdrop-blur dark:bg-slate-900/85 dark:text-accent dark:ring-white/10">
          <Icon size={18} strokeWidth={1.8} />
        </span>
      </div>

      <div className="flex flex-1 flex-col p-3.5">
        <div className="min-h-[74px]">
          <h3 className="text-base font-semibold leading-tight text-slate-950 dark:text-slate-100">
            {agent.name}
          </h3>
          <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">
            {agent.specialty}
          </p>
        </div>

        <p className="mt-2 min-h-[40px] text-xs leading-5 text-slate-600 dark:text-slate-300">
          {agent.bestFor}
        </p>

        <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
          {agent.tags.map((tag) => (
            <Badge key={tag} tone={agent.tone} className="px-2 py-0.5 text-[11px]">
              {tag}
            </Badge>
          ))}
        </div>
      </div>
    </button>
  )
}
