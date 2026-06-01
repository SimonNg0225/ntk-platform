// ============================================================
//  我的資料一覽 + 上次備份提醒 — 純邏輯核心
//  ------------------------------------------------------------
//  全部資料都喺本機 localStorage（見 lib/store.ts 嘅 collectionRegistry）。
//  匯出備份前其實睇唔到入面有幾多嘢，亦唔知上次幾時備份過。呢個 module 抽出
//  純計算/格式化：
//    - summarizeData：將 exportAllData() 個 data 物件 → 每個集合嘅
//      「友好名稱 + 筆數 + 單位」清單（非空優先、按筆數降序），加總筆數。
//    - backupAgeDays / formatBackupReminder：由「上次備份時間戳」算返相對
//      日數同提示句（超過 N 日 → stale，UI 用 amber 提醒）。
//  全部係純函式，唔掂 DOM / store，方便用 vitest 鎖時間單元測試。
// ============================================================

/** 集合 key（去咗 ntk. 前綴，同 collectionRegistry / 匯出檔 data 的 key）→ 中文標籤 + 量詞 */
interface CollectionMeta {
  label: string
  /** 量詞（例：「篇」「條」），無就用預設「項」 */
  unit?: string
}

// key 對應 data/collections.ts 同各 lazy feature 自家 createCollection 嘅 key。
// 未列出嘅 key 會用 fallback（見 metaForKey），所以新功能唔登記都唔會出錯。
export const COLLECTION_LABELS: Record<string, CollectionMeta> = {
  // 共用骨幹
  topics: { label: '課題', unit: '個' },
  classes: { label: '班別', unit: '班' },
  students: { label: '學生', unit: '位' },
  // 工作模式
  class_progress: { label: '課程進度', unit: '項' },
  questions: { label: '題庫題目', unit: '條' },
  resources: { label: '教學資源', unit: '項' },
  assessments: { label: '評估', unit: '項' },
  scores: { label: '成績紀錄', unit: '筆' },
  lesson_plans: { label: '教案', unit: '份' },
  timetable: { label: '時間表時段', unit: '節' },
  cycle_calendar: { label: '校曆循環日', unit: '日' },
  attendance: { label: '出席紀錄', unit: '筆' },
  parent_comms: { label: '家長溝通', unit: '筆' },
  meeting_notes: { label: '會議筆記', unit: '篇' },
  // 學習模式
  decks: { label: '知識卡牌組', unit: '組' },
  cards: { label: '知識卡', unit: '張' },
  journal: { label: '日誌', unit: '篇' },
  journal_v2: { label: '日誌', unit: '篇' },
  focus_sessions: { label: '專注紀錄', unit: '次' },
  learning_notes: { label: '筆記', unit: '篇' },
  notes_rich_v2: { label: '筆記', unit: '篇' },
  learning_goals: { label: '目標', unit: '個' },
  work_tasks: { label: '待辦', unit: '項' },
  reading_items: { label: '閱讀清單', unit: '本' },
  habits: { label: '習慣', unit: '個' },
  habit_logs: { label: '習慣打卡', unit: '次' },
  health_logs_v1: { label: '健康紀錄', unit: '筆' },
  fitness_training_v1: { label: '訓練紀錄', unit: '次' },
  // 共用 / 工具
  events: { label: '行事曆事件', unit: '項' },
  calendars: { label: '行事曆', unit: '個' },
  inbox: { label: '快速擷取', unit: '項' },
  countdowns: { label: '倒數日子', unit: '個' },
  ai_threads: { label: 'AI 對話', unit: '段' },
  ai_messages: { label: 'AI 訊息', unit: '則' },
  tx_categories: { label: '收支分類', unit: '個' },
  transactions: { label: '收支紀錄', unit: '筆' },
  quiz_attempts: { label: '測驗紀錄', unit: '次' },
}

const DEFAULT_UNIT = '項'

function metaForKey(key: string): CollectionMeta {
  return COLLECTION_LABELS[key] ?? { label: key, unit: DEFAULT_UNIT }
}

export interface CollectionSummary {
  key: string
  label: string
  unit: string
  count: number
}

export interface DataOverview {
  /** 每個集合一行，已排序（有資料嘅優先、再按筆數降序、再按標籤穩定排） */
  rows: CollectionSummary[]
  /** 全部集合筆數總和 */
  total: number
  /** 有資料（count > 0）嘅集合數 */
  nonEmpty: number
}

/**
 * 將 exportAllData() 個 data 物件 → 友好嘅資料一覽。
 * 只計值係陣列嘅 key（同 importAllData 嘅守衞一致，非陣列／壞值當 0／忽略）。
 * 排序：有資料優先 → 筆數多優先 → 同筆數按標籤本地化排序（穩定、可預期）。
 */
export function summarizeData(
  data: Record<string, unknown> | null | undefined,
): DataOverview {
  const rows: CollectionSummary[] = []
  if (data && typeof data === 'object') {
    for (const key of Object.keys(data)) {
      const v = (data as Record<string, unknown>)[key]
      if (!Array.isArray(v)) continue
      const meta = metaForKey(key)
      rows.push({
        key,
        label: meta.label,
        unit: meta.unit ?? DEFAULT_UNIT,
        count: v.length,
      })
    }
  }

  rows.sort((a, b) => {
    const aEmpty = a.count === 0 ? 1 : 0
    const bEmpty = b.count === 0 ? 1 : 0
    if (aEmpty !== bEmpty) return aEmpty - bEmpty // 有資料行先
    if (b.count !== a.count) return b.count - a.count // 筆數多先
    return a.label.localeCompare(b.label, 'zh-Hant') // 穩定 tiebreak
  })

  const total = rows.reduce((sum, r) => sum + r.count, 0)
  const nonEmpty = rows.reduce((n, r) => n + (r.count > 0 ? 1 : 0), 0)
  return { rows, total, nonEmpty }
}

/**
 * 由上次備份時間戳算返「過咗幾多個完整日曆日」。
 * - 無時間戳 / 無效 → null（即「未備份過」）。
 * - 用日曆日（本地午夜）差，唔係 24 小時整除：今日備份 = 0、尋日 = 1。
 *   咁「3 日前」嘅文案先同用戶直覺一致（唔會因為差幾粒鐘變 2 定 3）。
 * - 未來時間戳（多機時鐘偏差）→ clamp 到 0。
 */
export function backupAgeDays(
  lastBackupISO: string | null | undefined,
  now: number = Date.now(),
): number | null {
  if (!lastBackupISO) return null
  const t = new Date(lastBackupISO).getTime()
  if (Number.isNaN(t)) return null
  const startOfDay = (ms: number) => {
    const d = new Date(ms)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }
  const diffDays = Math.round((startOfDay(now) - startOfDay(t)) / 86_400_000)
  return diffDays < 0 ? 0 : diffDays
}

export interface BackupReminder {
  /** 提示文案，例如「上次備份：3 日前」／「未試過匯出備份」／「今日已備份」 */
  text: string
  /** 是否應該用 amber 提醒（從未備份，或超過 staleDays） */
  stale: boolean
  /** 由未備份過 */
  never: boolean
  /** 相對日數（null = 未備份過） */
  ageDays: number | null
}

/**
 * 產生「上次備份」提示。
 * @param staleDays 超過呢個日數就當需要提醒（amber）。預設 7 日。
 */
export function formatBackupReminder(
  lastBackupISO: string | null | undefined,
  now: number = Date.now(),
  staleDays = 7,
): BackupReminder {
  const ageDays = backupAgeDays(lastBackupISO, now)
  if (ageDays === null) {
    return { text: '未試過匯出備份', stale: true, never: true, ageDays: null }
  }
  let text: string
  if (ageDays === 0) text = '今日已備份'
  else if (ageDays === 1) text = '上次備份：尋日'
  else text = `上次備份：${ageDays} 日前`
  return { text, stale: ageDays >= staleDays, never: false, ageDays }
}
