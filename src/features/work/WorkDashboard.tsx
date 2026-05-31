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
import { useToast } from '../../context/ToastContext';
import {
  Button,
  Card,
  Badge,
  SectionTitle,
  EmptyState,
  StatCard,
  ProgressBar,
  IconButton,
} from '../../ui';
import {
  NotebookPen,
  BookMarked,
  Phone,
  Calendar,
  CalendarDays,
  CheckSquare,
  Palmtree,
  PartyPopper,
  School,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

function greeting(hour: number): string {
  if (hour < 12) return '早晨';
  if (hour < 18) return '午安';
  return '晚安';
}

export default function WorkDashboard() {
  const { open } = useNav();
  const toast = useToast();
  const tasks = useCollection(tasksCol);
  const timetable = useCollection(timetableCol);
  const classes = useCollection(classesCol);
  const events = useCollection(eventsCol);
  const parentComms = useCollection(parentCommsCol);
  const progress = useCollection(progressCol);
  const topics = useCollection(topicsCol);

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const jsDay = now.getDay(); // 0=日 .. 6=六
  const dateLabel = `${now.getMonth() + 1}月${now.getDate()}日 星期${WEEKDAY_LABELS[jsDay]}`;
  const hello = greeting(now.getHours());

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

  // 下一堂：第一個未開始嘅節（用 period 對應時間概略；無法判斷就標示第一堂）
  const nextSlotId = useMemo(() => {
    if (todaySlots.length === 0) return null;
    const currentPeriod = Math.max(1, Math.ceil((now.getHours() - 8) / 1.5));
    const upcoming = todaySlots.find((s) => s.period >= currentPeriod);
    return (upcoming ?? todaySlots[0]).id;
  }, [todaySlots, now]);

  const followUpCount = useMemo(
    () => parentComms.filter((c) => c.followUp === true).length,
    [parentComms]
  );

  const upcomingEventsCount = useMemo(() => {
    const end = new Date(today);
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
      {/* 問候語 + 日期 */}
      <header>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{hello}！</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{dateLabel}</p>
      </header>

      {/* 統計卡 */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="未完成待辦"
          value={openTasks.length}
          icon={NotebookPen}
          onClick={() => open('work-tasks')}
        />
        <StatCard
          label="今日課堂節數"
          value={todaySlots.length}
          icon={BookMarked}
          onClick={() => open('work-timetable')}
        />
        <StatCard
          label="待跟進家長"
          value={followUpCount}
          icon={Phone}
          highlight={followUpCount > 0}
          onClick={() => open('calendar')}
        />
        <StatCard
          label="未來 7 日事件"
          value={upcomingEventsCount}
          icon={Calendar}
          onClick={() => open('calendar')}
        />
      </section>

      {/* 今日課堂 */}
      <section>
        <SectionTitle right={<Badge tone="accent">星期{WEEKDAY_LABELS[jsDay]}</Badge>}>
          今日課堂
        </SectionTitle>
        {jsDay === 0 ? (
          <EmptyState icon={Palmtree} title="星期日休息" hint="今日無堂，好好抖一抖。" />
        ) : todaySlots.length === 0 ? (
          <EmptyState
            icon={BookMarked}
            title="今日未有課堂安排"
            hint="可以去時間表設定上課節數。"
            action={
              <Button size="sm" variant="secondary" onClick={() => open('work-timetable')}>
                前往時間表
              </Button>
            }
          />
        ) : (
          <ul className="space-y-2">
            {todaySlots.map((slot) => {
              const label = slot.classId
                ? classNameById.get(slot.classId) ?? slot.subject
                : slot.subject;
              const isNext = slot.id === nextSlotId;
              return (
                <li key={slot.id}>
                  <Card
                    className={
                      isNext
                        ? 'flex items-center gap-3 border-accent/40 bg-accent-soft p-3'
                        : 'flex items-center gap-3 p-3'
                    }
                  >
                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-accent-soft text-sm font-semibold tabular-nums text-accent-strong">
                      {slot.period}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                          {label}
                        </span>
                        {isNext && <Badge tone="accent">下一堂</Badge>}
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{slot.subject}</span>
                    </div>
                    {slot.room ? <Badge tone="slate">{slot.room}</Badge> : null}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 未完成待辦 */}
      <section>
        <SectionTitle
          right={
            <Button size="sm" variant="ghost" onClick={() => open('work-tasks')}>
              查看全部
            </Button>
          }
        >
          未完成待辦
        </SectionTitle>
        {openTasks.length === 0 ? (
          <EmptyState icon={PartyPopper} title="沒有未完成待辦" hint="做得好，全部清晒！" />
        ) : (
          <ul className="space-y-2">
            {openTasks.slice(0, 5).map((task) => (
              <li key={task.id}>
                <Card className="flex items-center gap-3 p-3">
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={() => {
                      tasksCol.update(task.id, { done: true });
                      toast.success('已完成待辦');
                    }}
                    aria-label={`完成：${task.text}`}
                    className="h-4 w-4 flex-none cursor-pointer rounded border-slate-300 text-accent focus:ring-accent/30 dark:border-slate-600"
                  />
                  <span className="flex-1 text-sm text-slate-800 dark:text-slate-100">{task.text}</span>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 各班課程進度 */}
      <section>
        <SectionTitle>各班課程進度</SectionTitle>
        {classProgress.length === 0 ? (
          <EmptyState icon={School} title="未有班別資料" hint="加入班別後即可追蹤進度。" />
        ) : (
          <Card className="space-y-4 p-4">
            {classProgress.map((cp) => (
              <div key={cp.id}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-800 dark:text-slate-100">{cp.name}</span>
                  <span className="tabular-nums text-slate-500 dark:text-slate-400">
                    {cp.done}/{cp.total}（{cp.percent}%）
                  </span>
                </div>
                <ProgressBar value={cp.percent} />
              </div>
            ))}
          </Card>
        )}
      </section>

      {/* 快速動作 */}
      <section>
        <SectionTitle>快速動作</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([
            { key: 'work-tasks', label: '待辦事項', icon: NotebookPen },
            { key: 'work-attendance', label: '點名考勤', icon: CheckSquare },
            { key: 'work-timetable', label: '時間表', icon: CalendarDays },
            { key: 'calendar', label: '行事曆', icon: Calendar },
          ] as { key: string; label: string; icon: LucideIcon }[]).map((action) => (
            <Card
              key={action.key}
              hover
              onClick={() => open(action.key)}
              className="flex flex-col items-center gap-2 p-4 text-center"
            >
              <IconButton label={action.label} onClick={() => open(action.key)}>
                <action.icon size={20} strokeWidth={2} />
              </IconButton>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{action.label}</span>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
