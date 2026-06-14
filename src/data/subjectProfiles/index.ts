import type { SubjectKnowledge } from './types'
import { BAFS } from './bafs'
import { CHIN } from './chin'
import { ENG } from './eng'
import { MATH } from './math'
import { CSD } from './csd'
import { ECON } from './econ'
import { PHYS } from './phys'
import { CHEM } from './chem'
import { BIO } from './bio'
import { CHLIT } from './chlit'
import { ENGLIT } from './englit'
import { CHIST } from './chist'
import { HIST } from './hist'
import { GEOG } from './geog'
import { ERS } from './ers'
import { THS } from './ths'
import { ICT } from './ict'
import { DAT } from './dat'
import { HMSC } from './hmsc'
import { TL } from './tl'
import { SCI } from './sci'
import { M1 } from './m1'
import { M2 } from './m2'
import { PE } from './pe'
import { VA } from './va'
import { MUSIC } from './music'

// ============================================================
//  科目知識檔案 registry
//  ------------------------------------------------------------
//  有 rich 知識檔嘅科目 → AI 批改用 strand / area 度身定制；
//  其餘科目 → 退回 grading/markingProfiles 嘅 generic 版。
//  逐科加文件調教嘅流程見 docs/subject-profiles.md。
// ============================================================

export type { SubjectKnowledge, StrandProfile, AreaProfile, AreaRubricItem } from './types'

// BAFS 拆兩科：會計範疇 / 商業管理範疇（各含必修 core + 自己範疇）。由合併 BAFS 派生。
const BAFS_ACCT: SubjectKnowledge = {
  ...BAFS,
  subject: 'bafs-acct',
  label: '企會財（會計範疇）',
  strands: BAFS.strands.filter((s) => s.key === 'core' || s.key === 'accounting'),
}
const BAFS_BM: SubjectKnowledge = {
  ...BAFS,
  subject: 'bafs-bm',
  label: '企會財（商業管理範疇）',
  strands: BAFS.strands.filter((s) => s.key === 'core' || s.key === 'bm'),
}

const REGISTRY: Record<string, SubjectKnowledge> = {
  'bafs-acct': BAFS_ACCT,
  'bafs-bm': BAFS_BM,
  bafs: BAFS_ACCT, // 舊資料 subjectPackId / 記錄 = 'bafs' → 當會計範疇處理
  chin: CHIN,
  eng: ENG,
  math: MATH,
  csd: CSD,
  econ: ECON,
  phys: PHYS,
  chem: CHEM,
  bio: BIO,
  chlit: CHLIT,
  englit: ENGLIT,
  chist: CHIST,
  hist: HIST,
  geog: GEOG,
  ers: ERS,
  ths: THS,
  ict: ICT,
  dat: DAT,
  hmsc: HMSC,
  tl: TL,
  sci: SCI,
  m1: M1,
  m2: M2,
  pe: PE,
  va: VA,
  music: MUSIC,
}

/** 攞某科 rich 知識檔（無 → undefined，grading 用 generic）。 */
export function getSubjectKnowledge(packId: string | undefined | null): SubjectKnowledge | undefined {
  return packId ? REGISTRY[packId] : undefined
}
