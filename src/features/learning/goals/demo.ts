// ============================================================
//  學習目標 — 示範資料 seeder
//  ------------------------------------------------------------
//  一鍵填入真實感、連貫嘅樣本（一個有上進心、生活忙碌嘅人）：
//  目標 + 元資料（分類/優先/狀態/目標日）+ 里程碑 + 進度簽到。
//
//  鐵則：
//   - 純資料，唔 import React、唔掂 UI。
//   - 每個 collection 各自 idempotent：只喺佢而家係空先種，
//     已有資料就跳過嗰個 collection。
//   - 日期一律經功能本地 helper（todayKey/fromKey）產生，分佈喺最近 1–4 週。
//   - goalsCol / goalMetaCol / milestonesCol 出廠已有種子，故預設情況
//     淨係 goalCheckinsCol 係空：嗰陣簽到會掛喺出廠目標（goal-1 / goal-2）
//     令動量曲線即刻有嘢睇。若用戶清空咗目標，則會種一套完整連貫嘅目標。
// ============================================================
import { uid } from '../../../lib/store'
import { goalsCol } from '../../../data/collections'
import type { Goal } from '../../../data/types'
import {
  goalMetaCol,
  milestonesCol,
  goalCheckinsCol,
  type GoalMeta,
  type Milestone,
  type GoalCheckin,
} from './types'
import { todayKey, fromKey } from './util'

// ───────── 本地日期 helper（錨定中午，避 DST / UTC 漂移）─────────
// 跟 util.fromKey/todayKey 同一套本地日曆日語意，唔自己砌時區邏輯。
const TODAY = fromKey(todayKey())

/** 今日往前 n 日、指定鐘數嘅 ISO datetime（n=0 即今日） */
function daysAgoISO(n: number, hour = 21, minute = 0): string {
  const d = new Date(TODAY)
  d.setDate(d.getDate() - n)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

/** 今日往前 n 日嘅 YYYY-MM-DD key（過去）；正數 = 未來（倒數用） */
function dayKeyOffset(offset: number): string {
  const d = new Date(TODAY)
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ============================================================
//  示範目標藍本（一個忙碌而有上進心嘅人）
//  注意：goalsCol / goalMetaCol / milestonesCol 出廠已有 goal-1 / goal-2，
//  以下淨係喺三者皆空（用戶清空過資料）先會用到。
// ============================================================
interface DemoGoalBlueprint {
  goal: Goal
  meta: Omit<GoalMeta, 'id'>
  milestones: Omit<Milestone, 'id' | 'goalId'>[]
}

function buildBlueprints(): DemoGoalBlueprint[] {
  return [
    // 1) 進行中 · 高優先 · 有里程碑（部分完成）
    {
      goal: { id: uid(), title: '考取 PMP 專案管理證書', progress: 0, createdAt: daysAgoISO(24, 9) },
      meta: {
        category: 'career',
        priority: 'high',
        status: 'active',
        startDate: dayKeyOffset(-24),
        targetDate: dayKeyOffset(26),
        notes: '報咗 6 月底嘅試。每晚至少溫一個知識領域，週末做模擬題。',
      },
      milestones: [
        { title: '報名 + 完成 35 小時培訓時數', done: true, weight: 2, order: 0, createdAt: daysAgoISO(24, 9), doneAt: daysAgoISO(18, 22) },
        { title: '通讀 PMBOK 指南一次', done: true, weight: 3, order: 1, createdAt: daysAgoISO(24, 9), doneAt: daysAgoISO(9, 23) },
        { title: '做完 3 份模擬卷（達 80%）', done: false, weight: 3, order: 2, createdAt: daysAgoISO(24, 9) },
        { title: '正式應試', done: false, weight: 2, order: 3, createdAt: daysAgoISO(24, 9) },
      ],
    },
    // 2) 進行中 · 中優先 · 健身（無里程碑，手動進度）
    {
      goal: { id: uid(), title: '減 5 公斤、養成跑步習慣', progress: 45, createdAt: daysAgoISO(21, 7) },
      meta: {
        category: 'health',
        priority: 'medium',
        status: 'active',
        startDate: dayKeyOffset(-21),
        targetDate: dayKeyOffset(40),
        notes: '每週三跑、控制宵夜。由 72kg 開始，現時 69.7kg。',
      },
      milestones: [],
    },
    // 3) 進行中 · 高優先 · 技能（里程碑進行中）
    {
      goal: { id: uid(), title: '上手 TypeScript + 砌一個個人專案', progress: 0, createdAt: daysAgoISO(18, 22) },
      meta: {
        category: 'skill',
        priority: 'high',
        status: 'active',
        startDate: dayKeyOffset(-18),
        targetDate: dayKeyOffset(35),
        notes: '跟官方 Handbook，邊學邊砌一個記帳 PWA。',
      },
      milestones: [
        { title: '睇完官方 Handbook 基礎章節', done: true, weight: 2, order: 0, createdAt: daysAgoISO(18, 22), doneAt: daysAgoISO(11, 23) },
        { title: '搞掂 strict mode + 泛型', done: true, weight: 2, order: 1, createdAt: daysAgoISO(18, 22), doneAt: daysAgoISO(4, 22) },
        { title: '部署第一個版本上線', done: false, weight: 3, order: 2, createdAt: daysAgoISO(18, 22) },
      ],
    },
    // 4) 暫停 · 低優先 · 閱讀
    {
      goal: { id: uid(), title: '一年讀完 24 本書', progress: 30, createdAt: daysAgoISO(20, 23) },
      meta: {
        category: 'reading',
        priority: 'low',
        status: 'paused',
        startDate: dayKeyOffset(-20),
        notes: '近排忙住溫 PMP，暫停吓。已讀 7 本。',
      },
      milestones: [],
    },
    // 5) 已完成 · 中優先 · 考試（里程碑全完成）
    {
      goal: { id: uid(), title: '考到雅思 IELTS 7 分', progress: 100, createdAt: daysAgoISO(27, 20) },
      meta: {
        category: 'exam',
        priority: 'medium',
        status: 'done',
        startDate: dayKeyOffset(-27),
        targetDate: dayKeyOffset(-3),
        notes: '一次過 7.5！口語係最大難關，多謝練習夥伴。',
      },
      milestones: [
        { title: '報考 + 訂溫習計劃', done: true, weight: 1, order: 0, createdAt: daysAgoISO(27, 20), doneAt: daysAgoISO(25, 21) },
        { title: '每日精聽 + 背 800 詞', done: true, weight: 2, order: 1, createdAt: daysAgoISO(27, 20), doneAt: daysAgoISO(8, 22) },
        { title: '應試', done: true, weight: 2, order: 2, createdAt: daysAgoISO(27, 20), doneAt: daysAgoISO(3, 12) },
      ],
    },
  ]
}

// ============================================================
//  簽到藍本：(goalId, 進度快照, 備註, 幾多日前)
//  喺預設情況掛喺出廠目標 goal-1（溫 BAFS）/ goal-2（睇管理書）,
//  令動量曲線即刻有嘢睇。
// ============================================================
function buildDefaultCheckins(): Omit<GoalCheckin, 'id'>[] {
  return [
    // goal-1：溫習 BAFS（出廠 progress 60）— 一路向上
    { goalId: 'goal-1', progress: 35, note: '溫完必修部分，開始入選修。', createdAt: daysAgoISO(22, 22) },
    { goalId: 'goal-1', progress: 48, note: '商業管理筆記整理好，做咗一份舊試題。', createdAt: daysAgoISO(15, 21) },
    { goalId: 'goal-1', progress: 60, note: '模擬卷拎到不錯分數，信心返晒嚟。', createdAt: daysAgoISO(6, 23) },
    // goal-2：睇管理學書（出廠 progress 25）— 慢慢嚟
    { goalId: 'goal-2', progress: 12, note: '揀咗《從 A 到 A+》，睇咗頭三章。', createdAt: daysAgoISO(19, 23) },
    { goalId: 'goal-2', progress: 25, note: '通勤時間多睇咗兩章，做咗筆記。', createdAt: daysAgoISO(8, 8) },
  ]
}

// 為自種目標配套嘅簽到（只喺種咗新目標先用）
function buildCheckinsForSeeded(blueprints: DemoGoalBlueprint[]): Omit<GoalCheckin, 'id'>[] {
  const byTitle = (t: string) => blueprints.find((b) => b.goal.title.includes(t))?.goal.id
  const pmp = byTitle('PMP')
  const run = byTitle('跑步')
  const ts = byTitle('TypeScript')
  const out: Omit<GoalCheckin, 'id'>[] = []
  if (pmp) {
    out.push(
      { goalId: pmp, progress: 25, note: '培訓時數砌夠，開始通讀 PMBOK。', createdAt: daysAgoISO(18, 22) },
      { goalId: pmp, progress: 50, note: 'PMBOK 讀完一次，落手做模擬題。', createdAt: daysAgoISO(9, 23) },
      { goalId: pmp, progress: 50, note: '第一份模擬卷 72%，敏捷部分要再溫。', createdAt: daysAgoISO(2, 22) },
    )
  }
  if (run) {
    out.push(
      { goalId: run, progress: 20, note: '第一週跑足三次，腳痠到死。', createdAt: daysAgoISO(17, 7) },
      { goalId: run, progress: 45, note: '磅咗 69.7kg，宵夜戒到八成。', createdAt: daysAgoISO(5, 7) },
    )
  }
  if (ts) {
    out.push(
      { goalId: ts, progress: 40, note: 'strict + 泛型搞掂，砌緊記帳 app 雛形。', createdAt: daysAgoISO(4, 22) },
    )
  }
  return out
}

// ============================================================
//  seedDemo — 各 collection 獨立 idempotent，回傳新增總 row 數
// ============================================================
export function seedDemo(): number {
  let count = 0

  // 三者皆空（用戶清空過）先種一套完整連貫目標；
  // 否則尊重出廠／既有資料，逐個 collection 跳過。
  const blueprints =
    goalsCol.get().length === 0 ? buildBlueprints() : []

  if (goalsCol.get().length === 0) {
    for (const b of blueprints) {
      goalsCol.add(b.goal)
      count += 1
    }
  }

  if (goalMetaCol.get().length === 0) {
    for (const b of blueprints) {
      goalMetaCol.add({ id: b.goal.id, ...b.meta })
      count += 1
    }
  }

  if (milestonesCol.get().length === 0) {
    for (const b of blueprints) {
      for (const m of b.milestones) {
        milestonesCol.add({ id: uid(), goalId: b.goal.id, ...m })
        count += 1
      }
    }
  }

  if (goalCheckinsCol.get().length === 0) {
    // 種咗新目標 → 簽到掛新目標；否則掛出廠目標（goal-1 / goal-2）。
    const checkins =
      blueprints.length > 0
        ? buildCheckinsForSeeded(blueprints)
        : buildDefaultCheckins()
    for (const c of checkins) {
      goalCheckinsCol.add({ id: uid(), ...c })
      count += 1
    }
  }

  return count
}
