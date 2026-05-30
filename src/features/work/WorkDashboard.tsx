import { useMemo } from 'react';
import { useCollection } from '../../lib/store';
import {
  tasksCol,
  timetableCol,
  classesCol,
  eventsCol,
  parentCommsCol,
  progressCol,
  topicsCol,
} from '../../data/collections';
import { useNav } from '../../context/NavContext';

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-2xl font-semibold text-slate-900">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
    </div>
  );
}

export default function WorkDashboard() {
  const nav = useNav();
  const tasks = useCollection(tasksCol);
  const timetable = useCollection(timetableCol);
  const classes = useCollection(classesCol);
  const events = useCollection(eventsCol);
  const parentComms = useCollection(parentCommsCol);
  const progress = useCollection(progressCol);
  const topics = useCollection(topicsCol);

  const today = new Date().toISOString().slice(0, 10);
  const jsDay = new Date().getDay(); // 0=日 .. 6=六

  const open = (key: string) => nav?.open(key);

  const classNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const k of classes) map.set(k.id, k.name);
    return map;
  }, [classes]);

  const openTasks = useMemo(() => tasks.filter((t) => !t.done), [tasks]);

  const todaySlots = useMemo(
    () =>
      timetable
        .filter((s) => s.day === jsDay)
        .slice()
        .sort((a, b) => a.period - b.period),
    [timetable, jsDay]
  );

  const followUpCount = useMemo(
    () => parentComms.filter((c) => c.followUp === true).length,
    [parentComms]
  );

  const upcomingEventsCount = useMemo(() => {
    const start = new Date(today);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const endStr = end.toISOString().slice(0, 10);
    return events.filter((e) => e.date >= today && e.date <= endStr).length;
  }, [events, today]);

  const classProgress = useMemo(() => {
    const totalTopics = topics.length;
    return classes.map((k) => {
      const rows = progress.filter((p) => p.classId === k.id);
      const done = rows.filter((p) => p.status === 'done').length;
      const total = totalTopics || rows.length;
      const percent = total > 0 ? Math.round((done / total) * 100) : 0;
      return { id: k.id, name: k.name, done, total, percent };
    });
  }, [classes, progress, topics]);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold text-slate-900">工作儀表板</h2>
        <p className="mt-1 text-sm text-slate-500">
          今日（星期{WEEKDAY_LABELS[jsDay]}）工作一覽
        </p>
      </header>

      {/* 統計卡 */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="未完成待辦" value={openTasks.length} />
        <StatCard label="今日課堂節數" value={todaySlots.length} />
        <StatCard label="待跟進家長" value={followUpCount} />
        <StatCard label="未來 7 日事件" value={upcomingEventsCount} />
      </section>

      {/* 今日課堂 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold text-slate-900">今日課堂</h3>
        {jsDay === 0 ? (
          <p className="mt-3 text-sm text-slate-500">星期日休息，今日無堂。</p>
        ) : todaySlots.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">今日未有課堂安排。</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {todaySlots.map((slot) => {
              const label = slot.classId
                ? classNameById.get(slot.classId) ?? slot.subject
                : slot.subject;
              return (
                <li
                  key={slot.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-accent-soft text-sm font-semibold text-accent-strong">
                    {slot.period}
                  </span>
                  <span className="flex-1 text-sm font-medium text-slate-800">
                    {label}
                  </span>
                  {slot.room ? (
                    <span className="text-xs text-slate-500">{slot.room}</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 未完成待辦 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">未完成待辦</h3>
          <button
            type="button"
            onClick={() => open('work-tasks')}
            className="text-sm font-medium text-accent hover:text-accent-strong focus:outline-none focus:ring-2 focus:ring-accent/30 rounded"
          >
            查看全部
          </button>
        </div>
        {openTasks.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">沒有未完成待辦，做得好！</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {openTasks.slice(0, 5).map((task) => (
              <li
                key={task.id}
                className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-800"
              >
                <span className="h-2 w-2 flex-none rounded-full bg-accent" />
                {task.text}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 各班課程進度 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold text-slate-900">各班課程進度</h3>
        {classProgress.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">未有班別資料。</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {classProgress.map((cp) => (
              <li key={cp.id}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-800">{cp.name}</span>
                  <span className="text-slate-500">
                    {cp.done}/{cp.total}（{cp.percent}%）
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${cp.percent}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 快速動作 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold text-slate-900">快速動作</h3>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { key: 'work-tasks', label: '待辦事項' },
            { key: 'work-attendance', label: '點名考勤' },
            { key: 'work-timetable', label: '時間表' },
            { key: 'calendar', label: '行事曆' },
          ].map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={() => open(action.key)}
              className="rounded-2xl bg-accent px-4 py-3 text-sm font-medium text-white hover:bg-accent-strong focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              {action.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
