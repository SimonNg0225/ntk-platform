import { useMemo, useState } from 'react';
import { useCollection } from '../../lib/store';
import { habitsCol, habitLogsCol } from '../../data/collections';
import type { Habit, HabitLog } from '../../data/types';
import {
  Button,
  Input,
  Card,
  Badge,
  SectionTitle,
  EmptyState,
  StatCard,
  IconButton,
} from '../../ui';

const ICON_CHOICES = ['🏃', '📚', '💧', '🧘', '🥗', '😴', '✍️', '🎯'];

// 最近迷你格日數：手機 7 日、闊屏 14 日（用 CSS 控制顯示）。
const TIMELINE_DAYS = 14;

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
  const days = useMemo(() => recentDates(TIMELINE_DAYS), []);

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

  // 頂部統計：總數、今日完成、最長 streak。
  const stats = useMemo(() => {
    let doneToday = 0;
    let maxStreak = 0;
    for (const habit of habits) {
      const inner = logsByHabit.get(habit.id);
      const loggedDates = new Set<string>(inner ? Array.from(inner.keys()) : []);
      if (loggedDates.has(today)) doneToday += 1;
      const streak = calcStreak(loggedDates);
      if (streak > maxStreak) maxStreak = streak;
    }
    return { total: habits.length, doneToday, maxStreak };
  }, [habits, logsByHabit, today]);

  const completionRate =
    stats.total > 0 ? Math.round((stats.doneToday / stats.total) * 100) : 0;
  const allDone = stats.total > 0 && stats.doneToday === stats.total;

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

      {/* 頂部統計 */}
      <section className="grid grid-cols-3 gap-3">
        <StatCard label="習慣總數" value={stats.total} unit="個" icon="📋" />
        <StatCard
          label="今日完成"
          value={`${stats.doneToday}/${stats.total}`}
          icon="✅"
          highlight={allDone}
        />
        <StatCard label="最長連續" value={stats.maxStreak} unit="日" icon="🔥" />
      </section>

      {/* 今日總完成率 */}
      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">今日總完成率</span>
          <Badge tone={allDone ? 'green' : 'accent'}>{completionRate}%</Badge>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${completionRate}%` }}
          />
        </div>
        {allDone ? (
          <p className="mt-2 text-sm font-medium text-emerald-600">今日全部完成 🎉 好嘢，keep it up！</p>
        ) : stats.total > 0 ? (
          <p className="mt-2 text-xs text-slate-400">
            仲差 {stats.total - stats.doneToday} 個就完成今日所有習慣。
          </p>
        ) : null}
      </Card>

      {/* 新增習慣 */}
      <Card className="p-4">
        <SectionTitle>新增習慣</SectionTitle>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
            placeholder="例如：每日跑步"
            className="flex-1"
          />
          <Button type="button" onClick={handleAdd} disabled={!name.trim()}>
            新增
          </Button>
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
                  'flex h-9 w-9 items-center justify-center rounded-xl border text-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
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
      </Card>

      {/* 習慣列表 */}
      <section className="space-y-3">
        <SectionTitle>我的習慣</SectionTitle>
        {habits.length === 0 ? (
          <EmptyState
            icon="🌱"
            title="仲未有習慣"
            hint="喺上面新增一個習慣，揀返個 emoji，每日撳格仔打卡。"
          />
        ) : (
          habits.map((habit) => {
            const inner = logsByHabit.get(habit.id);
            const loggedDates = new Set<string>(inner ? Array.from(inner.keys()) : []);
            const streak = calcStreak(loggedDates);
            const doneToday = loggedDates.has(today);

            return (
              <Card key={habit.id} className="p-4" hover>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-xl">
                      {habit.icon ?? '⭐'}
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-slate-900">
                        {habit.name}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge tone={streak > 0 ? 'amber' : 'slate'}>
                          🔥 {streak} 日
                        </Badge>
                        {doneToday ? (
                          <Badge tone="green">今日已完成</Badge>
                        ) : (
                          <Badge tone="slate">今日未完成</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <IconButton
                    label={`刪除習慣 ${habit.name}`}
                    onClick={() => handleDelete(habit.id)}
                    className="shrink-0 hover:text-rose-600"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M6 7h12M9 7V5h6v2M7 7l1 12h8l1-12"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </IconButton>
                </div>

                {/* 最近打卡格：手機顯示尾 7 日、sm 以上顯示全 14 日 */}
                <div className="mt-4 flex gap-1.5">
                  {days.map((date, idx) => {
                    const done = loggedDates.has(date);
                    const isToday = date === today;
                    // 頭 7 日（idx < 7）喺手機隱藏，避免擠迫。
                    const hideOnMobile = idx < TIMELINE_DAYS - 7;
                    return (
                      <div
                        key={date}
                        className={[
                          'flex flex-1 flex-col items-center gap-1',
                          hideOnMobile ? 'hidden sm:flex' : 'flex',
                        ].join(' ')}
                      >
                        <span className="text-[10px] text-slate-400">
                          {weekdayLabel(date)}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleLog(habit.id, date)}
                          aria-pressed={done}
                          aria-label={`${date} ${done ? '已完成' : '未完成'}`}
                          className={[
                            'aspect-square w-full rounded-lg text-[11px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                            done
                              ? 'bg-accent text-white hover:bg-accent-strong'
                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200',
                            isToday ? 'ring-2 ring-accent/40 ring-offset-1' : '',
                          ].join(' ')}
                        >
                          {done ? '✓' : ''}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })
        )}
      </section>
    </div>
  );
}
