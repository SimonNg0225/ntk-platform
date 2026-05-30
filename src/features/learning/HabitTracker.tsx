import { useMemo, useState } from 'react';
import { useCollection } from '../../lib/store';
import { habitsCol, habitLogsCol } from '../../data/collections';
import type { Habit, HabitLog } from '../../data/types';

const ICON_CHOICES = ['🏃', '📚', '💧', '🧘', '🥗', '😴', '✍️', '🎯'];

/** 由今日起回推 n 日，回傳 YYYY-MM-DD 字串陣列（由舊到新）。 */
function recentDates(days: number): string[] {
  const today = new Date();
  const result: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    result.push(d.toISOString().slice(0, 10));
  }
  return result;
}

/** 由某日標籤（星期幾）。 */
function weekdayLabel(dateStr: string): string {
  const labels = ['日', '一', '二', '三', '四', '五', '六'];
  return labels[new Date(`${dateStr}T00:00:00`).getDay()];
}

/** 計算由今日起連續完成嘅日數。 */
function calcStreak(loggedDates: Set<string>): number {
  let streak = 0;
  const cursor = new Date();
  // 若今日未完成，由琴日開始計（保留琴日嘅 streak）。
  if (!loggedDates.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (loggedDates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export default function HabitTracker() {
  const habits = useCollection<Habit>(habitsCol);
  const logs = useCollection<HabitLog>(habitLogsCol);

  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>(ICON_CHOICES[0]);

  const today = new Date().toISOString().slice(0, 10);
  const days = useMemo(() => recentDates(7), []);

  // 以 habitId 分組 logs，方便查 / 取 logId。
  const logsByHabit = useMemo(() => {
    const map = new Map<string, Map<string, string>>();
    for (const log of logs) {
      let inner = map.get(log.habitId);
      if (!inner) {
        inner = new Map<string, string>();
        map.set(log.habitId, inner);
      }
      inner.set(log.date, log.id);
    }
    return map;
  }, [logs]);

  function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) return;
    habitsCol.add({
      name: trimmed,
      icon,
      createdAt: new Date().toISOString(),
    });
    setName('');
    setIcon(ICON_CHOICES[0]);
  }

  function toggleLog(habitId: string, date: string) {
    const existingId = logsByHabit.get(habitId)?.get(date);
    if (existingId) {
      habitLogsCol.remove(existingId);
    } else {
      habitLogsCol.add({ habitId, date });
    }
  }

  function handleDelete(habitId: string) {
    const inner = logsByHabit.get(habitId);
    if (inner) {
      for (const logId of inner.values()) {
        habitLogsCol.remove(logId);
      }
    }
    habitsCol.remove(habitId);
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">習慣追蹤</h1>
        <p className="text-sm text-slate-500">建立每日習慣，撳格仔打卡，保持連續記錄。</p>
      </header>

      {/* 新增習慣 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">新增習慣</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
            placeholder="例如：每日跑步"
            className="w-full flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!name.trim()}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-strong focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            新增
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {ICON_CHOICES.map((choice) => {
            const selected = choice === icon;
            return (
              <button
                key={choice}
                type="button"
                onClick={() => setIcon(choice)}
                aria-pressed={selected}
                className={[
                  'flex h-9 w-9 items-center justify-center rounded-xl border text-lg transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30',
                  selected
                    ? 'border-accent bg-accent-soft text-accent-strong'
                    : 'border-slate-200 bg-white hover:bg-slate-50',
                ].join(' ')}
              >
                {choice}
              </button>
            );
          })}
        </div>
      </section>

      {/* 習慣列表 */}
      <section className="space-y-3">
        {habits.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
            仲未有習慣，喺上面新增一個啦。
          </div>
        ) : (
          habits.map((habit) => {
            const inner = logsByHabit.get(habit.id);
            const loggedDates = new Set<string>(inner ? Array.from(inner.keys()) : []);
            const streak = calcStreak(loggedDates);
            const doneToday = loggedDates.has(today);

            return (
              <article
                key={habit.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-xl">
                      {habit.icon ?? '⭐'}
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-slate-900">
                        {habit.name}
                      </h3>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-medium text-accent-strong">
                          連續 {streak} 日
                        </span>
                        <span
                          className={
                            doneToday ? 'text-accent-strong' : 'text-slate-400'
                          }
                        >
                          {doneToday ? '今日已完成' : '今日未完成'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(habit.id)}
                    aria-label={`刪除習慣 ${habit.name}`}
                    className="shrink-0 rounded-xl border border-slate-200 px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent/30"
                  >
                    刪除
                  </button>
                </div>

                {/* 最近 7 日打卡格 */}
                <div className="mt-4 flex justify-between gap-1.5 sm:gap-2">
                  {days.map((date) => {
                    const done = loggedDates.has(date);
                    const isToday = date === today;
                    return (
                      <div key={date} className="flex flex-1 flex-col items-center gap-1">
                        <span className="text-[11px] text-slate-400">
                          {weekdayLabel(date)}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleLog(habit.id, date)}
                          aria-pressed={done}
                          aria-label={`${date} ${done ? '已完成' : '未完成'}`}
                          className={[
                            'aspect-square w-full rounded-xl text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30',
                            done
                              ? 'bg-accent text-white hover:bg-accent-strong'
                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200',
                            isToday ? 'ring-2 ring-accent/30' : '',
                          ].join(' ')}
                        >
                          {done ? '✓' : ''}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
