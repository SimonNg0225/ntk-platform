import { useMemo, useState } from 'react';
import { useCollection } from '../../lib/store';
import { attendanceCol, classesCol, studentsCol } from '../../data/collections';
import type { AttendanceRecord, AttendanceStatus } from '../../data/types';

const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: 'present', label: '出席' },
  { value: 'late', label: '遲到' },
  { value: 'absent', label: '缺席' },
];

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: '出席',
  late: '遲到',
  absent: '缺席',
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function Attendance() {
  const classes = useCollection(classesCol);
  const students = useCollection(studentsCol);
  const attendance = useCollection(attendanceCol);

  const [classId, setClassId] = useState<string>('');
  const [date, setDate] = useState<string>(todayStr());

  // 確保有選中的班別（預設第一個）
  const activeClassId = useMemo(() => {
    if (classId && classes.some((c) => c.id === classId)) return classId;
    return classes[0]?.id ?? '';
  }, [classId, classes]);

  const classStudents = useMemo(
    () => students.filter((s) => s.classId === activeClassId),
    [students, activeClassId],
  );

  // 當日該班的記錄索引：studentId -> record
  const recordByStudent = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (const r of attendance) {
      if (r.classId === activeClassId && r.date === date) {
        map.set(r.studentId, r);
      }
    }
    return map;
  }, [attendance, activeClassId, date]);

  const stats = useMemo(() => {
    let present = 0;
    let late = 0;
    let absent = 0;
    for (const s of classStudents) {
      const status = recordByStudent.get(s.id)?.status;
      if (status === 'present') present += 1;
      else if (status === 'late') late += 1;
      else if (status === 'absent') absent += 1;
    }
    return { present, late, absent };
  }, [classStudents, recordByStudent]);

  function mark(studentId: string, status: AttendanceStatus) {
    const existing = recordByStudent.get(studentId);
    if (existing) {
      if (existing.status === status) {
        // 再撳同一個狀態 = 取消標記
        attendanceCol.remove(existing.id);
      } else {
        attendanceCol.update(existing.id, { status });
      }
    } else {
      attendanceCol.add({ classId: activeClassId, studentId, date, status });
    }
  }

  function statusButtonClass(status: AttendanceStatus, active: boolean): string {
    const base =
      'rounded-xl px-3 py-1.5 text-sm font-medium transition focus:outline-none focus:ring-2';
    if (status === 'present') {
      return active
        ? `${base} bg-accent text-white hover:bg-accent-strong focus:ring-accent/30`
        : `${base} bg-accent-soft text-accent-strong hover:bg-accent hover:text-white focus:ring-accent/30`;
    }
    if (status === 'late') {
      return active
        ? `${base} bg-amber-500 text-white hover:bg-amber-600 focus:ring-amber-500/30`
        : `${base} bg-amber-50 text-amber-700 hover:bg-amber-500 hover:text-white focus:ring-amber-500/30`;
    }
    return active
      ? `${base} bg-rose-500 text-white hover:bg-rose-600 focus:ring-rose-500/30`
      : `${base} bg-rose-50 text-rose-700 hover:bg-rose-500 hover:text-white focus:ring-rose-500/30`;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">點名 / 出席</h1>
        <p className="text-sm text-slate-500">選擇班別同日期，為學生標記出席狀態。</p>
      </header>

      {/* 班別選擇 */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-slate-700">班別</h2>
        {classes.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
            未有班別，請先去「班別管理」新增班別。
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {classes.map((c) => {
              const active = c.id === activeClassId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setClassId(c.id)}
                  className={
                    'rounded-full px-4 py-1.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-accent/30 ' +
                    (active
                      ? 'bg-accent text-white hover:bg-accent-strong'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-accent-soft hover:text-accent-strong')
                  }
                >
                  {c.name}
                  {c.subject ? (
                    <span className={active ? 'ml-1 text-white/80' : 'ml-1 text-slate-400'}>
                      · {c.subject}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 日期選擇 */}
      <section className="space-y-2">
        <label htmlFor="attendance-date" className="block text-sm font-medium text-slate-700">
          日期
        </label>
        <input
          id="attendance-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/30 sm:w-auto"
        />
      </section>

      {/* 統計 */}
      {activeClassId && classStudents.length > 0 ? (
        <section className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-accent-soft p-3 text-center">
            <div className="text-2xl font-semibold text-accent-strong">{stats.present}</div>
            <div className="text-xs text-accent-strong">出席</div>
          </div>
          <div className="rounded-2xl bg-amber-50 p-3 text-center">
            <div className="text-2xl font-semibold text-amber-700">{stats.late}</div>
            <div className="text-xs text-amber-700">遲到</div>
          </div>
          <div className="rounded-2xl bg-rose-50 p-3 text-center">
            <div className="text-2xl font-semibold text-rose-700">{stats.absent}</div>
            <div className="text-xs text-rose-700">缺席</div>
          </div>
        </section>
      ) : null}

      {/* 學生名單 */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-slate-700">學生名單</h2>
        {!activeClassId ? null : classStudents.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
            此班別未有學生，請去「班別管理 / 成績管理」加入學生。
          </div>
        ) : (
          <ul className="space-y-2">
            {classStudents.map((s) => {
              const current = recordByStudent.get(s.id)?.status;
              return (
                <li
                  key={s.id}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-900">{s.name}</div>
                    <div className="text-xs text-slate-400">
                      {s.studentNo ? `學號 ${s.studentNo}` : '未有學號'}
                      {current ? ` · ${STATUS_LABEL[current]}` : ' · 未標記'}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => mark(s.id, opt.value)}
                        className={statusButtonClass(opt.value, current === opt.value)}
                        aria-pressed={current === opt.value}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
