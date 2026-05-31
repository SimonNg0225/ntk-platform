import { useMemo, useState } from 'react'
import { useCollection } from '../../lib/store'
import { timetableCol, classesCol } from '../../data/collections'
import type { TimetableSlot } from '../../data/types'
import {
  Badge,
  Button,
  Field,
  Input,
  Modal,
  Select,
  StatCard,
} from '../../ui'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'

const DAYS: { day: number; label: string }[] = [
  { day: 1, label: '星期一' },
  { day: 2, label: '星期二' },
  { day: 3, label: '星期三' },
  { day: 4, label: '星期四' },
  { day: 5, label: '星期五' },
  { day: 6, label: '星期六' },
]

const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8]

type EditorState = {
  day: number
  period: number
  slotId?: string
  classId: string
  subject: string
  room: string
}

export default function Timetable() {
  const slots = useCollection(timetableCol)
  const classes = useCollection(classesCol)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const toast = useToast()
  const confirm = useConfirm()

  const today = new Date().getDay() // 0=日 … 6=六

  const slotMap = useMemo(() => {
    const map = new Map<string, TimetableSlot>()
    for (const slot of slots) {
      map.set(`${slot.day}-${slot.period}`, slot)
    }
    return map
  }, [slots])

  const classNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const cls of classes) {
      map.set(cls.id, cls.name)
    }
    return map
  }, [classes])

  function openCell(day: number, period: number) {
    const existing = slotMap.get(`${day}-${period}`)
    if (existing) {
      setEditor({
        day,
        period,
        slotId: existing.id,
        classId: existing.classId ?? '',
        subject: existing.subject ?? '',
        room: existing.room ?? '',
      })
    } else {
      setEditor({ day, period, classId: '', subject: '', room: '' })
    }
  }

  function closeEditor() {
    setEditor(null)
  }

  function handleSave() {
    if (!editor) return
    const subject = editor.subject.trim()
    const room = editor.room.trim()
    const classId = editor.classId || undefined

    if (!subject && !classId) {
      return
    }

    const payload = {
      day: editor.day,
      period: editor.period,
      classId,
      subject: subject || (classId ? (classNameById.get(classId) ?? '') : ''),
      room: room || undefined,
    }

    if (editor.slotId) {
      timetableCol.update(editor.slotId, payload)
      toast.success('已更新課堂')
    } else {
      timetableCol.add(payload)
      toast.success('已新增課堂')
    }
    setEditor(null)
  }

  async function handleRemove() {
    if (!editor?.slotId) return
    const ok = await confirm({
      title: '刪除課堂？',
      message: '呢節課堂將會喺時間表移除，呢個動作無法復原。',
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    timetableCol.remove(editor.slotId)
    toast.success('已刪除課堂')
    setEditor(null)
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">時間表</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          每週教學時間表，撳格子新增或編輯一節課堂。
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="每週總堂數" value={slots.length} unit="節" icon="📅" />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-20 border-b border-slate-200 bg-slate-50 p-3 text-left font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
                節數
              </th>
              {DAYS.map((d) => {
                const isToday = d.day === today
                return (
                  <th
                    key={d.day}
                    className={`border-b border-l border-slate-200 p-3 text-center font-medium dark:border-slate-700 ${
                      isToday
                        ? 'bg-accent-soft text-accent-strong'
                        : 'bg-slate-50 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300'
                    }`}
                  >
                    {d.label}
                    {isToday && (
                      <span className="ml-1 text-[10px] font-semibold">今日</span>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((period) => (
              <tr key={period}>
                <th className="border-b border-slate-200 bg-slate-50 p-3 text-left font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
                  第 {period} 節
                </th>
                {DAYS.map((d) => {
                  const slot = slotMap.get(`${d.day}-${period}`)
                  const className = slot?.classId
                    ? classNameById.get(slot.classId)
                    : undefined
                  const title = slot?.subject || className || ''
                  const isToday = d.day === today
                  return (
                    <td
                      key={d.day}
                      className={`border-b border-l border-slate-200 p-1.5 align-top dark:border-slate-700 ${
                        isToday ? 'bg-accent-soft/30' : ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => openCell(d.day, period)}
                        className={`flex h-20 w-full flex-col items-start justify-start gap-1 rounded-xl border border-transparent p-2 text-left transition focus:outline-none focus:ring-2 focus:ring-accent/30 ${
                          slot
                            ? 'bg-accent-soft hover:bg-accent-soft/80'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        {slot ? (
                          <>
                            <span className="line-clamp-2 text-sm font-medium text-accent-strong">
                              {title}
                            </span>
                            <div className="mt-auto flex flex-wrap gap-1">
                              {className && (
                                <Badge tone="accent">{className}</Badge>
                              )}
                              {slot.room && (
                                <Badge tone="slate">課室 {slot.room}</Badge>
                              )}
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-slate-300 dark:text-slate-600">＋</span>
                        )}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!editor}
        onClose={closeEditor}
        title={editor?.slotId ? '編輯課堂' : '新增課堂'}
      >
        {editor && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {DAYS.find((d) => d.day === editor.day)?.label} · 第 {editor.period}{' '}
              節
            </p>

            <div className="space-y-3">
              <Field label="班別（選填）">
                <Select
                  value={editor.classId}
                  onChange={(e) =>
                    setEditor((prev) =>
                      prev ? { ...prev, classId: e.target.value } : prev,
                    )
                  }
                >
                  <option value="">未選擇</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="科目">
                <Input
                  type="text"
                  value={editor.subject}
                  onChange={(e) =>
                    setEditor((prev) =>
                      prev ? { ...prev, subject: e.target.value } : prev,
                    )
                  }
                  placeholder="例如：中文"
                />
              </Field>

              <Field label="課室（選填）">
                <Input
                  type="text"
                  value={editor.room}
                  onChange={(e) =>
                    setEditor((prev) =>
                      prev ? { ...prev, room: e.target.value } : prev,
                    )
                  }
                  placeholder="例如：1A"
                />
              </Field>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              {editor.slotId ? (
                <Button variant="danger" onClick={handleRemove}>
                  刪除
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button variant="secondary" onClick={closeEditor}>
                  取消
                </Button>
                <Button onClick={handleSave}>儲存</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
