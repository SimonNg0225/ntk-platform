import type { SubjectKnowledge } from './types'
import { BAFS } from './bafs'

// ============================================================
//  科目知識檔案 registry
//  ------------------------------------------------------------
//  有 rich 知識檔嘅科目 → AI 批改用 strand / area 度身定制；
//  其餘科目 → 退回 grading/markingProfiles 嘅 generic 版。
//  逐科加文件調教嘅流程見 docs/subject-profiles.md。
// ============================================================

export type { SubjectKnowledge, StrandProfile, AreaProfile, AreaRubricItem } from './types'

const REGISTRY: Record<string, SubjectKnowledge> = {
  bafs: BAFS,
}

/** 攞某科 rich 知識檔（無 → undefined，grading 用 generic）。 */
export function getSubjectKnowledge(packId: string | undefined | null): SubjectKnowledge | undefined {
  return packId ? REGISTRY[packId] : undefined
}
