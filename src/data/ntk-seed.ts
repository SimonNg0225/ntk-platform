// ============================================================
//  NTK 老師真實校本資料（6 日循環 Day A–F）
//  ------------------------------------------------------------
//  · 教師時間表、Day A–F 校曆及特別日期均為 2026/27。
//  · 由 NTK 提供的教師時間表 + 校曆相片逐格轉錄。
//  · cycle day A=1 … F=6，直接對上 TimetableSlot.day（不用改模型）。
//  · 用作 collection 預設值，並只識別舊 NTK seed 進行安全升級。
// ============================================================
import type { CalendarEvent, TimetableSlot, CycleCalendarEntry } from './types'
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
// 相片版本：2026-08-27。課前集會／早讀與班主任課屬全校時段，不計入教學節數。
// subject 已含班組與正式科目，room 為課室號。
const L = (day: number, period: number, subject: string, room: string): TimetableSlot => ({
  id: `ntk-${day}-${period}`,
  day,
  period,
  subject,
  room,
})

export const NTK_SLOTS: TimetableSlot[] = [
  // Day A (1)
  L(1, 3, 'S5 L3 · BAFS', '55'), L(1, 4, 'S5 L3 · BAFS', '55'),
  // Day B (2)
  L(2, 1, 'S6 L1 · BAFS', '51'), L(2, 2, 'S6 L1 · BAFS', '51'),
  L(2, 5, 'S6 L3 · BAFS', '51'), L(2, 6, 'S6 L3 · BAFS', '51'),
  L(2, 7, 'S5 L1 · BAFS', '55'), L(2, 8, 'S5 L1 · BAFS', '55'),
  // Day C (3)
  L(3, 3, 'S6 L1 · BAFS', '51'), L(3, 4, 'S6 L1 · BAFS', '51'),
  L(3, 7, 'S5 L3 · BAFS', '55'), L(3, 8, 'S5 L3 · BAFS', '55'),
  // Day D (4)
  L(4, 1, 'S6 L3 · BAFS', '51'), L(4, 2, 'S6 L3 · BAFS', '51'),
  L(4, 4, '3A · BAFS', '25'),
  L(4, 5, 'S5 L1 · BAFS', '55'), L(4, 6, 'S5 L1 · BAFS', '55'),
  // Day E (5)
  L(5, 1, 'S5 L1 · BAFS', '55'), L(5, 2, 'S5 L1 · BAFS', '55'),
  L(5, 3, 'S6 L3 · BAFS', '51'), L(5, 4, 'S6 L3 · BAFS', '51'),
  L(5, 5, 'S6 L1 · BAFS', '51'), L(5, 6, 'S6 L1 · BAFS', '51'),
  // Day F (6)
  L(6, 1, 'S5 L3 · BAFS', '55'), L(6, 2, 'S5 L3 · BAFS', '55'),
  L(6, 5, '3A · BAFS', '25'),
]

const LEGACY_2025_26_CELLS = new Set([
  '2-1', '2-2', '2-3', '2-4', '2-5', '2-6', '2-7', '2-8',
  '3-3', '3-4', '3-5', '3-6', '3-7', '3-8',
  '4-3', '4-5', '4-7', '4-8',
  '5-3', '5-4', '5-7', '5-8',
  '6-1', '6-2', '6-5', '6-6', '6-8',
])

/** Upgrade only the previous NTK seed timetable; custom user schedules remain untouched. */
export function upgradeNtkTimetableSeed(slots: TimetableSlot[]): {
  slots: TimetableSlot[]
  migrated: boolean
} {
  const legacyMatches = slots.filter(
    (slot) =>
      /^ntk-[1-6]-[1-8]$/.test(slot.id) &&
      LEGACY_2025_26_CELLS.has(`${slot.day}-${slot.period}`),
  ).length
  if (legacyMatches < 22 || slots.some((slot) => slot.day === 1)) {
    return { slots, migrated: false }
  }
  return { slots: NTK_SLOTS.map((slot) => ({ ...slot })), migrated: true }
}

// ───────── 2026/27 校曆：日期 → cycle day（1..6）─────────
// 循環日只建於校曆印有 A–F 的日期。運動會、教師發展日、考試、假期及
// Outreach Day 等均跳過；印有 A–F 的「特別時間表」日仍保留。
const C = (date: string, cycleDay: number): CycleCalendarEntry => ({ id: date, date, cycleDay })

const LEGACY_CYCLE_FRAGMENT: CycleCalendarEntry[] = [
  C('2026-06-01', 5), C('2026-06-02', 6), C('2026-06-03', 1), C('2026-06-04', 2), C('2026-06-05', 3),
  C('2026-06-08', 4), C('2026-06-09', 5), C('2026-06-10', 6), C('2026-06-11', 1), C('2026-06-12', 2),
  C('2026-06-15', 3), C('2026-06-16', 4), C('2026-06-17', 5), C('2026-06-18', 6),
]

function cycleWeekdays(
  start: string,
  end: string,
  excludedDates: string[],
  startCycleDay = 1,
): CycleCalendarEntry[] {
  const excluded = new Set(excludedDates)
  const cursor = new Date(`${start}T00:00:00Z`)
  const last = new Date(`${end}T00:00:00Z`)
  const entries: CycleCalendarEntry[] = []
  let cycleDay = startCycleDay
  while (cursor <= last) {
    const date = cursor.toISOString().slice(0, 10)
    const weekday = cursor.getUTCDay()
    if (weekday >= 1 && weekday <= 5 && !excluded.has(date)) {
      entries.push({ id: date, date, cycleDay })
      cycleDay = (cycleDay % 6) + 1
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return entries
}

const TERM_ONE_CYCLE = cycleWeekdays('2026-09-03', '2026-12-04', [
  '2026-10-01', '2026-10-02', '2026-10-19',
  '2026-11-06', '2026-11-12', '2026-11-13', '2026-11-20', '2026-11-23',
])

const TERM_TWO_CYCLE = cycleWeekdays('2027-01-05', '2027-06-04', [
  '2027-01-21', '2027-01-22', '2027-01-29',
  '2027-02-04', '2027-02-05', '2027-02-08', '2027-02-09', '2027-02-10',
  '2027-02-11', '2027-02-12', '2027-02-15',
  '2027-03-22', '2027-03-23', '2027-03-24', '2027-03-25', '2027-03-26',
  '2027-03-29', '2027-03-30', '2027-03-31',
  '2027-04-01', '2027-04-02', '2027-04-05', '2027-04-06', '2027-04-07', '2027-04-16',
  '2027-05-07', '2027-05-13', '2027-05-14',
])

export const NTK_CYCLE_CALENDAR: CycleCalendarEntry[] = [
  ...TERM_ONE_CYCLE,
  ...TERM_TWO_CYCLE,
]

/** Upgrade only the exact 2025/26 fragment that was previously bundled. */
export function upgradeNtkCycleCalendarSeed(entries: CycleCalendarEntry[]): {
  entries: CycleCalendarEntry[]
  migrated: boolean
} {
  const legacyByDate = new Map(LEGACY_CYCLE_FRAGMENT.map((entry) => [entry.date, entry.cycleDay]))
  const isLegacy =
    entries.length === LEGACY_CYCLE_FRAGMENT.length &&
    entries.every(
      (entry) => entry.id === entry.date && legacyByDate.get(entry.date) === entry.cycleDay,
    )
  return isLegacy
    ? { entries: NTK_CYCLE_CALENDAR.map((entry) => ({ ...entry })), migrated: true }
    : { entries, migrated: false }
}

// ───────── 2026/27 校曆特別事項（全日）─────────
const SCHOOL_CALENDAR_NOTES = '寧波第二中學 2026/27 校曆'

const E = (
  id: string,
  date: string,
  title: string,
  endDate?: string,
): CalendarEvent => ({
  id: `ntk-school-2026-27-${id}`,
  title,
  date,
  ...(endDate ? { endDate } : {}),
  allDay: true,
  calendarId: 'cal-work',
  mode: 'work',
  type: '學校校曆',
  notes: SCHOOL_CALENDAR_NOTES,
})

export const NTK_SCHOOL_EVENTS: CalendarEvent[] = [
  // 九月
  E('opening-day', '2026-09-01', '開學日'),
  E('s6-uniform-test', '2026-09-01', '中六統一測驗', '2026-09-10'),
  E('anniversary-awards', '2026-09-02', '週年嘉許禮'),
  E('special-timetable-sep', '2026-09-03', '特別時間表', '2026-09-10'),
  E('prefect-training', '2026-09-19', '領袖生培訓日'),
  E('special-timetable-sep-25', '2026-09-25', '特別時間表'),
  E('mid-autumn-holiday', '2026-09-26', '中秋節翌日'),
  // 十月
  E('national-day', '2026-10-01', '國慶日'),
  E('school-holiday-oct', '2026-10-02', '學校假期'),
  E('chung-yeung-holiday', '2026-10-19', '重陽節翌日'),
  // 十一月
  E('sports-day-one', '2026-11-06', '陸運會首天'),
  E('sports-day-two', '2026-11-12', '陸運會第二天'),
  E('school-holiday-nov', '2026-11-13', '學校假期'),
  E('awards-rehearsal', '2026-11-18', '頒獎禮練排（特別時間表）'),
  E('awards-ceremony', '2026-11-20', '頒獎禮'),
  E('school-information-day', '2026-11-21', '學校資訊日'),
  E('teacher-development-one', '2026-11-23', '第一次教師發展日'),
  // 十二月
  E('special-timetable-dec', '2026-12-03', '特別時間表', '2026-12-04'),
  E('term-one-exam', '2026-12-07', '第一學期考試', '2026-12-22'),
  E('christmas-party', '2026-12-23', '聖誕聯歡會'),
  E('christmas-new-year-holiday', '2026-12-24', '聖誕節及元旦假期', '2027-01-03'),
  // 一月
  E('teacher-development-two', '2027-01-04', '第二次教師發展日'),
  E('term-two-start', '2027-01-05', '第二學期開始'),
  E('excursion', '2027-01-21', '逍遙遊'),
  E('school-holiday-jan', '2027-01-22', '學校假期'),
  E('outreach-one', '2027-01-29', '第一次 Outreach Day'),
  E('term-one-parents-day', '2027-01-30', '第一學期家長日'),
  // 二月
  E('s6-mock-exam', '2027-02-01', '中六模擬考試', '2027-02-26'),
  E('lunar-new-year-holiday', '2027-02-04', '農曆新年假期', '2027-02-15'),
  // 三月
  E('s6-post-exam-review', '2027-03-01', '中六試後討論', '2027-03-05'),
  E('s6-farewell', '2027-03-05', '中六惜別會'),
  E('mid-year-uniform-test', '2027-03-22', '學年中期統一測驗', '2027-03-25'),
  E('s5-citizenship-trip', '2027-03-24', '中五級公民科內地考察', '2027-03-25'),
  E('easter-ching-ming-holiday', '2027-03-26', '復活節及清明節假期', '2027-04-06'),
  // 四月
  E('teacher-development-three', '2027-04-07', '第三次教師發展日'),
  E('dse-core-exam', '2027-04-08', 'DSE 核心科目考試', '2027-04-13'),
  E('outreach-two', '2027-04-16', '第二次 Outreach Day'),
  E('term-two-parents-day', '2027-04-24', '第二學期家長日暨中三高中選科講座'),
  // 五月
  E('labour-day', '2027-05-01', '勞動節'),
  E('talent-show', '2027-05-07', '才華盡展樂滿FUN'),
  E('buddha-birthday', '2027-05-13', '佛誕'),
  E('school-holiday-may', '2027-05-14', '學校假期'),
  E('s6-graduation', '2027-05-21', '中六畢業典禮'),
  // 六月
  E('special-timetable-jun', '2027-06-03', '特別時間表', '2027-06-04'),
  E('term-two-exam', '2027-06-07', '第二學期考試', '2027-06-22'),
  E('dragon-boat-holiday', '2027-06-09', '端午節'),
  E('post-exam-review', '2027-06-23', '試後討論日', '2027-06-25'),
  E('post-exam-activities', '2027-06-28', '試後活動日', '2027-07-13'),
  // 七至八月
  E('hksar-day', '2027-07-01', '香港特別行政區成立紀念日'),
  E('s1-pre-test', '2027-07-13', '小六升中一學前測驗（暫定）'),
  E('dse-results', '2027-07-14', '文憑試放榜（暫定）'),
  E('closing-ceremony', '2027-07-15', '結業禮'),
  E('summer-holiday', '2027-07-16', '暑假', '2027-08-31'),
]

/** Add the school calendar without replacing personal events or creating duplicates. */
export function mergeNtkSchoolEvents(events: CalendarEvent[]): {
  events: CalendarEvent[]
  migrated: boolean
} {
  const ids = new Set(events.map((event) => event.id))
  const signatures = new Set(events.map((event) => `${event.date}|${event.endDate ?? ''}|${event.title}`))
  const missing = NTK_SCHOOL_EVENTS.filter(
    (event) => !ids.has(event.id) && !signatures.has(`${event.date}|${event.endDate ?? ''}|${event.title}`),
  )
  return missing.length
    ? { events: [...events, ...missing.map((event) => ({ ...event }))], migrated: true }
    : { events, migrated: false }
}
