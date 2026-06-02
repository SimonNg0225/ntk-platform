import { useState } from 'react'
import { EmptyState, SegmentedControl, Select } from '../../../../ui'
import { Bot, Lock, CalendarDays, MessageCircleQuestion, ClipboardList } from 'lucide-react'
import { isAIConfigured, type AIModel } from '../../../../lib/aiClient'
import { useAuth } from '../../../../context/AuthContext'
import PlanGen from './PlanGen'
import FormQA from './FormQA'
import Assess from './Assess'

// ============================================================
//  AI 健身教練（全 AI 模組）
//  ------------------------------------------------------------
//  頂部 SegmentedControl 三個工具：
//   1) 課表生成   — complete() → JSON 課表 → 靚卡 + 可存做計劃
//   2) 動作姿勢問答 — streamChat() 串流對話（打字效果）
//   3) 體態目標診斷 — 表單 → complete() → 個人化建議
//  全部 gate：!isAIConfigured / 未登入 → 友善提示；call 包
//  try/catch + toast.error（喺各子元件處理）。
// ============================================================

type ToolId = 'plan' | 'qa' | 'assess'

const TOOLS: { id: ToolId; label: string; icon: typeof CalendarDays }[] = [
  { id: 'plan', label: '課表生成', icon: CalendarDays },
  { id: 'qa', label: '動作問答', icon: MessageCircleQuestion },
  { id: 'assess', label: '體態診斷', icon: ClipboardList },
]

const MODELS: { id: AIModel; label: string }[] = [
  { id: 'gemini-2.5-flash', label: '⚡ Flash（快）' },
  { id: 'gemini-2.5-pro', label: '🧠 Pro（強）' },
]

export default function CoachView() {
  const { user } = useAuth()
  const [tool, setTool] = useState<ToolId>('plan')
  const [model, setModel] = useState<AIModel>('gemini-2.5-flash')

  // ── 守門：未接 AI ──
  if (!isAIConfigured) {
    return (
      <EmptyState
        icon={Bot}
        title="需要先設定雲端 AI"
        hint="AI 健身教練要接好 Supabase 並部署 gemini Edge Function 先用到。步驟見 docs/SETUP.md。"
      />
    )
  }

  // ── 守門：未登入 ──
  if (!user) {
    return (
      <EmptyState
        icon={Lock}
        title="請先登入先可以用 AI 教練"
        hint="喺左下角用 Google 登入後就用得，生成嘅課表亦會同步到你自己嘅雲端。"
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* 工具列 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedControl
          value={tool}
          onChange={setTool}
          options={TOOLS.map((t) => ({ id: t.id, label: t.label, icon: t.icon }))}
        />
        <Select
          className="w-auto py-1.5 text-base sm:text-xs"
          value={model}
          onChange={(e) => setModel(e.target.value as AIModel)}
          aria-label="選擇 AI 模型"
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </Select>
      </div>

      {/* 工具內容（切換時用 key 重置子元件內部狀態） */}
      {tool === 'plan' && <PlanGen key="plan" model={model} />}
      {tool === 'qa' && <FormQA key="qa" model={model} />}
      {tool === 'assess' && <Assess key="assess" model={model} />}
    </div>
  )
}
