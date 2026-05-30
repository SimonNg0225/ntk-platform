import { useMemo, useState } from 'react';
import { useCollection } from '../../lib/store';
import { lessonPlansCol, classesCol, topicsCol } from '../../data/collections';
import type { LessonPlan } from '../../data/types';

type ClassItem = { id: string; name: string; subject: string };
type TopicItem = { id: string; part: string; area: string; topic: string; order: number };

type DraftForm = {
  title: string;
  classId: string;
  topicId: string;
  date: string;
  objectives: string;
  activities: string;
  resourcesNote: string;
};

const emptyForm: DraftForm = {
  title: '',
  classId: '',
  topicId: '',
  date: '',
  objectives: '',
  activities: '',
  resourcesNote: '',
};

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30';
const labelClass = 'mb-1 block text-sm font-medium text-slate-700';

function formatDate(date?: string): string {
  if (!date) return '未定日期';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('zh-HK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

export default function LessonPlanner() {
  const plans = useCollection(lessonPlansCol) as LessonPlan[];
  const classes = useCollection(classesCol) as ClassItem[];
  const topics = useCollection(topicsCol) as TopicItem[];

  const [form, setForm] = useState<DraftForm>(emptyForm);
  const [titleError, setTitleError] = useState(false);

  const [filterClassId, setFilterClassId] = useState('');
  const [filterTopicId, setFilterTopicId] = useState('');

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<DraftForm>(emptyForm);

  const classNameById = useMemo(() => {
    const map = new Map<string, string>();
    classes.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [classes]);

  const topicNameById = useMemo(() => {
    const map = new Map<string, string>();
    topics.forEach((t) => map.set(t.id, t.topic));
    return map;
  }, [topics]);

  const sortedTopics = useMemo(
    () => [...topics].sort((a, b) => a.order - b.order),
    [topics],
  );

  const filteredPlans = useMemo(() => {
    return plans
      .filter((p) => (filterClassId ? p.classId === filterClassId : true))
      .filter((p) => (filterTopicId ? p.topicId === filterTopicId : true))
      .slice()
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  }, [plans, filterClassId, filterTopicId]);

  function updateForm(patch: Partial<DraftForm>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function handleCreate() {
    const title = form.title.trim();
    if (!title) {
      setTitleError(true);
      return;
    }
    lessonPlansCol.add({
      title,
      classId: form.classId || undefined,
      topicId: form.topicId || undefined,
      date: form.date || undefined,
      objectives: form.objectives.trim() || undefined,
      activities: form.activities.trim() || undefined,
      resourcesNote: form.resourcesNote.trim() || undefined,
      createdAt: new Date().toISOString(),
    });
    setForm(emptyForm);
    setTitleError(false);
  }

  function startEdit(plan: LessonPlan) {
    setEditingId(plan.id);
    setExpandedId(plan.id);
    setEditForm({
      title: plan.title ?? '',
      classId: plan.classId ?? '',
      topicId: plan.topicId ?? '',
      date: plan.date ?? '',
      objectives: plan.objectives ?? '',
      activities: plan.activities ?? '',
      resourcesNote: plan.resourcesNote ?? '',
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(emptyForm);
  }

  function saveEdit(id: string) {
    const title = editForm.title.trim();
    if (!title) return;
    lessonPlansCol.update(id, {
      title,
      classId: editForm.classId || undefined,
      topicId: editForm.topicId || undefined,
      date: editForm.date || undefined,
      objectives: editForm.objectives.trim() || undefined,
      activities: editForm.activities.trim() || undefined,
      resourcesNote: editForm.resourcesNote.trim() || undefined,
    });
    setEditingId(null);
    setEditForm(emptyForm);
  }

  function removePlan(id: string) {
    lessonPlansCol.remove(id);
    if (expandedId === id) setExpandedId(null);
    if (editingId === id) cancelEdit();
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">備課 / 教案</h1>
        <p className="mt-1 text-sm text-slate-500">
          為 BAFS 課堂編排教學目標、教學流程及教材備註。
        </p>
      </header>

      {/* 新增教案 */}
      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">新增教案</h2>

        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className={labelClass} htmlFor="lp-title">
              教案標題 <span className="text-accent-strong">*</span>
            </label>
            <input
              id="lp-title"
              type="text"
              className={inputClass}
              placeholder="例如：成本會計入門"
              value={form.title}
              onChange={(e) => {
                updateForm({ title: e.target.value });
                if (titleError) setTitleError(false);
              }}
            />
            {titleError && (
              <p className="mt-1 text-sm text-rose-600">請輸入教案標題。</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className={labelClass} htmlFor="lp-class">
                班別
              </label>
              <select
                id="lp-class"
                className={inputClass}
                value={form.classId}
                onChange={(e) => updateForm({ classId: e.target.value })}
              >
                <option value="">不指定</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass} htmlFor="lp-topic">
                課題
              </label>
              <select
                id="lp-topic"
                className={inputClass}
                value={form.topicId}
                onChange={(e) => updateForm({ topicId: e.target.value })}
              >
                <option value="">不指定</option>
                {sortedTopics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.topic}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass} htmlFor="lp-date">
                日期
              </label>
              <input
                id="lp-date"
                type="date"
                className={inputClass}
                value={form.date}
                onChange={(e) => updateForm({ date: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="lp-objectives">
              教學目標
            </label>
            <textarea
              id="lp-objectives"
              rows={3}
              className={inputClass}
              placeholder="學生能夠……"
              value={form.objectives}
              onChange={(e) => updateForm({ objectives: e.target.value })}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="lp-activities">
              教學流程 / 活動
            </label>
            <textarea
              id="lp-activities"
              rows={4}
              className={inputClass}
              placeholder="引入、講解、小組活動、總結……"
              value={form.activities}
              onChange={(e) => updateForm({ activities: e.target.value })}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="lp-resources">
              教材備註
            </label>
            <textarea
              id="lp-resources"
              rows={2}
              className={inputClass}
              placeholder="工作紙、簡報、影片連結……"
              value={form.resourcesNote}
              onChange={(e) => updateForm({ resourcesNote: e.target.value })}
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleCreate}
              className="rounded-xl bg-accent px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-strong focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              新增教案
            </button>
          </div>
        </div>
      </section>

      {/* 篩選 */}
      <section className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className={labelClass} htmlFor="lp-filter-class">
            按班別篩選
          </label>
          <select
            id="lp-filter-class"
            className={inputClass}
            value={filterClassId}
            onChange={(e) => setFilterClassId(e.target.value)}
          >
            <option value="">全部班別</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className={labelClass} htmlFor="lp-filter-topic">
            按課題篩選
          </label>
          <select
            id="lp-filter-topic"
            className={inputClass}
            value={filterTopicId}
            onChange={(e) => setFilterTopicId(e.target.value)}
          >
            <option value="">全部課題</option>
            {sortedTopics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.topic}
              </option>
            ))}
          </select>
        </div>
        {(filterClassId || filterTopicId) && (
          <button
            type="button"
            onClick={() => {
              setFilterClassId('');
              setFilterTopicId('');
            }}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent/30"
          >
            清除篩選
          </button>
        )}
      </section>

      {/* 列表 */}
      <section className="space-y-3">
        {filteredPlans.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
            未有教案。請於上方新增第一份教案。
          </div>
        ) : (
          filteredPlans.map((plan) => {
            const isExpanded = expandedId === plan.id;
            const isEditing = editingId === plan.id;
            const className = plan.classId ? classNameById.get(plan.classId) : undefined;
            const topicName = plan.topicId ? topicNameById.get(plan.topicId) : undefined;

            return (
              <article
                key={plan.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : plan.id)}
                  className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left sm:px-5"
                >
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-slate-900">
                      {plan.title}
                    </h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                      {className && (
                        <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent-strong">
                          {className}
                        </span>
                      )}
                      {topicName && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                          {topicName}
                        </span>
                      )}
                      <span className="text-slate-400">{formatDate(plan.date)}</span>
                    </div>
                  </div>
                  <span
                    className={`mt-1 shrink-0 text-accent transition-transform ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  >
                    ▾
                  </span>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100 px-4 py-4 sm:px-5">
                    {isEditing ? (
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <label className={labelClass}>教案標題</label>
                          <input
                            type="text"
                            className={inputClass}
                            value={editForm.title}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, title: e.target.value }))
                            }
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                          <div>
                            <label className={labelClass}>班別</label>
                            <select
                              className={inputClass}
                              value={editForm.classId}
                              onChange={(e) =>
                                setEditForm((p) => ({ ...p, classId: e.target.value }))
                              }
                            >
                              <option value="">不指定</option>
                              {classes.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className={labelClass}>課題</label>
                            <select
                              className={inputClass}
                              value={editForm.topicId}
                              onChange={(e) =>
                                setEditForm((p) => ({ ...p, topicId: e.target.value }))
                              }
                            >
                              <option value="">不指定</option>
                              {sortedTopics.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.topic}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className={labelClass}>日期</label>
                            <input
                              type="date"
                              className={inputClass}
                              value={editForm.date}
                              onChange={(e) =>
                                setEditForm((p) => ({ ...p, date: e.target.value }))
                              }
                            />
                          </div>
                        </div>

                        <div>
                          <label className={labelClass}>教學目標</label>
                          <textarea
                            rows={3}
                            className={inputClass}
                            value={editForm.objectives}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, objectives: e.target.value }))
                            }
                          />
                        </div>
                        <div>
                          <label className={labelClass}>教學流程 / 活動</label>
                          <textarea
                            rows={4}
                            className={inputClass}
                            value={editForm.activities}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, activities: e.target.value }))
                            }
                          />
                        </div>
                        <div>
                          <label className={labelClass}>教材備註</label>
                          <textarea
                            rows={2}
                            className={inputClass}
                            value={editForm.resourcesNote}
                            onChange={(e) =>
                              setEditForm((p) => ({
                                ...p,
                                resourcesNote: e.target.value,
                              }))
                            }
                          />
                        </div>

                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent/30"
                          >
                            取消
                          </button>
                          <button
                            type="button"
                            onClick={() => saveEdit(plan.id)}
                            disabled={!editForm.title.trim()}
                            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-strong focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            儲存
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <DetailBlock label="教學目標" value={plan.objectives} />
                        <DetailBlock label="教學流程 / 活動" value={plan.activities} />
                        <DetailBlock label="教材備註" value={plan.resourcesNote} />

                        <div className="flex flex-wrap justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => startEdit(plan)}
                            className="rounded-xl bg-accent-soft px-4 py-2 text-sm font-medium text-accent-strong transition-colors hover:bg-accent hover:text-white focus:outline-none focus:ring-2 focus:ring-accent/30"
                          >
                            編輯
                          </button>
                          <button
                            type="button"
                            onClick={() => removePlan(plan.id)}
                            className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-300/40"
                          >
                            刪除
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}

function DetailBlock({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </h4>
      {value && value.trim() ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
          {value}
        </p>
      ) : (
        <p className="text-sm italic text-slate-300">未填寫</p>
      )}
    </div>
  );
}
