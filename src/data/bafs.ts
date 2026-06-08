import type { Topic } from './types'

// ============================================================
//  HKDSE BAFS 課題種子 — 商業管理範疇（必修 1(a)–1(d) + 選修 3(a)–3(d)）
//  ------------------------------------------------------------
//  對齊「課程及評估指引」+ 考評局商業管理範疇補充資料嘅官方結構。
//  area 用官方編號（1(a) 營商環境…）方便老師對返指引。
//  用穩定 id（bafs-NN）方便其他資料（進度/題目/評估）連住；
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
  t(COMPULSORY, '1(a) 營商環境', '香港的營商環境'),
  t(COMPULSORY, '1(a) 營商環境', '企業擁有權類型'),
  t(COMPULSORY, '1(a) 營商環境', '商業道德與社會責任'),

  t(COMPULSORY, '1(b) 商業管理導論', '商業的主要功能'),
  t(COMPULSORY, '1(b) 商業管理導論', '管理的功能（計劃、組織、領導、控制）'),
  t(COMPULSORY, '1(b) 商業管理導論', '商業的組織形式'),

  t(COMPULSORY, '1(c) 基礎會計', '會計的目的及角色'),
  t(COMPULSORY, '1(c) 基礎會計', '會計循環（複式記帳、會計等式）'),
  t(COMPULSORY, '1(c) 基礎會計', '財務報表（利潤表、財務狀況表）'),
  t(COMPULSORY, '1(c) 基礎會計', '財務報表的用途與使用者'),

  t(COMPULSORY, '1(d) 基礎個人理財', '個人理財策劃'),
  t(COMPULSORY, '1(d) 基礎個人理財', '貨幣的時間價值'),
  t(COMPULSORY, '1(d) 基礎個人理財', '投資工具（存款、債券、股票）'),
  t(COMPULSORY, '1(d) 基礎個人理財', '風險與回報'),

  // ───── 選修部分：商業管理單元 ─────
  t(ELECTIVE, '3(a) 管理導論', '商業的組織（部門化：職能／產品／地區）'),
  t(ELECTIVE, '3(a) 管理導論', '管理功能（計劃、組織、領導、控制）'),
  t(ELECTIVE, '3(a) 管理導論', '領導風格'),
  t(ELECTIVE, '3(a) 管理導論', '主要商業功能'),
  t(ELECTIVE, '3(a) 管理導論', '中小型企業'),

  t(ELECTIVE, '3(b) 財務管理', '財務分析（會計比率）'),
  t(ELECTIVE, '3(b) 財務管理', '預算編製'),
  t(ELECTIVE, '3(b) 財務管理', '融資方式'),
  t(ELECTIVE, '3(b) 財務管理', '資本投資評估'),
  t(ELECTIVE, '3(b) 財務管理', '營運資本管理'),
  t(ELECTIVE, '3(b) 財務管理', '風險管理'),

  t(ELECTIVE, '3(c) 人力資源管理', '人力資源管理的功能'),
  t(ELECTIVE, '3(c) 人力資源管理', '招聘與甄選'),
  t(ELECTIVE, '3(c) 人力資源管理', '培訓與發展'),
  t(ELECTIVE, '3(c) 人力資源管理', '績效管理與薪酬'),
  t(ELECTIVE, '3(c) 人力資源管理', '發展優質人力'),

  t(ELECTIVE, '3(d) 市場營銷管理', '市場營銷的角色與概念'),
  t(ELECTIVE, '3(d) 市場營銷管理', '市場研究'),
  t(ELECTIVE, '3(d) 市場營銷管理', '目標市場與定位'),
  t(ELECTIVE, '3(d) 市場營銷管理', '市場營銷組合（4Ps）'),
  t(ELECTIVE, '3(d) 市場營銷管理', '產品與服務的市場營銷'),
]
