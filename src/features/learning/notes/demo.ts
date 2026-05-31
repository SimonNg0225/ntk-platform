import { uid } from '../../../lib/store'
import { richNotesCol, type RichNote } from './store'

// ============================================================
//  Notes 示範資料 seeder
//  ------------------------------------------------------------
//  一鍵填入真實感、連貫嘅樣本筆記，令空白 app 即刻「有嘢睇」。
//  只負責 richNotesCol（筆記）。notebooksCol 已有內建種子（BAFS /
//  靈感速記），呢度嘅筆記直接掛返嗰兩個現有筆記本 id。
//
//  Idempotent：richNotesCol 而家係空（.get().length === 0）先種，
//  已有資料就跳過，唔會重複塞。回傳實際新增嘅 row 數。
// ============================================================

// 本地日期 helper：以「當地中午」砌返第 n 日前嘅 Date，
// 轉 ISO 後 createdAt/updatedAt 會落喺預期嗰個本地日子，
// 避開 toISOString 直接用 0 點時嘅 UTC 時差漂移（與 store/util
// 內 dayKey 以本地年月日分桶嘅做法一致）。
function isoDaysAgo(daysAgo: number, hour = 12, minute = 0): string {
  const now = new Date()
  const d = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - daysAgo,
    hour,
    minute,
    0,
    0,
  )
  return d.toISOString()
}

// 已存在嘅內建筆記本 id（見 store.ts notebooksCol 種子）
const NB_BAFS = 'nb-bafs'
const NB_IDEAS = 'nb-ideas'

interface NoteSeed {
  title: string
  content: string
  notebookId?: string | null
  pinned?: boolean
  favorite?: boolean
  color?: string
  // 相對「今日」嘅天數：created 較舊、updated 較近（updated >= created）
  createdDaysAgo: number
  updatedDaysAgo: number
  updatedHour?: number
}

const SEED: NoteSeed[] = [
  {
    title: '本週溫習計劃',
    notebookId: NB_BAFS,
    pinned: true,
    favorite: true,
    color: 'amber',
    createdDaysAgo: 6,
    updatedDaysAgo: 0,
    updatedHour: 8,
    content:
      '本週重點 #計劃 #bafs\n\n- [x] 重溫市場營銷 4P\n- [x] 做完 SWOT 練習題\n- [ ] 整理財務比率筆記\n- [ ] 約同學週六 grp study\n\n每晚至少一個番茄鐘，唔好臨急抱佛腳。',
  },
  {
    title: '財務比率速記',
    notebookId: NB_BAFS,
    favorite: true,
    color: 'blue',
    createdDaysAgo: 4,
    updatedDaysAgo: 2,
    content:
      '財務比率 #財務 #bafs\n\n流動比率 = 流動資產 / 流動負債（睇短期償債）\n毛利率 = 毛利 / 銷貨 × 100%\n存貨周轉率 = 銷貨成本 / 平均存貨\n\n- [ ] 搵公司年報試計一次\n- [ ] 對照行業平均',
  },
  {
    title: '經濟學：供求彈性',
    notebookId: NB_BAFS,
    color: 'green',
    createdDaysAgo: 11,
    updatedDaysAgo: 5,
    content:
      '需求價格彈性 #經濟 #notes\n\n彈性 > 1：富彈性，減價可增總收入\n彈性 < 1：缺乏彈性，加價反而增收入\n必需品多數缺乏彈性（如食米、燃油）。\n\n要記住計法：%變量(需求量) ÷ %變量(價格)。',
  },
  {
    title: '《原子習慣》讀書筆記',
    notebookId: NB_IDEAS,
    favorite: true,
    color: 'violet',
    createdDaysAgo: 16,
    updatedDaysAgo: 9,
    content:
      '《Atomic Habits》重點 #閱讀 #習慣\n\n細微改變、複利效應。focus 落系統而唔係目標。\n\n四大定律：明顯、吸引、容易、滿足。\n- [x] 設定每日閱讀 20 分鐘\n- [ ] 用習慣堆疊法：飲完早餐就背英文生字',
  },
  {
    title: '英文寫作常用連接詞',
    notebookId: NB_IDEAS,
    color: 'none',
    createdDaysAgo: 8,
    updatedDaysAgo: 3,
    content:
      'Essay 連接詞 #英文 #寫作\n\n對比：however, on the other hand, whereas\n遞進：moreover, furthermore, in addition\n結論：therefore, consequently, to sum up\n\n寫 argumentative essay 開頭用 thesis statement 點題。',
  },
  {
    title: '週末待辦雜項',
    notebookId: null,
    color: 'rose',
    createdDaysAgo: 2,
    updatedDaysAgo: 1,
    content:
      '週末 to-do #生活\n\n- [x] 還圖書館本書\n- [ ] 剪頭髮\n- [ ] 買生日禮物畀阿媽\n- [ ] 打掃書枱、清電腦 download 資料夾',
  },
  {
    title: '副業靈感：賣溫習筆記',
    notebookId: NB_IDEAS,
    pinned: true,
    color: 'amber',
    createdDaysAgo: 13,
    updatedDaysAgo: 6,
    content:
      '靈感速記 #idea #副業\n\n可以將自己嘅 BAFS / 經濟筆記整理成 PDF 套裝，喺網上賣畀師弟妹。\n配合一條 demo 影片同免費試閱頁。\n\n- [ ] 評估有冇市場\n- [ ] 整一頁 landing page',
  },
  {
    title: '面試準備 — 自我介紹',
    notebookId: null,
    color: 'cyan',
    createdDaysAgo: 19,
    updatedDaysAgo: 12,
    content:
      '暑期工面試 #面試 #職涯\n\n30 秒自我介紹框架：現況 → 相關經驗 → 點解揀呢間。\n預備 STAR 例子：一次團隊合作 + 一次解決問題。\n\n- [ ] 練習答「你最大弱點」\n- [ ] 準備兩條反問面試官嘅問題',
  },
]

export function seedDemo(): number {
  let added = 0

  // 只喺空集合先種（idempotent）
  if (richNotesCol.get().length === 0) {
    const notes: RichNote[] = SEED.map((s) => ({
      id: uid(),
      title: s.title,
      content: s.content,
      notebookId: s.notebookId ?? null,
      pinned: s.pinned ?? false,
      favorite: s.favorite ?? false,
      archived: false,
      trashed: false,
      color: s.color ?? 'none',
      createdAt: isoDaysAgo(s.createdDaysAgo),
      updatedAt: isoDaysAgo(s.updatedDaysAgo, s.updatedHour ?? 12),
    }))
    richNotesCol.set(notes)
    added += notes.length
  }

  return added
}
