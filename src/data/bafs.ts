import type { Topic } from './types'

// ============================================================
//  HKDSE BAFS 課題種子（必修 + 選修：商業管理單元）
//  ------------------------------------------------------------
//  用穩定 id（bm-xx）方便其他資料（進度/題目/評估）連住。
//  用家可以喺介面自行增刪改。
// ============================================================

const COMPULSORY = '必修'
const ELECTIVE = '選修（商業管理）'

let n = 0
const t = (part: string, area: string, topic: string): Topic => ({
  id: `bafs-${String(++n).padStart(2, '0')}`,
  part,
  area,
  topic,
  order: n,
})

export const BAFS_TOPICS: Topic[] = [
  // ───── 必修部分 ─────
  t(COMPULSORY, '商業環境', '香港營商環境'),
  t(COMPULSORY, '商業環境', '企業擁有權形式'),
  t(COMPULSORY, '商業環境', '商業道德與社會責任'),

  t(COMPULSORY, '管理入門', '管理職能（計劃／組織／領導／控制）'),
  t(COMPULSORY, '管理入門', '商業主要職能'),

  t(COMPULSORY, '會計入門', '會計的目的與角色'),
  t(COMPULSORY, '會計入門', '會計原則與概念'),
  t(COMPULSORY, '會計入門', '複式記賬基礎'),
  t(COMPULSORY, '會計入門', '財務報表（損益表、財務狀況表）'),

  t(COMPULSORY, '個人理財基礎', '個人理財計劃'),
  t(COMPULSORY, '個人理財基礎', '風險管理與保險'),
  t(COMPULSORY, '個人理財基礎', '貨幣的時間價值'),

  // ───── 選修：商業管理單元 ─────
  t(ELECTIVE, '財務管理', '財務管理的目標與功能'),
  t(ELECTIVE, '財務管理', '營運資金管理'),
  t(ELECTIVE, '財務管理', '投資評估'),
  t(ELECTIVE, '財務管理', '融資來源'),

  t(ELECTIVE, '人力資源管理', '人力資源規劃'),
  t(ELECTIVE, '人力資源管理', '招聘與甄選'),
  t(ELECTIVE, '人力資源管理', '培訓與發展'),
  t(ELECTIVE, '人力資源管理', '績效管理與薪酬'),

  t(ELECTIVE, '市場營銷管理', '市場營銷概念與市場研究'),
  t(ELECTIVE, '市場營銷管理', '目標市場與市場定位'),
  t(ELECTIVE, '市場營銷管理', '市場營銷組合（4Ps）'),

  t(ELECTIVE, '生產及營運管理', '營運與生產過程'),
  t(ELECTIVE, '生產及營運管理', '物料與庫存管理'),
  t(ELECTIVE, '生產及營運管理', '品質管理'),
  t(ELECTIVE, '生產及營運管理', '生產力'),
]
