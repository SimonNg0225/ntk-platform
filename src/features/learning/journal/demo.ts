import { journalDocsCol } from './store'
import { addDays, todayKey, type JournalDoc } from './util'

// ============================================================
//  學習日誌 — 示範資料（seedDemo）
//  ------------------------------------------------------------
//  畀新用戶／示範場景一鍵填入真實感、連貫嘅樣本：一個有上進心、
//  生活忙碌嘅人嘅學習日誌。純資料、零 UI、零 React。
//
//  規則：
//   · 只負責 journalDocsCol（'journal_v2'）一個 collection。
//   · Idempotent —— 只喺佢而家係空（.get().length === 0）先種；
//     已有資料就跳過，回傳 0。
//   · 日期一律用功能本地 helper（todayKey / addDays），分佈喺最近
//     ~3.5 週，唔好全部同一日、唔用未來日。
//   · 心情用 MOODS 嘅 emoji（😀🙂😐😓😣）；天氣用 WEATHER；
//     內文夾 #標籤（util.parseTags 會自動抽出嚟做篩選 / 統計）。
//
//  回傳：實際加入嘅 row 數（種咗就係筆數，跳過就係 0）。
// ============================================================

/**
 * 一篇示範日誌嘅藍本。
 * 略去 id / createdAt / updatedAt（由 seedDemo 補上），亦略去 date —— 改用
 * daysAgo 喺種入時由 todayKey 推算返本地 date，令樣本隨「今日」滑動。
 */
type Sample = Omit<JournalDoc, 'id' | 'date' | 'createdAt' | 'updatedAt'> & {
  /** 距今幾多日（0 = 今日，正數 = 過去）。 */
  daysAgo: number
}

// 由新到舊嘅敘事：忙碌但持續進步嘅一個月。
// daysAgo 刻意分散（2、5、8…）令熱力圖 / 連續天數 / 趨勢圖都有嘢睇。
const SAMPLES: Sample[] = [
  {
    daysAgo: 2,
    title: '終於搞通 useMemo 同 useCallback',
    content:
      '今晚收工後再煲多兩集 React 教學，總算分得清 #useMemo 同 #useCallback 嘅分別——一個記住「值」，一個記住「函式」。\n\n之前一直亂咁加，今次明白原來大部分情況都唔使加，加錯仲拖慢 render。趁有感覺，順手重構咗 dashboard 嗰個慢 list，肉眼睇到順咗好多。\n\n#React #前端 #重構',
    mood: '😀',
    weather: '🌧️',
    gratitude: '多謝同事今日幫我頂咗個會，先有時間夜晚靜心睇書。',
    favorite: true,
  },
  {
    daysAgo: 5,
    title: '半馬訓練 · 18 公里長課',
    content:
      '朝早六點出門跑長課，maple road 一路上斜，後段真係頂硬上。最後 3 公里腳開始重，但都冇停低行，配速守得住。\n\n為咗六月嗰個半馬，呢排逼自己早瞓早起。瞓眠夠，學嘢同跑步都精神好多，唔再係硬捱。\n\n#跑步 #半馬 #自律',
    mood: '😓',
    weather: '⛅',
    gratitude: '一對舊跑鞋陪我跑到今日，多謝雙腳仲撐得住。',
    favorite: false,
  },
  {
    daysAgo: 8,
    title: '一日連兩個 deadline',
    content:
      '今日真係抖唔到氣，上晝交客戶提案，下晝跟內部 review，中間仲要救一條 production bug。\n\n收工攤喺梳化諗，其實唔係做唔嚟，係安排得太逼。聽日試吓朝頭早花十五分鐘 plan 好優先次序先郁手，唔好成日被 deadline 推住走。\n\n#工作 #時間管理 #反思',
    mood: '😣',
    weather: '☁️',
    gratitude: '幸好屋企人煮埋飯等我，返到去有啖熱飯食。',
    favorite: false,
  },
  {
    daysAgo: 12,
    title: '讀書會 · 《原子習慣》第三章',
    content:
      '同幾個朋友開咗第一次讀書會，傾《原子習慣》。最 set 親我嗰句係：你唔會升到目標嘅高度，你只會跌返落你系統嘅水平。\n\n決定由細處做起——將「每日寫日誌」綁喺刷牙之後，做完即刻記低。習慣疊習慣，唔靠意志力。\n\n#閱讀 #習慣 #成長',
    mood: '🙂',
    weather: '☀️',
    gratitude: '多謝肯抽時間夾期嘅幾位朋友，獨個讀同一齊傾真係兩回事。',
    favorite: true,
  },
  {
    daysAgo: 16,
    title: '平平無奇嘅一日',
    content:
      '冇咩特別，返工、食飯、跑咗個輕鬆 5K。提唔起勁睇書，就由佢，唞一日都唔代表會散。\n\n至少日誌冇斷，連續紀錄擺喺度，本身就係一種推動力。\n\n#日常 #休息',
    mood: '😐',
    weather: '🌫️',
    favorite: false,
  },
  {
    daysAgo: 21,
    title: '報咗 TypeScript 進階班',
    content:
      '搏咗好耐，今日終於㩒掣報埋個 #TypeScript 進階班。一直靠工作項目零碎咁學，係時候有系統咁打好個底——generics、條件型別呢啲位成日一知半解。\n\n畀咗錢就冇得退，逼自己一定要跟完。年尾前想轉去做更硬核嘅前端崗位，由今日開始儲彈藥。\n\n#學習 #職涯 #目標',
    mood: '😀',
    weather: '☀️',
    gratitude: '多謝過去嗰個肯儲錢進修嘅自己，今日先有得揀。',
    favorite: false,
  },
]

/**
 * 種入示範日誌。
 * - 只喺 journalDocsCol 而家係空先種（idempotent）。
 * - 回傳實際加入嘅 row 數（跳過就 0）。
 */
export function seedDemo(): number {
  if (journalDocsCol.get().length > 0) return 0

  const today = todayKey()
  let added = 0

  for (const s of SAMPLES) {
    const date = addDays(today, -s.daysAgo)
    // createdAt / updatedAt：用該日中午做合理 ISO 時戳（穩定、唔係未來）。
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
