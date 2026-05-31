import { useState } from 'react'
import { useCollection } from '../../lib/store'
import { journalCol } from '../../data/collections'
import { Textarea, Button, Card, Badge, SectionTitle, EmptyState } from '../../ui'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'

const MOODS = ['😀', '🙂', '😐', '😓', '😣']
const PROMPTS = [
  '今日學咗啲咩？',
  '有咩心得 / 突破？',
  '邊度仲未明，聽日想點跟進？',
]

export default function Journal() {
  const entries = useCollection(journalCol)
  const toast = useToast()
  const confirm = useConfirm()
  const today = new Date().toISOString().slice(0, 10)
  const todayEntry = entries.find((e) => e.date === today)

  const [content, setContent] = useState(todayEntry?.content ?? '')
  const [mood, setMood] = useState(todayEntry?.mood ?? '')
  const [saved, setSaved] = useState(false)

  const save = () => {
    if (!content.trim()) return
    if (todayEntry) {
      journalCol.update(todayEntry.id, { content: content.trim(), mood })
    } else {
      journalCol.add({ date: today, content: content.trim(), mood })
    }
    setSaved(true)
    toast.success('已儲存日誌')
    setTimeout(() => setSaved(false), 1500)
  }

  const removeEntry = async (id: string, date: string) => {
    const ok = await confirm({
      title: '刪除日誌？',
      message: `確定要刪除 ${date} 嘅日誌？呢個動作無法復原。`,
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    journalCol.remove(id)
    toast.success('已刪除日誌')
  }

  const past = [...entries]
    .filter((e) => e.date !== today)
    .sort((a, b) => (a.date < b.date ? 1 : -1))

  return (
    <div className="space-y-5">
      {/* 今日 */}
      <div className="space-y-3 rounded-2xl border border-accent/30 bg-accent-soft/40 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            今日反思 · {today}
          </p>
          <div className="flex gap-1">
            {MOODS.map((m) => (
              <button
                key={m}
                onClick={() => setMood(m)}
                className={`text-lg transition ${mood === m ? 'scale-125' : 'opacity-40 hover:opacity-100'}`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-400">{PROMPTS.join('　')}</p>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          placeholder="寫低今日嘅學習反思…"
        />
        <Button onClick={save} className="w-full">
          {saved ? '已儲存 ✓' : todayEntry ? '更新今日日誌' : '儲存今日日誌'}
        </Button>
      </div>

      {/* 過往 */}
      {past.length > 0 ? (
        <div>
          <SectionTitle>過往日誌</SectionTitle>
          <ul className="space-y-2">
            {past.map((e) => (
              <Card key={e.id} className="group p-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                    {e.mood && <Badge tone="accent">{e.mood}</Badge>}
                    {e.date}
                  </span>
                  <button
                    onClick={() => removeEntry(e.id, e.date)}
                    className="text-xs text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-rose-500"
                  >
                    刪除
                  </button>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
                  {e.content}
                </p>
              </Card>
            ))}
          </ul>
        </div>
      ) : (
        <EmptyState
          icon="📔"
          title="仲未有過往日誌"
          hint="每日寫低一啲反思，慢慢就會儲落一本屬於你嘅學習日記。"
        />
      )}
    </div>
  )
}
