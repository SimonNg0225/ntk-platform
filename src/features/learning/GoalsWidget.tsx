import { useState } from 'react'
import { Plus, Target, TrendingUp, Trash2 } from 'lucide-react'
import { useCollection } from '../../lib/store'
import { goalsCol } from '../../data/collections'
import {
  Input,
  Button,
  Card,
  ProgressBar,
  StatCard,
  EmptyState,
  IconButton,
} from '../../ui'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'

// 學習目標 + 進度追蹤
export default function GoalsWidget() {
  const goals = useCollection(goalsCol)
  const toast = useToast()
  const confirm = useConfirm()
  const [draft, setDraft] = useState('')

  const add = () => {
    const title = draft.trim()
    if (!title) return
    goalsCol.add({ title, progress: 0, createdAt: new Date().toISOString() })
    setDraft('')
    toast.success('已新增目標')
  }

  const bump = (id: string, delta: number) => {
    const g = goals.find((x) => x.id === id)
    if (!g) return
    const next = Math.max(0, Math.min(100, g.progress + delta))
    goalsCol.update(id, { progress: next })
    if (next === 100 && g.progress < 100) toast.success('恭喜達成目標')
  }

  const removeGoal = async (id: string, title: string) => {
    const ok = await confirm({
      title: '刪除目標？',
      message: `確定要刪除「${title}」？呢個動作無法復原。`,
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    goalsCol.remove(id)
    toast.success('已刪除目標')
  }

  const sorted = [...goals].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  const avgProgress = goals.length
    ? Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length)
    : 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="目標數" value={goals.length} unit="個" icon={Target} highlight />
        <StatCard label="平均進度" value={avgProgress} unit="%" icon={TrendingUp} />
      </div>

      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="新增一個學習目標…"
          className="flex-1"
        />
        <Button onClick={add} icon={Plus} className="shrink-0">
          新增目標
        </Button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={Target}
          title="仲未有學習目標"
          hint="喺上面新增一個目標，一步步追蹤你嘅進度。"
        />
      ) : (
        <ul className="space-y-3">
          {sorted.map((g) => (
            <Card key={g.id} className="group p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                  {g.title}
                </span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-accent">
                  {g.progress}%
                </span>
              </div>
              <ProgressBar value={g.progress} className="mt-2.5" />
              <div className="mt-3 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => bump(g.id, -10)}
                  disabled={g.progress <= 0}
                >
                  -10%
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => bump(g.id, +10)}
                  disabled={g.progress >= 100}
                >
                  +10%
                </Button>
                <IconButton
                  label="刪除目標"
                  tone="danger"
                  onClick={() => removeGoal(g.id, g.title)}
                  className="ml-auto opacity-0 transition group-hover:opacity-100"
                >
                  <Trash2 size={16} />
                </IconButton>
              </div>
            </Card>
          ))}
        </ul>
      )}
    </div>
  )
}
