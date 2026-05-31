import type { Task } from '../../../data/types'
import { tasksCol } from '../../../data/collections'
import { uid } from '../../../lib/store'
import { subtasksCol, taskMetaCol } from './store'
import type { Priority, SubTask, TaskMeta } from './types'
import { offsetFromToday } from './util'

// ============================================================
//  待辦 — 示範資料（seedDemo）
//  ------------------------------------------------------------
//  畀新用戶／示範場景一鍵填入真實感、連貫嘅樣本：一個有上進心、
//  生活忙碌嘅老師嘅待辦清單。純資料、零 UI、零 React。
//
//  涉及三個 collection（互相用 task.id 串連）：
//   · tasksCol（'work_tasks'，data/collections.ts）—— 任務真相來源
//     Task { text / done / createdAt }。
//   · taskMetaCol（'todo_task_meta'）—— sidecar，key = task.id，
//     存優先級 / 到期 / 專案 / 標籤 / 備註 / 排序 / 完成時間。
//   · subtasksCol（'todo_subtasks'）—— 個別任務嘅子任務清單。
//   專案沿用 store.ts 內建嘅 proj-teaching（教學）/ proj-admin（行政）。
//
//  鐵則：
//   · Idempotent —— 每個 collection 只喺佢而家係空（.get().length === 0）
//     先種；已有資料就跳過嗰個 collection。回傳總共加咗幾多 row。
//   · 日期一律行 util 嘅本地日期 helper（todayISO / offsetFromToday），
//     分佈喺最近 1–4 週（到期日跨「逾期 / 今日 / 即將」三類；只有提早
//     交報告呢類有語意先用未來日）。
//   · 完成嘅任務同時 set done=true + meta.completedAt，趨勢圖 / 熱力圖 /
//     連續完成日先有嘢睇；completedAt 分佈喺最近約兩週。
//   · 純資料，唔掂 UI / 唔 import React。
// ============================================================

const PROJ_TEACHING = 'proj-teaching'
const PROJ_ADMIN = 'proj-admin'

/**
 * 一條示範任務嘅藍本。略去 id（種入時派）。
 * dueOffset / createdOffset / doneOffset 全部係「距今日數」（負=過去、
 * 0=今日、正=將來），種入時經 offsetFromToday 轉成本地 YYYY-MM-DD，
 * 令樣本隨「今日」滑動、唔會寫死。
 */
interface Sample {
  text: string
  priority: Priority
  /** 到期距今日數；undefined = 無到期（收件匣式）。 */
  dueOffset?: number
  projectId?: string
  tags: string[]
  note?: string
  /** 建立距今日數（負數；預設同到期相關，營造「早幾日加低」感）。 */
  createdOffset: number
  /** 已完成 = true；連同 doneOffset 設 completedAt。 */
  done?: boolean
  /** 完成距今日數（負=過去、0=今日）；done=true 時用。 */
  doneOffset?: number
  /** 子任務文字清單（順序即顯示次序）。 */
  subtasks?: string[]
}

// 一個忙碌但有條理嘅老師：教學 + 行政 + 個人進修混雜。
// 到期日刻意跨「逾期 / 今日 / 聽日 / 一週內 / 之後」幾桶，
// 令智能分組、Today、Upcoming 各視圖都即刻有內容。
const SAMPLES: Sample[] = [
  // ── 逾期（紅色，最搶眼）──────────────────────────────
  {
    text: '交上學期成績分析報告畀科主任',
    priority: 1,
    dueOffset: -2,
    projectId: PROJ_ADMIN,
    tags: ['報告', '死線'],
    note: '科主任追緊，今晚一定要搞掂個 PDF send 過去。',
    createdOffset: -9,
    subtasks: ['整理各班平均分', '畫返成績分佈圖', '寫三點觀察 + 改善建議'],
  },
  {
    text: '回覆 4B 家長關於補課安排嘅電郵',
    priority: 2,
    dueOffset: -1,
    projectId: PROJ_ADMIN,
    tags: ['家長', '溝通'],
    note: '已讀未回兩日，唔好再拖，下午小息打返。',
    createdOffset: -4,
  },

  // ── 今日 ────────────────────────────────────────────
  {
    text: '批改 5A 班週測卷',
    priority: 1,
    dueOffset: 0,
    projectId: PROJ_TEACHING,
    tags: ['批改'],
    note: '兩疊卷，目標今晚改一半，聽日派返。',
    createdOffset: -2,
    subtasks: ['對齊評分準則', '改 MC + 短題', '記分數入成績冊'],
  },
  {
    text: '備聽日「市場營銷組合 4P」嗰堂',
    priority: 2,
    dueOffset: 0,
    projectId: PROJ_TEACHING,
    tags: ['備課'],
    note: '想加個本地連鎖店個案，畀學生分組討論。',
    createdOffset: -3,
    subtasks: ['揀個案 + 搵新聞', '整簡報', '印工作紙'],
  },
  {
    text: '健身室練腳（深蹲日）',
    priority: 3,
    dueOffset: 0,
    tags: ['運動', '個人'],
    note: '收工去 gym，跟三分化今日到腳。',
    createdOffset: -1,
  },

  // ── 聽日 / 一週內（即將）──────────────────────────────
  {
    text: '同 5A 班主任跟進兩個缺交功課學生',
    priority: 2,
    dueOffset: 1,
    projectId: PROJ_ADMIN,
    tags: ['學生', '跟進'],
    note: '小息去教員室搵佢傾，了解下係咪屋企有事。',
    createdOffset: -2,
  },
  {
    text: '預備科務會議匯報（教學進度）',
    priority: 2,
    dueOffset: 3,
    projectId: PROJ_ADMIN,
    tags: ['會議', '行政'],
    note: '週四開會，講返本學期進度同考試卷分工。',
    createdOffset: -3,
    subtasks: ['更新進度表', '列出落後課題', '建議補課時段'],
  },
  {
    text: '溫 TypeScript 進階班第 3 課（generics）',
    priority: 3,
    dueOffset: 4,
    tags: ['學習', '個人', '進修'],
    note: '報咗錢就要跟完，週末搵兩個鐘做埋練習。',
    createdOffset: -6,
  },
  {
    text: '影印下星期工作紙（全級共用）',
    priority: 4,
    dueOffset: 5,
    projectId: PROJ_TEACHING,
    tags: ['雜務'],
    note: '夠 120 份，順手釘好。',
    createdOffset: -1,
  },

  // ── 之後 / 提早準備（未來日，有語意）────────────────────
  {
    text: '出期末考卷（商業管理）初稿',
    priority: 1,
    dueOffset: 12,
    projectId: PROJ_TEACHING,
    tags: ['出卷', '考試'],
    note: '依藍圖出題，留返時間畀科主任 vet。',
    createdOffset: -2,
    subtasks: ['對藍圖分配分數', '出 MC 20 題', '出長題 3 條', '寫評分指引'],
  },

  // ── 已完成（近兩週，餵趨勢 / 熱力 / streak）─────────────
  {
    text: '上載市場學筆記到學校平台',
    priority: 3,
    done: true,
    doneOffset: 0,
    projectId: PROJ_TEACHING,
    tags: ['資源'],
    createdOffset: -1,
  },
  {
    text: '記錄 5B 班默書分數',
    priority: 2,
    done: true,
    doneOffset: -1,
    projectId: PROJ_TEACHING,
    tags: ['批改'],
    createdOffset: -3,
  },
  {
    text: '交班主任津貼申請表',
    priority: 2,
    done: true,
    doneOffset: -2,
    projectId: PROJ_ADMIN,
    tags: ['行政', '表格'],
    createdOffset: -5,
  },
  {
    text: '晨早跑步 5 公里',
    priority: 4,
    done: true,
    doneOffset: -3,
    tags: ['運動', '個人'],
    createdOffset: -3,
  },
  {
    text: '預備家長日簡介稿',
    priority: 1,
    done: true,
    doneOffset: -5,
    projectId: PROJ_ADMIN,
    tags: ['家長', '行政'],
    createdOffset: -8,
  },
]

/**
 * 把「距今日數」轉成合理 ISO 時戳（該日某鐘數，本地時間）。
 * 用 offsetFromToday 攞本地 YYYY-MM-DD，再貼鐘數 → 穩定、唔係未來。
 */
function isoAt(offsetDays: number, clock = '09:00:00'): string {
  return new Date(`${offsetFromToday(offsetDays)}T${clock}`).toISOString()
}

/**
 * 種入示範待辦。
 * - 每個 collection 各自獨立 idempotent：只喺佢而家係空先種。
 * - 任務（tasksCol）、中繼資料（taskMetaCol）、子任務（subtasksCol）
 *   用同一條 task.id 串連，視圖 join 得返。
 * - 回傳實際加入嘅 row 總數（三個 collection 相加）。
 */
export function seedDemo(): number {
  const seedTasks = tasksCol.get().length === 0
  const seedMeta = taskMetaCol.get().length === 0
  const seedSubs = subtasksCol.get().length === 0

  // 三個都已有資料 → 完全跳過。
  if (!seedTasks && !seedMeta && !seedSubs) return 0

  // 確保任務的 id 一致：
  //  · 如果要種任務，逐條派新 id；
  //  · 如果任務 collection 已有資料但 meta/subtasks 係空（罕有），
  //    就唔再硬塞 meta/subtasks 落「未知 id」——直接跳過嗰兩個，
  //    避免製造指向唔存在任務嘅孤兒 row。
  if (!seedTasks) return 0

  const tasks: Task[] = []
  const metas: TaskMeta[] = []
  const subs: SubTask[] = []

  let added = 0

  SAMPLES.forEach((s, i) => {
    const id = uid()
    const createdAt = isoAt(s.createdOffset)

    // 1) 任務本體（真相來源）
    tasks.push({
      id,
      text: s.text,
      done: s.done ?? false,
      createdAt,
    })

    // 2) sidecar 中繼資料（key = task.id）
    const due = s.dueOffset === undefined ? undefined : offsetFromToday(s.dueOffset)
    const completedAt =
      s.done && s.doneOffset !== undefined ? isoAt(s.doneOffset, '17:30:00') : undefined
    metas.push({
      id,
      priority: s.priority,
      ...(due ? { due } : {}),
      ...(s.projectId ? { projectId: s.projectId } : {}),
      tags: s.tags,
      ...(s.note ? { note: s.note } : {}),
      order: i, // 跟藍本次序做手動排序底
      ...(completedAt ? { completedAt } : {}),
      updatedAt: completedAt ?? createdAt,
    })

    // 3) 子任務（如有）
    if (s.subtasks) {
      s.subtasks.forEach((text, j) => {
        subs.push({
          id: uid(),
          taskId: id,
          text,
          // 已完成嘅母任務 → 子任務全勾；否則勾頭一兩個營造進度感。
          done: s.done ? true : j === 0,
          order: j,
        })
      })
    }
  })

  // 一次過寫入（emit 一次），避免逐條 add 造成多次 re-render。
  tasksCol.set(tasks)
  added += tasks.length

  if (seedMeta) {
    taskMetaCol.set(metas)
    added += metas.length
  }
  if (seedSubs) {
    subtasksCol.set(subs)
    added += subs.length
  }

  return added
}
