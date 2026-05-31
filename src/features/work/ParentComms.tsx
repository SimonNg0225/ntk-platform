import { useMemo, useState } from 'react'
import { useCollection } from '../../lib/store'
import { parentCommsCol, classesCol, studentsCol } from '../../data/collections'
import type { ParentComm } from '../../data/types'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  Select,
  StatCard,
  Textarea,
} from '../../ui'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'

const CHANNELS = ['電話', '電郵', '面談', '手冊'] as const
type Channel = (typeof CHANNELS)[number]

const CHANNEL_ICON: Record<string, string> = {
  電話: '📞',
  電郵: '✉️',
  面談: '🤝',
  手冊: '📔',
}

const today = () => new Date().toISOString().slice(0, 10)

export default function ParentComms() {
  const comms = useCollection(parentCommsCol)
  const classes = useCollection(classesCol)
  const students = useCollection(studentsCol)
  const toast = useToast()
  const confirm = useConfirm()

  // 新增 Modal + 表單狀態
  const [open, setOpen] = useState(false)
  const [classId, setClassId] = useState('')
  const [studentId, setStudentId] = useState('')
  const [date, setDate] = useState(today())
  const [channel, setChannel] = useState<Channel>('電話')
  const [summary, setSummary] = useState('')
  const [followUp, setFollowUp] = useState(false)

  // 篩選狀態
  const [filterClassId, setFilterClassId] = useState('')
  const [onlyFollowUp, setOnlyFollowUp] = useState(false)

  const classMap = useMemo(
    () => new Map(classes.map((c) => [c.id, c])),
    [classes],
  )
  const studentMap = useMemo(
    () => new Map(students.map((s) => [s.id, s])),
    [students],
  )

  // 新增表單可揀學生（按所揀班別 filter）
  const formStudents = useMemo(
    () => (classId ? students.filter((s) => s.classId === classId) : []),
    [students, classId],
  )

  const visibleComms = useMemo(() => {
    return comms
      .filter((c) => (filterClassId ? c.classId === filterClassId : true))
      .filter((c) => (onlyFollowUp ? c.followUp === true : true))
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  }, [comms, filterClassId, onlyFollowUp])

  const followUpCount = useMemo(
    () => comms.filter((c) => c.followUp === true).length,
    [comms],
  )

  const canSubmit = classId !== '' && summary.trim() !== ''

  const resetForm = () => {
    setClassId('')
    setStudentId('')
    setDate(today())
    setChannel('電話')
    setSummary('')
    setFollowUp(false)
  }

  const openModal = () => {
    resetForm()
    setOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    parentCommsCol.add({
      classId,
      studentId: studentId || undefined,
      date,
      channel,
      summary: summary.trim(),
      followUp,
      createdAt: new Date().toISOString(),
    })
    toast.success('已新增溝通記錄')
    resetForm()
    setOpen(false)
  }

  const removeComm = async (c: ParentComm) => {
    const ok = await confirm({
      title: '刪除溝通記錄？',
      message: `${describeTarget(c)}（${c.date}）嘅記錄將會被永久刪除，呢個動作無法復原。`,
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    parentCommsCol.remove(c.id)
    toast.success('已刪除溝通記錄')
  }

  const describeTarget = (c: ParentComm) => {
    const cls = classMap.get(c.classId)
    const stu = c.studentId ? studentMap.get(c.studentId) : undefined
    const clsName = cls?.name ?? '未知班別'
    return stu ? `${clsName}・${stu.name}` : clsName
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 sm:text-2xl">
            家長 / 學生溝通記錄
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            記錄同家長或學生嘅聯絡內容，並標示需要跟進嘅事項。
          </p>
        </div>
        <Button onClick={openModal} className="shrink-0">
          + 新增記錄
        </Button>
      </header>

      {/* 統計 */}
      <section className="grid grid-cols-2 gap-3">
        <StatCard label="總記錄" value={comms.length} unit="條" icon="🗒️" />
        <StatCard
          label="待跟進"
          value={followUpCount}
          unit="條"
          icon="⏳"
          highlight={followUpCount > 0}
        />
      </section>

      {/* 篩選 */}
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label
            className="text-sm font-medium text-slate-700 dark:text-slate-200"
            htmlFor="pc-filter-class"
          >
            按班別篩選
          </label>
          <Select
            id="pc-filter-class"
            className="sm:w-48"
            value={filterClassId}
            onChange={(e) => setFilterClassId(e.target.value)}
          >
            <option value="">全部班別</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent/30 dark:border-slate-700"
            checked={onlyFollowUp}
            onChange={(e) => setOnlyFollowUp(e.target.checked)}
          />
          只睇需要跟進
        </label>
      </Card>

      {/* 記錄列表 */}
      <section className="space-y-3">
        {visibleComms.length === 0 ? (
          <EmptyState
            icon="💬"
            title={comms.length === 0 ? '暫無溝通記錄' : '無符合篩選嘅記錄'}
            hint={
              comms.length === 0
                ? '撳右上角「新增記錄」開始記低同家長嘅聯絡。'
                : '試吓調整班別或跟進篩選。'
            }
          />
        ) : (
          visibleComms.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {c.date}
                </span>
                <Badge tone="accent">
                  {CHANNEL_ICON[c.channel] ?? '🗨️'} {c.channel}
                </Badge>
                {c.followUp && (
                  <button
                    type="button"
                    onClick={() => {
                      parentCommsCol.update(c.id, { followUp: false })
                      toast.success('已標記為已跟進')
                    }}
                    title="撳一下標記為已跟進"
                  >
                    <Badge
                      tone="amber"
                      className="cursor-pointer transition hover:brightness-95"
                    >
                      ⏳ 待跟進
                    </Badge>
                  </button>
                )}
                {!c.followUp && (
                  <button
                    type="button"
                    onClick={() => {
                      parentCommsCol.update(c.id, { followUp: true })
                      toast.info('已重新標記為待跟進')
                    }}
                    title="撳一下重新標記為待跟進"
                  >
                    <Badge
                      tone="green"
                      className="cursor-pointer transition hover:brightness-95"
                    >
                      ✓ 已跟進
                    </Badge>
                  </button>
                )}
                <IconButton
                  label="刪除記錄"
                  onClick={() => removeComm(c)}
                  className="ml-auto hover:text-rose-600"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M6 7h12M9 7V5h6v2M7 7l1 12h8l1-12"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </IconButton>
              </div>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {describeTarget(c)}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100">
                {c.summary}
              </p>
            </Card>
          ))
        )}
      </section>

      {/* 新增記錄 Modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="新增溝通記錄">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="班別">
              <Select
                value={classId}
                onChange={(e) => {
                  setClassId(e.target.value)
                  setStudentId('')
                }}
              >
                <option value="">請揀班別</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.subject ? `（${c.subject}）` : ''}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="學生（選填）">
              <Select
                value={studentId}
                disabled={!classId}
                onChange={(e) => setStudentId(e.target.value)}
              >
                <option value="">
                  {classId ? '全班 / 不指定' : '請先揀班別'}
                </option>
                {formStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.studentNo ? `（${s.studentNo}）` : ''}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="日期">
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>

            <Field label="聯絡方式">
              <Select
                value={channel}
                onChange={(e) => setChannel(e.target.value as Channel)}
              >
                {CHANNELS.map((ch) => (
                  <option key={ch} value={ch}>
                    {CHANNEL_ICON[ch]} {ch}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="內容摘要">
            <Textarea
              className="min-h-[96px]"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="記錄溝通嘅重點內容…"
            />
          </Field>

          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent/30 dark:border-slate-700"
              checked={followUp}
              onChange={(e) => setFollowUp(e.target.checked)}
            />
            需要跟進
          </label>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              取消
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              新增記錄
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
