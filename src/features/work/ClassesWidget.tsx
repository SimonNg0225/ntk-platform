import { useState } from 'react'
import { useCollection } from '../../lib/store'
import { classesCol, studentsCol } from '../../data/collections'
import {
  Input,
  Button,
  Card,
  Badge,
  StatCard,
  EmptyState,
  IconButton,
} from '../../ui'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'

// 班別管理 — 用共用 store，課程進度 / 成績管理都會用到同一批班別
export default function ClassesWidget() {
  const classes = useCollection(classesCol)
  const students = useCollection(studentsCol)
  const toast = useToast()
  const confirm = useConfirm()
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')

  const add = () => {
    if (!name.trim()) return
    classesCol.add({
      name: name.trim(),
      subject: subject.trim() || 'BAFS（商業管理）',
    })
    setName('')
    setSubject('')
    toast.success('已新增班別')
  }

  const remove = async (id: string, className: string) => {
    const count = students.filter((s) => s.classId === id).length
    const ok = await confirm({
      title: '刪除班別？',
      message:
        count > 0
          ? `「${className}」連同名下 ${count} 位學生將會一併被刪除，呢個動作無法復原。`
          : `「${className}」將會被永久刪除，呢個動作無法復原。`,
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    classesCol.remove(id)
    // 連帶清走該班學生
    students
      .filter((s) => s.classId === id)
      .forEach((s) => studentsCol.remove(s.id))
    toast.success('已刪除班別')
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="班別總數" value={classes.length} unit="班" icon="🏫" highlight />
        <StatCard label="學生總數" value={students.length} unit="位" icon="👥" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="班別（例如 5A）"
          className="w-32"
        />
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="科目 / 組別"
          className="min-w-[8rem] flex-1"
        />
        <Button onClick={add} className="shrink-0">
          新增班別
        </Button>
      </div>

      {classes.length === 0 ? (
        <EmptyState
          icon="🏫"
          title="仲未有班別"
          hint="喺上面新增一個班別，之後課程進度同成績管理都會用到。"
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {classes.map((c) => {
            const count = students.filter((s) => s.classId === c.id).length
            return (
              <Card key={c.id} className="group p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    {c.name}
                  </span>
                  <IconButton
                    label="刪除班別"
                    onClick={() => remove(c.id, c.name)}
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
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {c.subject}
                </p>
                <div className="mt-3">
                  <Badge tone="accent">👥 {count} 位學生</Badge>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
