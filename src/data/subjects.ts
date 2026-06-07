import type { Topic } from './types'
import { BAFS_TOPICS } from './bafs'

// ============================================================
//  科目包 (Subject Packs)
//  ------------------------------------------------------------
//  商業化通用化：平台對象係全港跨科老師，唔再淨係 BAFS。
//  每個科目包提供一份「課題大綱」起始資料，老師揀咗就可以一鍵
//  載入去 topics 集合（之後照樣可以喺介面自行增刪改）。
//
//  設計：
//   - BAFS 包直接重用 src/data/bafs.ts 嘅 BAFS_TOPICS（id = bafs-NN），
//     令預設 topics 集合同舊版完全一致（唔影響既有資料 / 測試）。
//   - 其他包用 outline（[part, area, topic]）+ buildPackTopics 生成
//     穩定 id（`${packId}-NN`）。
//   - 大綱係「起始模板」，求其精簡可用，唔保證涵蓋官方課程全部細項；
//     老師可自行調整。
// ============================================================

export interface SubjectPack {
  /** 穩定識別碼（亦做 topic id 前綴），例如 'bafs'、'econ' */
  id: string
  /** 完整科目名稱 */
  name: string
  /** 短名 / 縮寫，用喺選單 chip */
  short: string
  /** 課題清單（已生成穩定 id / order） */
  topics: Topic[]
}

type OutlineRow = [part: string, area: string, topic: string]

function buildTopics(packId: string, outline: OutlineRow[]): Topic[] {
  return outline.map(([part, area, topic], i) => ({
    id: `${packId}-${String(i + 1).padStart(2, '0')}`,
    part,
    area,
    topic,
    order: i + 1,
  }))
}

/** 由科目包生成 Topic[]（BAFS 直接用內建，其餘已預先 build 好）。 */
export function packTopics(pack: SubjectPack): Topic[] {
  return pack.topics
}

// ── 各科起始大綱 ──────────────────────────────────────────────
const CORE = '必修'

const ECON: OutlineRow[] = [
  [CORE, '基本經濟概念', '稀少性、選擇與機會成本'],
  [CORE, '基本經濟概念', '生產可能性曲線'],
  [CORE, '廠商與生產', '生產要素與分工'],
  [CORE, '廠商與生產', '成本、收益與利潤'],
  [CORE, '市場與價格', '需求、供給與市場均衡'],
  [CORE, '市場與價格', '彈性'],
  [CORE, '市場與價格', '價格管制與稅項'],
  [CORE, '市場結構', '完全競爭與壟斷'],
  [CORE, '國民收入與經濟表現', '國民收入計算（GDP）'],
  [CORE, '國民收入與經濟表現', '通脹、失業與經濟增長'],
  [CORE, '貨幣與銀行', '貨幣功能與銀行體系'],
  [CORE, '政府與經濟', '財政政策與貨幣政策'],
  [CORE, '國際貿易與金融', '比較優勢與貿易'],
  [CORE, '國際貿易與金融', '匯率與國際收支'],
]

const CHIN: OutlineRow[] = [
  ['閱讀', '文言文', '指定文言經典篇章'],
  ['閱讀', '白話文', '記敘 / 描寫 / 抒情 / 說明 / 議論文'],
  ['閱讀', '閱讀理解', '篇章分析與寫作手法'],
  ['寫作', '實用文', '書信、啟事、演講辭、建議書'],
  ['寫作', '記敘抒情', '記事與抒情寫作'],
  ['寫作', '議論文', '立論、駁論與論證'],
  ['聆聽與說話', '聆聽', '聆聽理解與摘錄重點'],
  ['聆聽與說話', '說話', '小組討論與個人短講'],
  ['文化與品德', '中華文化', '經典與文化專題'],
]

const ENG: OutlineRow[] = [
  ['Reading', 'Skills', 'Skimming, scanning & inference'],
  ['Reading', 'Text types', 'Articles, reports, narratives'],
  ['Writing', 'Functional', 'Letters, emails, proposals'],
  ['Writing', 'Argumentative', 'Essays & persuasive writing'],
  ['Listening', 'Skills', 'Note-taking & integrated tasks'],
  ['Speaking', 'Group interaction', 'Discussion & decision-making'],
  ['Speaking', 'Individual response', 'Presentation & Q&A'],
  ['Language', 'Grammar', 'Tenses, voice, clauses'],
  ['Language', 'Vocabulary', 'Collocations & register'],
]

const MATH: OutlineRow[] = [
  [CORE, '數與代數', '指數與對數'],
  [CORE, '數與代數', '多項式與恒等式'],
  [CORE, '數與代數', '方程與不等式'],
  [CORE, '數與代數', '函數及其圖像'],
  [CORE, '幾何與三角', '坐標幾何'],
  [CORE, '幾何與三角', '三角函數與恒等式'],
  [CORE, '幾何與三角', '圓的性質'],
  [CORE, '統計與概率', '統計圖表與量度'],
  [CORE, '統計與概率', '概率'],
  [CORE, '統計與概率', '常態分佈'],
]

const CSD: OutlineRow[] = [
  ['主題一', '「一國兩制」下的香港', '香港特區的政治體制與法治'],
  ['主題一', '「一國兩制」下的香港', '香港參與國家事務與發展機遇'],
  ['主題二', '改革開放以來的國家', '國家的發展歷程與成就'],
  ['主題二', '改革開放以來的國家', '國家的科技與經濟發展'],
  ['主題二', '改革開放以來的國家', '國民身分與《憲法》、《基本法》'],
  ['主題三', '互聯相依的當代世界', '經濟全球化與可持續發展'],
  ['主題三', '互聯相依的當代世界', '公共衞生與科技倫理'],
  ['專題', '專題探究', '議題探究與資料判讀'],
]

const PHYS: OutlineRow[] = [
  [CORE, '熱學', '溫度、熱量與物態變化'],
  [CORE, '力學', '運動學與牛頓定律'],
  [CORE, '力學', '功、能量與動量'],
  [CORE, '波動', '波的性質與聲波'],
  [CORE, '波動', '光與透鏡'],
  [CORE, '電與磁', '電路與電阻'],
  [CORE, '電與磁', '電磁感應'],
  [CORE, '放射現象與核能', '放射性與核反應'],
]

const CHEM: OutlineRow[] = [
  [CORE, '地球物質', '海洋與大氣中的物質'],
  [CORE, '微觀世界', '原子結構與化學鍵'],
  [CORE, '金屬', '金屬反應性與提取'],
  [CORE, '酸鹼與鹽', '酸鹼反應與中和'],
  [CORE, '氧化還原與電化學', '氧化還原反應'],
  [CORE, '氧化還原與電化學', '化學電池與電解'],
  [CORE, '化學反應速率與能量', '反應速率'],
  [CORE, '有機化學', '碳氫化合物與官能基'],
]

const BIO: OutlineRow[] = [
  [CORE, '細胞與生命分子', '細胞結構與物質運輸'],
  [CORE, '細胞與生命分子', '酶與代謝'],
  [CORE, '人體生理', '營養與消化'],
  [CORE, '人體生理', '氣體交換與循環'],
  [CORE, '人體生理', '神經與內分泌協調'],
  [CORE, '生殖、遺傳與進化', '生殖與發育'],
  [CORE, '生殖、遺傳與進化', '遺傳與變異'],
  [CORE, '生態與環境', '生態系統與能量流動'],
]

// 通用空白包：唔啱上面任何科 / 想自己由零建立課題嘅老師用。
const CUSTOM: Topic[] = []

export const SUBJECT_PACKS: SubjectPack[] = [
  { id: 'bafs', name: '企業、會計與財務概論 (BAFS)', short: 'BAFS', topics: BAFS_TOPICS },
  { id: 'econ', name: '經濟', short: '經濟', topics: buildTopics('econ', ECON) },
  { id: 'chin', name: '中國語文', short: '中文', topics: buildTopics('chin', CHIN) },
  { id: 'eng', name: '英國語文', short: 'English', topics: buildTopics('eng', ENG) },
  { id: 'math', name: '數學（必修部分）', short: '數學', topics: buildTopics('math', MATH) },
  { id: 'csd', name: '公民與社會發展', short: '公民', topics: buildTopics('csd', CSD) },
  { id: 'phys', name: '物理', short: '物理', topics: buildTopics('phys', PHYS) },
  { id: 'chem', name: '化學', short: '化學', topics: buildTopics('chem', CHEM) },
  { id: 'bio', name: '生物', short: '生物', topics: buildTopics('bio', BIO) },
  { id: 'custom', name: '其他科目（自訂課題）', short: '自訂', topics: CUSTOM },
]

/** 預設科目包 id（＝ BAFS，保持與舊版 topics 種子一致）。 */
export const DEFAULT_SUBJECT_PACK_ID = 'bafs'

export function getSubjectPack(id: string): SubjectPack | undefined {
  return SUBJECT_PACKS.find((p) => p.id === id)
}
