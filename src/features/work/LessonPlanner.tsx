import { useMemo, useState } from 'react'
import { useCollection } from '../../lib/store'
import { lessonPlansCol, classesCol, topicsCol } from '../../data/collections'
import type { LessonPlan } from '../../data/types'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import {
  Button,
  Input,
  Textarea,
  Select,
  Field,
  Card,
  Badge,
  SectionTitle,
  EmptyState,
  IconButton,
  Modal,
  Tooltip,
} from '../../ui'
import { Plus, Pencil, Copy, Trash2, Calendar, NotebookPen } from 'lucide-react'

type Draft = {
  title: string
  classId: string
  topicId: string
  date: string
  objectives: string
  activities: string
  resourcesNote: string
}

const emptyDraft: Draft = {
  title: '',
  classId: '',
  topicId: '',
  date: '',
  objectives: '',
  activities: '',
  resourcesNote: '',
}

type ModalMode = { type: 'create' } | { type: 'edit'; id: string }

export default function LessonPlanner() {
  const plans = useCollection(lessonPlansCol)
  const classes = useCollection(classesCol)
  const topics = useCollection(topicsCol)
  const toast = useToast()
  const confirm = useConfirm()

  const [filterClass, setFilterClass] = useState('')
  const [filterTopic, setFilterTopic] = useState('')
  const [search, setSearch] = useState('')

  const [modalMode, setModalMode] = useState<ModalMode | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)

  const sortedTopics = useMemo(
    () => [...topics].sort((a, b) => a.order - b.order),
    [topics],
  )

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return plans
      .filter(
        (p) =>
          (!filterClass || p.classId === filterClass) &&
          (!filterTopic || p.topicId === filterTopic) &&
          (!q || p.title.toLowerCase().includes(q)),
      )
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  }, [plans, filterClass, filterTopic, search])

  const className = (id?: string) => classes.find((c) => c.id === id)?.name
  const topicName = (id?: string) => topics.find((t) => t.id === id)?.topic

  const setField = (key: keyof Draft, value: string) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const toPayload = (d: Draft) => ({
    title: d.title.trim(),
    classId: d.classId || undefined,
    topicId: d.topicId || undefined,
    date: d.date || undefined,
    objectives: d.objectives.trim() || undefined,
    activities: d.activities.trim() || undefined,
    resourcesNote: d.resourcesNote.trim() || undefined,
  })

  const planToDraft = (p: LessonPlan): Draft => ({
    title: p.title,
    classId: p.classId ?? '',
    topicId: p.topicId ?? '',
    date: p.date ?? '',
    objectives: p.objectives ?? '',
    activities: p.activities ?? '',
    resourcesNote: p.resourcesNote ?? '',
  })

  const openCreate = () => {
    setDraft(emptyDraft)
    setModalMode({ type: 'create' })
  }

  const openEdit = (p: LessonPlan) => {
    setDraft(planToDraft(p))
    setModalMode({ type: 'edit', id: p.id })
  }

  const closeModal = () => setModalMode(null)

  const submit = () => {
    if (!modalMode || !draft.title.trim()) return
    if (modalMode.type === 'create') {
      lessonPlansCol.add({
        ...toPayload(draft),
        createdAt: new Date().toISOString(),
      })
      toast.success('已新增教案')
    } else {
      lessonPlansCol.update(modalMode.id, toPayload(draft))
      toast.success('已儲存教案')
    }
    closeModal()
  }

  const duplicate = (p: LessonPlan) => {
    lessonPlansCol.add({
      ...toPayload(planToDraft(p)),
      title: `${p.title}（副本）`,
      createdAt: new Date().toISOString(),
    })
    toast.success('已複製教案')
  }

  const remove = async (p: LessonPlan) => {
    const ok = await confirm({
      title: '刪除教案？',
      message: `「${p.title}」將會被永久刪除，呢個動作無法復原。`,
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    lessonPlansCol.remove(p.id)
    toast.success('已刪除教案')
  }

  const firstLine = (text?: string) => {
    if (!text) return ''
    const line = text.split('\n').find((l) => l.trim())
    return line?.trim() ?? ''
  }

  const hasFilter = !!filterClass || !!filterTopic || !!search.trim()

  return (
    <div className="space-y-4">
      <SectionTitle
        icon={NotebookPen}
        right={
          <Button size="sm" icon={Plus} onClick={openCreate}>
            新增教案
          </Button>
        }
      >
        備課 / 教案
      </SectionTitle>

      {/* 篩選 + 搜尋 */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋教案標題…"
        />
        <Select
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
        >
          <option value="">全部班別</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select
          value={filterTopic}
          onChange={(e) => setFilterTopic(e.target.value)}
        >
          <option value="">全部課題</option>
          {sortedTopics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.topic}
            </option>
          ))}
        </Select>
      </div>

      {/* 教案列表 */}
      {visible.length === 0 ? (
        <EmptyState
          icon={NotebookPen}
          title={hasFilter ? '揾唔到符合條件嘅教案' : '仲未有教案'}
          hint={
            hasFilter
              ? '試吓清除篩選或搜尋條件。'
              : '撳右上角「新增教案」開始備課。'
          }
          action={
            hasFilter ? undefined : (
              <Button size="sm" icon={Plus} onClick={openCreate}>
                新增教案
              </Button>
            )
          }
        />
      ) : (
        <ul className="space-y-2.5">
          {visible.map((p) => (
            <Card key={p.id} className="p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {p.title}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {p.classId && (
                      <Badge tone="accent">{className(p.classId)}</Badge>
                    )}
                    {p.topicId && <Badge>{topicName(p.topicId)}</Badge>}
                    {p.date && (
                      <Badge tone="blue" icon={Calendar}>
                        <span className="tabular-nums">{p.date}</span>
                      </Badge>
                    )}
                  </div>
                  {firstLine(p.objectives) && (
                    <p className="mt-2 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-medium text-slate-400 dark:text-slate-500">
                        目標：
                      </span>
                      {firstLine(p.objectives)}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Tooltip label="編輯教案">
                    <IconButton label="編輯教案" onClick={() => openEdit(p)}>
                      <Pencil size={18} strokeWidth={1.8} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip label="複製教案">
                    <IconButton label="複製教案" onClick={() => duplicate(p)}>
                      <Copy size={18} strokeWidth={1.8} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip label="刪除教案">
                    <IconButton
                      label="刪除教案"
                      tone="danger"
                      onClick={() => remove(p)}
                    >
                      <Trash2 size={18} strokeWidth={1.8} />
                    </IconButton>
                  </Tooltip>
                </div>
              </div>

              {(p.objectives || p.activities || p.resourcesNote) && (
                <div className="mt-3 space-y-2.5 border-t border-slate-100 pt-3 dark:border-slate-700">
                  {p.objectives && (
                    <Section label="教學目標" text={p.objectives} />
                  )}
                  {p.activities && (
                    <Section label="教學流程" text={p.activities} />
                  )}
                  {p.resourcesNote && (
                    <Section label="教材備註" text={p.resourcesNote} />
                  )}
                </div>
              )}
            </Card>
          ))}
        </ul>
      )}

      {/* 新增 / 編輯 Modal */}
      <Modal
        open={modalMode !== null}
        onClose={closeModal}
        title={modalMode?.type === 'edit' ? '編輯教案' : '新增教案'}
      >
        <div className="space-y-3">
          <Field label="教案標題（必填）">
            <Input
              value={draft.title}
              onChange={(e) => setField('title', e.target.value)}
              placeholder="如：香港營商環境導論"
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="班別">
              <Select
                value={draft.classId}
                onChange={(e) => setField('classId', e.target.value)}
              >
                <option value="">未指定</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="課題">
              <Select
                value={draft.topicId}
                onChange={(e) => setField('topicId', e.target.value)}
              >
                <option value="">未指定</option>
                {sortedTopics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.topic}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="日期">
              <Input
                type="date"
                value={draft.date}
                onChange={(e) => setField('date', e.target.value)}
              />
            </Field>
          </div>
          <Field label="教學目標">
            <Textarea
              value={draft.objectives}
              onChange={(e) => setField('objectives', e.target.value)}
              placeholder="本課學生需掌握嘅學習重點…"
              rows={3}
            />
          </Field>
          <Field label="教學流程 / 活動">
            <Textarea
              value={draft.activities}
              onChange={(e) => setField('activities', e.target.value)}
              placeholder="引入、講解、活動、總結…"
              rows={4}
            />
          </Field>
          <Field label="教材備註">
            <Textarea
              value={draft.resourcesNote}
              onChange={(e) => setField('resourcesNote', e.target.value)}
              placeholder="工作紙、簡報、影片連結等…"
              rows={2}
            />
          </Field>
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={closeModal}>
              取消
            </Button>
            <Button onClick={submit} disabled={!draft.title.trim()}>
              {modalMode?.type === 'edit' ? '儲存' : '加入'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function Section({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {label}
      </div>
      <p className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed text-slate-600 dark:text-slate-300">
        {text}
      </p>
    </div>
  )
}
