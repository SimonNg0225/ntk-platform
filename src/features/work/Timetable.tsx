import { useMemo, useState } from 'react';
import { useCollection } from '../../lib/store';
import { timetableCol, classesCol } from '../../data/collections';
import type { TimetableSlot } from '../../data/types';

const DAYS: { day: number; label: string }[] = [
  { day: 1, label: '星期一' },
  { day: 2, label: '星期二' },
  { day: 3, label: '星期三' },
  { day: 4, label: '星期四' },
  { day: 5, label: '星期五' },
  { day: 6, label: '星期六' },
];

const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

type EditorState = {
  day: number;
  period: number;
  slotId?: string;
  classId: string;
  subject: string;
  room: string;
};

export default function Timetable() {
  const slots = useCollection(timetableCol);
  const classes = useCollection(classesCol);
  const [editor, setEditor] = useState<EditorState | null>(null);

  const slotMap = useMemo(() => {
    const map = new Map<string, TimetableSlot>();
    for (const slot of slots) {
      map.set(`${slot.day}-${slot.period}`, slot);
    }
    return map;
  }, [slots]);

  const classNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const cls of classes) {
      map.set(cls.id, cls.name);
    }
    return map;
  }, [classes]);

  function openCell(day: number, period: number) {
    const existing = slotMap.get(`${day}-${period}`);
    if (existing) {
      setEditor({
        day,
        period,
        slotId: existing.id,
        classId: existing.classId ?? '',
        subject: existing.subject ?? '',
        room: existing.room ?? '',
      });
    } else {
      setEditor({ day, period, classId: '', subject: '', room: '' });
    }
  }

  function closeEditor() {
    setEditor(null);
  }

  function handleSave() {
    if (!editor) return;
    const subject = editor.subject.trim();
    const room = editor.room.trim();
    const classId = editor.classId || undefined;

    if (!subject && !classId) {
      return;
    }

    const payload = {
      day: editor.day,
      period: editor.period,
      classId,
      subject: subject || (classId ? (classNameById.get(classId) ?? '') : ''),
      room: room || undefined,
    };

    if (editor.slotId) {
      timetableCol.update(editor.slotId, payload);
    } else {
      timetableCol.add(payload);
    }
    setEditor(null);
  }

  function handleRemove() {
    if (!editor?.slotId) return;
    timetableCol.remove(editor.slotId);
    setEditor(null);
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">時間表</h1>
        <p className="text-sm text-slate-500">每週教學時間表，撳格子新增或編輯一節課堂。</p>
      </header>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-20 border-b border-slate-200 bg-slate-50 p-3 text-left font-medium text-slate-500">
                節數
              </th>
              {DAYS.map((d) => (
                <th
                  key={d.day}
                  className="border-b border-l border-slate-200 bg-slate-50 p-3 text-center font-medium text-slate-600"
                >
                  {d.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((period) => (
              <tr key={period}>
                <th className="border-b border-slate-200 bg-slate-50 p-3 text-left font-medium text-slate-500">
                  第 {period} 節
                </th>
                {DAYS.map((d) => {
                  const slot = slotMap.get(`${d.day}-${period}`);
                  const className = slot?.classId
                    ? classNameById.get(slot.classId)
                    : undefined;
                  const title = slot?.subject || className || '';
                  return (
                    <td
                      key={d.day}
                      className="border-b border-l border-slate-200 p-1.5 align-top"
                    >
                      <button
                        type="button"
                        onClick={() => openCell(d.day, period)}
                        className={`flex h-20 w-full flex-col items-start justify-start gap-1 rounded-xl border border-transparent p-2 text-left transition focus:outline-none focus:ring-2 focus:ring-accent/30 ${
                          slot
                            ? 'bg-accent-soft hover:bg-accent-soft/80'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        {slot ? (
                          <>
                            <span className="line-clamp-2 text-sm font-medium text-accent-strong">
                              {title}
                            </span>
                            {className && className !== title ? (
                              <span className="text-xs text-slate-500">{className}</span>
                            ) : null}
                            {slot.room ? (
                              <span className="mt-auto text-xs text-slate-500">
                                課室 {slot.room}
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-xs text-slate-300">＋</span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editor ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
          onClick={closeEditor}
        >
          <div
            className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-slate-900">
                {editor.slotId ? '編輯課堂' : '新增課堂'}
              </h2>
              <p className="text-sm text-slate-500">
                {DAYS.find((d) => d.day === editor.day)?.label} · 第 {editor.period} 節
              </p>
            </div>

            <div className="space-y-3">
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">班別（選填）</span>
                <select
                  value={editor.classId}
                  onChange={(e) =>
                    setEditor((prev) => (prev ? { ...prev, classId: e.target.value } : prev))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                >
                  <option value="">未選擇</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">科目</span>
                <input
                  type="text"
                  value={editor.subject}
                  onChange={(e) =>
                    setEditor((prev) => (prev ? { ...prev, subject: e.target.value } : prev))
                  }
                  placeholder="例如：中文"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">課室（選填）</span>
                <input
                  type="text"
                  value={editor.room}
                  onChange={(e) =>
                    setEditor((prev) => (prev ? { ...prev, room: e.target.value } : prev))
                  }
                  placeholder="例如：1A"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </label>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              {editor.slotId ? (
                <button
                  type="button"
                  onClick={handleRemove}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                >
                  刪除
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeEditor}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-strong focus:outline-none focus:ring-2 focus:ring-accent/30"
                >
                  儲存
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
