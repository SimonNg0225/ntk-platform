import { useState } from 'react'
import { useCollection } from '../../lib/store'
import { tasksCol } from '../../data/collections'
import {
  Input,
  Button,
  Card,
  StatCard,
  Pills,
  EmptyState,
  IconButton,
} from '../../ui'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'

type Filter = 'all' | 'active' | 'done'

// 待辦 / 批改清單
export default function TodoWidget() {
  const tasks = useCollection(tasksCol)
  const toast = useToast()
  const confirm = useConfirm()
  const [draft, setDraft] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const add = () => {
    const text = draft.trim()
    if (!text) return
    tasksCol.add({ text, done: false, createdAt: new Date().toISOString() })
    setDraft('')
    toast.success('已新增待辦')
  }
  const toggle = (id: string) => {
    const t = tasks.find((x) => x.id === id)
    if (t) tasksCol.update(id, { done: !t.done })
  }
  const remove = async (id: string, text: string) => {
    const ok = await confirm({
      title: '刪除待辦？',
      message: `「${text}」將會被刪除，呢個動作無法復原。`,
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    tasksCol.remove(id)
    toast.success('已刪除待辦')
  }

  const sorted = [...tasks].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  const remaining = tasks.filter((t) => !t.done).length
  const completed = tasks.length - remaining

  const visible = sorted.filter((t) =>
    filter === 'all' ? true : filter === 'active' ? !t.done : t.done,
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="待辦" value={remaining} unit="項" icon="📝" highlight />
        <StatCard label="已完成" value={completed} unit="項" icon="✅" />
      </div>

      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="新增一項待辦（批改 / 備課 / 行政…）"
          className="flex-1"
        />
        <Button onClick={add}>加入</Button>
      </div>

      <Pills<Filter>
        options={[
          { id: 'all', label: '全部' },
          { id: 'active', label: '未完成' },
          { id: 'done', label: '已完成' },
        ]}
        active={filter}
        onChange={setFilter}
      />

      {visible.length === 0 ? (
        <EmptyState
          icon="🗒️"
          title={
            filter === 'done'
              ? '仲未有完成嘅項目'
              : filter === 'active'
                ? '冇未完成嘅項目'
                : '仲未有待辦'
          }
          hint="喺上面新增一項，開始清你嘅清單。"
        />
      ) : (
        <Card className="divide-y divide-slate-100 overflow-hidden dark:divide-slate-700">
          {visible.map((t) => (
            <div
              key={t.id}
              className="group flex items-center gap-3 px-4 py-3"
            >
              <input
                type="checkbox"
                checked={t.done}
                onChange={() => toggle(t.id)}
                className="h-4 w-4 accent-[color:var(--accent)]"
              />
              <span
                className={
                  t.done
                    ? 'flex-1 text-sm text-slate-400 line-through dark:text-slate-500'
                    : 'flex-1 text-sm text-slate-800 dark:text-slate-100'
                }
              >
                {t.text}
              </span>
              <IconButton
                label="刪除"
                onClick={() => remove(t.id, t.text)}
                className="opacity-0 transition group-hover:opacity-100 hover:text-rose-500"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </IconButton>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
