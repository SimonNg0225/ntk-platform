import { journalDocsCol } from './store'
import { addDays, todayKey, type JournalDoc } from './util'

// ============================================================
//  學習日誌 — 示範資料（seedDemo）
//  ------------------------------------------------------------
//  給新用戶／示範場景一鍵填入真實感、連貫的樣本：一個有上進心、
//  生活忙碌的人的學習日誌。純資料、零 UI、零 React。
//
//  規則：
//   · 只負責 journalDocsCol（'journal_v2'）一個 collection。
//   · Idempotent —— 只在他現在係空（.get().length === 0）先種；
//     已有資料就跳過，回傳 0。
//   · 日期一律用功能本地 helper（todayKey / addDays），分佈在最近
//     ~3.5 週，不要全部同一日、不用未來日。
//   · 心情用 MOODS 的 emoji（😀🙂😐😓😣）；天氣用 WEATHER；
//     內文夾 #標籤（util.parseTags 會自動抽出來做篩選 / 統計）。
//
//  回傳：實際加入的 row 數（種了就係筆數，跳過就係 0）。
// ============================================================

/**
 * 一篇示範日誌的藍本。
 * 略去 id / createdAt / updatedAt（由 seedDemo 補上），亦略去 date —— 改用
 * daysAgo 在種入時由 todayKey 推算返本地 date，令樣本隨「今日」滑動。
 */
type Sample = Omit<JournalDoc, 'id' | 'date' | 'createdAt' | 'updatedAt'> & {
  /** 距今幾多日（0 = 今日，正數 = 過去）。 */
  daysAgo: number
}

// 由新到舊的敘事：忙碌但持續進步的一個月。
// daysAgo 刻意分散（2、5、8…）令熱力圖 / 連續天數 / 趨勢圖都有嘢查看。
const SAMPLES: Sample[] = [
  {
    daysAgo: 2,
    title: '終於搞通 useMemo 同 useCallback',
    content:
      '今晚收工後再煲多兩集 React 教學，總算分得清 #useMemo 同 #useCallback 的分別——一個記住「值」，一個記住「函式」。\n\n之前一直亂這樣加，今次明白原來大部分情況都不用加，加錯還拖慢 render。趁有感覺，順手重構了 dashboard 那個慢 list，肉眼查看到順了很多。\n\n#React #前端 #重構',
    mood: '😀',
    weather: '🌧️',
    gratitude: '多謝同事今日幫我頂了個會，先有時間夜晚靜心查看書。',
    favorite: true,
  },
  {
    daysAgo: 5,
    title: '半馬訓練 · 18 公里長課',
    content:
      '朝早六點出門跑長課，maple road 一路上斜，後段真的堅持完成。最後 3 公里腳開始重，但都沒有停低行，配速守得住。\n\n為了六月那個半馬，最近逼自己早睡早起。睡眠夠，學習和跑步都精神很多，不再硬撐。\n\n#跑步 #半馬 #自律',
    mood: '😓',
    weather: '⛅',
    gratitude: '一對舊跑鞋陪我跑到今日，多謝雙腳還撐得住。',
    favorite: false,
  },
  {
    daysAgo: 8,
    title: '一日連兩個 deadline',
    content:
      '今日真的休息不到氣，上晝交客戶提案，下晝跟內部 review，中間還要救一條 production bug。\n\n收工攤在梳化想，其實不是做不來，是安排得太緊。明天嘗試早上花十五分鐘規劃好優先次序，再開始動手，不要經常被 deadline 推着走。\n\n#工作 #時間管理 #反思',
    mood: '😣',
    weather: '☁️',
    gratitude: '幸好屋企人煮埋飯等我，回到去有啖熱飯吃。',
    favorite: false,
  },
  {
    daysAgo: 12,
    title: '讀書會 · 《原子習慣》第三章',
    content:
      '同幾個朋友開了第一次讀書會，討論《原子習慣》。最 set 親我那句是：你不會升到目標的高度，你只會回到你系統的水平。\n\n決定由細處做起——將「每日寫日誌」綁在刷牙之後，做完立即記低。習慣疊習慣，不靠意志力。\n\n#閱讀 #習慣 #成長',
    mood: '🙂',
    weather: '☀️',
    gratitude: '多謝肯抽時間夾期的幾位朋友，獨個讀同一起傾真的兩回事。',
    favorite: true,
  },
  {
    daysAgo: 16,
    title: '平平無奇的一日',
    content:
      '沒有什麼特別，上班、吃飯、跑了個輕鬆 5K。提不起勁查看書，就由他，休息一日都不代表會散。\n\n至少日誌沒有斷，連續紀錄擺在這裡，本身就是一種推動力。\n\n#日常 #休息',
    mood: '😐',
    weather: '🌫️',
    favorite: false,
  },
  {
    daysAgo: 21,
    title: '報了 TypeScript 進階班',
    content:
      '搏了好耐，今日終於㩒掣報埋個 #TypeScript 進階班。一直靠工作項目零碎這樣學，係時候有系統這樣打好個底——generics、條件型別這些部分成日一知半解。\n\n給了錢就沒有得退，逼自己一定要跟完。年尾前想轉去做更硬核的前端崗位，由今日開始儲彈藥。\n\n#學習 #職涯 #目標',
    mood: '😀',
    weather: '☀️',
    gratitude: '多謝過去那個肯儲錢進修的自己，今日先有得選擇。',
    favorite: false,
  },
]

/**
 * 種入示範日誌。
 * - 只在 journalDocsCol 現在係空先種（idempotent）。
 * - 回傳實際加入的 row 數（跳過就 0）。
 */
export function seedDemo(): number {
  if (journalDocsCol.get().length > 0) return 0

  const today = todayKey()
  let added = 0

  for (const s of SAMPLES) {
    const date = addDays(today, -s.daysAgo)
    // createdAt / updatedAt：用該日中午做合理 ISO 時戳（穩定、不是未來）。
    const iso = new Date(`${date}T12:00:00`).toISOString()
    journalDocsCol.add({
      date,
      title: s.title,
      content: s.content,
      mood: s.mood,
      weather: s.weather,
      gratitude: s.gratitude,
      favorite: s.favorite ?? false,
      createdAt: iso,
      updatedAt: iso,
    })
    added += 1
  }

  return added
}
