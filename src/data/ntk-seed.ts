// ============================================================
//  NTK 老師真實校本資料（寧波第二中學 2025/2026，6 日循環 Day A–F）
//  ------------------------------------------------------------
//  · 由 NTK 提供嘅教師時間表 + 校曆相片轉錄。
//  · cycle day A=1 … F=6，直接對上 TimetableSlot.day（唔使改模型）。
//  · 用作 collection 預設值：collection 一旦係空就 seed 呢批；用家改過就唔覆寫。
//  · 校曆暫只入有信心嗰段（2026-06-01 ~ 06-18，正常上課週）；
//    考試／活動／暑假週留待核對清晰校曆後再補。
// ============================================================
import type { TimetableSlot, CycleCalendarEntry } from './types'
import type { BellRow } from '../features/work/timetable/util'

// ───────── 本校鐘聲（8 節 + 兩個小息 + 午膳）─────────
export const NTK_BELLS: BellRow[] = [
  { period: 1, kind: 'lesson', label: '第 1 節', start: '08:30', end: '09:10' },
  { period: 2, kind: 'lesson', label: '第 2 節', start: '09:10', end: '09:50' },
  { period: 0, kind: 'recess', label: '小息', start: '09:50', end: '10:05' },
  { period: 3, kind: 'lesson', label: '第 3 節', start: '10:05', end: '10:45' },
  { period: 4, kind: 'lesson', label: '第 4 節', start: '10:45', end: '11:25' },
  { period: 0, kind: 'recess', label: '小息', start: '11:25', end: '11:40' },
  { period: 5, kind: 'lesson', label: '第 5 節', start: '11:40', end: '12:20' },
  { period: 6, kind: 'lesson', label: '第 6 節', start: '12:20', end: '13:00' },
  { period: 0, kind: 'lunch', label: '午膳', start: '13:00', end: '14:10' },
  { period: 7, kind: 'lesson', label: '第 7 節', start: '14:10', end: '14:50' },
  { period: 8, kind: 'lesson', label: '第 8 節', start: '14:50', end: '15:30' },
]

// ───────── 教師時間表（按 cycle day：A=1…F=6）─────────
// 「Day A」全日無堂；其餘見下（subject 已含班組，room 為課室號）。
const L = (day: number, period: number, subject: string, room: string): TimetableSlot => ({
  id: `ntk-${day}-${period}`,
  day,
  period,
  subject,
  room,
})

export const NTK_SLOTS: TimetableSlot[] = [
  // Day B (2)
  L(2, 1, 'S6 L1 · BAFS', '56'), L(2, 2, 'S6 L1 · BAFS', '56'),
  L(2, 3, 'S6 L3 · BAFS', '56'), L(2, 4, 'S6 L3 · BAFS', '56'),
  L(2, 5, 'S6 L1 · BAFS', '56'), L(2, 6, 'S6 L1 · BAFS', '56'),
  L(2, 7, 'S5 L1 · BAFS', '52'), L(2, 8, 'S5 L1 · BAFS', '52'),
  // Day C (3)
  L(3, 3, 'S5 L3 · BAFS', '52'), L(3, 4, 'S5 L3 · BAFS', '52'),
  L(3, 5, 'S6 L1 · BAFS', '56'), L(3, 6, 'S6 L1 · BAFS', '56'),
  L(3, 7, 'S5 L1 · BAFS', '52'), L(3, 8, 'S5 L1 · BAFS', '52'),
  // Day D (4)
  L(4, 3, '3A · BAFS', '25'), L(4, 5, '3A · BAFS', '25'),
  L(4, 7, 'S5 L1 · BAFS', '52'), L(4, 8, 'S5 L1 · BAFS', '52'),
  // Day E (5)
  L(5, 3, 'S6 L3 · BAFS', '56'), L(5, 4, 'S6 L3 · BAFS', '56'),
  L(5, 7, 'S5 L3 · BAFS', '52'), L(5, 8, 'S5 L3 · BAFS', '52'),
  // Day F (6)
  L(6, 1, 'S6 L3 · BAFS', '56'), L(6, 2, 'S6 L3 · BAFS', '56'),
  L(6, 5, 'S5 L3 · BAFS', '52'), L(6, 6, 'S5 L3 · BAFS', '52'),
  L(6, 8, '3A · ASB', '25'),
]

// ───────── 校曆：日期 → cycle day（1..6）─────────
// 由校曆相轉錄：2026-06-01(一)=Day E(5)，順住推（跳週末；19/6 端午假期）。
// ⚠️ 只入到正常上課週（6/1–6/18）；之後考試/活動/暑假週要核對清晰校曆先補。
const C = (date: string, cycleDay: number): CycleCalendarEntry => ({ id: date, date, cycleDay })

export const NTK_CYCLE_CALENDAR: CycleCalendarEntry[] = [
  C('2026-06-01', 5), C('2026-06-02', 6), C('2026-06-03', 1), C('2026-06-04', 2), C('2026-06-05', 3),
  C('2026-06-08', 4), C('2026-06-09', 5), C('2026-06-10', 6), C('2026-06-11', 1), C('2026-06-12', 2),
  C('2026-06-15', 3), C('2026-06-16', 4), C('2026-06-17', 5), C('2026-06-18', 6),
]
