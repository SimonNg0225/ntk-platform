import { useMemo, useState } from 'react'
import { useCollection } from '../../lib/store'
import { lessonPlansCol, classesCol, topicsCol } from '../../data/collections'
import type { LessonPlan } from '../../data/types'

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent/30'

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

export default function LessonPlanner() {
  const plans = useCollection(lessonPlansCol)
  const classes = useCollection(classesCol)
  const topics = useCollection(topicsCol)

  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [filterClass, setFilterClass] = useState('')
  const [filterTopic, setFilterTopic] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [edit, setEdit] = useState<Draft>(emptyDraft)

  const sortedTopics = useMemo(
    () => [...topics].sort((a, b) => a.order - b.order),
    [topics],
  )

  const visible = useMemo(
    () =>
      plans.filter(
        (p) =>
          (!filterClass || p.classId === filterClass) &&
          (!filterTopic || p.topicId === filterTopic),
      ),
    [plans, filterClass, filterTopic],
  )

  const className = (id?: string) => classes.find((c) => c.id === id)?.name
  const topicName = (id?: string) => topics.find((t) => t.id === id)?.topic

  const setDraftField = (key: keyof Draft, value: string) =>
    setDraft((d) => ({ ...d, [key]: value }))
  const setEditField = (key: keyof Draft, value: string) =>
    setEdit((d) => ({ ...d, [key]: value }))

  const toPayload = (d: Draft) => ({
    title: d.title.trim(),
    classId: d.classId || undefined,
    topicId: d.topicId || undefined,
    date: d.date || undefined,
    objectives: d.objectives.trim() || undefined,
    activities: d.activities.trim() || undefined,
    resourcesNote: d.resourcesNote.trim() || undefined,
  })

  const add = () => {
    if (!draft.title.trim()) return
    lessonPlansCol.add({ ...toPayload(draft), createdAt: new Date().toISOString() })
    setDraft(emptyDraft)
  }

  const openEdit = (p: LessonPlan) => {
    setOpenId(p.id)
    setEdit({
      title: p.title,
      classId: p.classId ?? '',
      topicId: p.topicId ?? '',
      date: p.date ?? '',
      objectives: p.objectives ?? '',
      activities: p.activities ?? '',
      resourcesNote: p.resourcesNote ?? '',
    })
  }

  const toggle = (p: LessonPlan) => (openId === p.id ? setOpenId(null) : openEdit(p))

  const save = (id: string) => {
    if (!edit.title.trim()) return
    lessonPlansCol.update(id, toPayload(edit))
    setOpenId(null)
  }

  const remove = (id: string) => {
    lessonPlansCol.remove(id)
    if (openId === id) setOpenId(null)
  }

  return (
    <div className="space-y-4">
      {/* 新增教案 */}
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-sm font-semibold text-slate-800">新增教案</div>
        <input
          value={draft.title}
          onChange={(e) => setDraftField('title', e.target.value)}
          placeholder="教案標題（必填，如：香港營商環境導論）"
          className={inputCls}
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <select
            value={draft.classId}
            onChange={(e) => setDraftField('classId', e.target.value)}
            className={inputCls}
          >
            <option value="">未指定班別</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={draft.topicId}
            onChange={(e) => setDraftField('topicId', e.target.value)}
            className={inputCls}
          >
            <option value="">未指定課題</option>
            {sortedTopics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.topic}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={draft.date}
            onChange={(e) => setDraftField('date', e.target.value)}
            className={inputCls}
          />
        </div>
        <textarea
          value={draft.objectives}
          onChange={(e) => setDraftField('objectives', e.target.value)}
          placeholder="教學目標"
          rows={3}
          className={inputCls}
        />
        <textarea
          value={draft.activities}
          onChange={(e) => setDraftField('activities', e.target.value)}
          placeholder="教學流程 / 活動"
          rows={4}
          className={inputCls}
        />
        <textarea
          value={draft.resourcesNote}
          onChange={(e) => setDraftField('resourcesNote', e.target.value)}
          placeholder="教材備註"
          rows={2}
          className={inputCls}
        />
        <button
          onClick={add}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-strong focus:outline-none focus:ring-2 focus:ring-accent/30"
        >
          加入
        </button>
      </div>

      {/* 篩選 */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <select
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
          className={inputCls}
        >
          <option value="">全部班別</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={filterTopic}
          onChange={(e) => setFilterTopic(e.target.value)}
          className={inputCls}
        >
          <option value="">全部課題</option>
          {sortedTopics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.topic}
            </option>
          ))}
        </select>
      </div>

      {/* 教案列表 */}
      <ul className="space-y-2">
        {visible.length === 0 && (
          <li className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-6 text-center text-sm text-slate-400">
            暫無教案，請於上方新增。
          </li>
        )}
        {visible.map((p) => {
          const open = openId === p.id
          return (
            <li key={p.id} className="rounded-xl border border-slate-200 bg-white">
              <div className="flex items-start justify-between gap-3 px-3 py-2">
                <button onClick={() => toggle(p)} className="flex-1 text-left">
                  <div className="text-sm font-semibold text-slate-800">{p.title}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                    {p.classId && (
                      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-accent-strong">
                        {className(p.classId)}
                      </span>
                    )}
                    {p.topicId && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">
                        {topicName(p.topicId)}
                      </span>
                    )}
                    {p.date && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">
                        {p.date}
                      </span>
                    )}
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    onClick={() => toggle(p)}
                    className="text-xs text-slate-400 transition hover:text-accent"
                  >
                    {open ? '收起' : '編輯'}
                  </button>
                  <button
                    onClick={() => remove(p.id)}
                    className="text-xs text-slate-400 transition hover:text-rose-500"
                  >
                    刪除
                  </button>
                </div>
              </div>

              {open && (
                <div className="space-y-3 border-t border-slate-100 px-3 py-3">
                  <input
                    value={edit.title}
                    onChange={(e) => setEditField('title', e.target.value)}
                    placeholder="教案標題（必填）"
                    className={inputCls}
                  />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <select
                      value={edit.classId}
                      onChange={(e) => setEditField('classId', e.target.value)}
                      className={inputCls}
                    >
                      <option value="">未指定班別</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={edit.topicId}
                      onChange={(e) => setEditField('topicId', e.target.value)}
                      className={inputCls}
                    >
                      <option value="">未指定課題</option>
                      {sortedTopics.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.topic}
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={edit.date}
                      onChange={(e) => setEditField('date', e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <textarea
                    value={edit.objectives}
                    onChange={(e) => setEditField('objectives', e.target.value)}
                    placeholder="教學目標"
                    rows={3}
                    className={inputCls}
                  />
                  <textarea
                    value={edit.activities}
                    onChange={(e) => setEditField('activities', e.target.value)}
                    placeholder="教學流程 / 活動"
                    rows={4}
                    className={inputCls}
                  />
                  <textarea
                    value={edit.resourcesNote}
                    onChange={(e) => setEditField('resourcesNote', e.target.value)}
                    placeholder="教材備註"
                    rows={2}
                    className={inputCls}
                  />
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => save(p.id)}
                      className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-strong focus:outline-none focus:ring-2 focus:ring-accent/30"
                    >
                      儲存
                    </button>
                    <button
                      onClick={() => setOpenId(null)}
                      className="text-xs text-slate-400 transition hover:text-slate-600"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
