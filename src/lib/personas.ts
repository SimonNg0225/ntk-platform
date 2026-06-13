// ============================================================
//  教師形象頭像 persona — 公開 API（中繼資料 + 輔助）
//  ------------------------------------------------------------
//  20 款（男 10 / 女 10，覆蓋年齡層同特色），由 DiceBear avataaars
//  build-time 生成（scripts/gen-personas.mjs）。資料喺 personas.generated.ts，
//  SVG 喺 public/personas/<id>.svg。呢度只加查詢 / 分組輔助，UI 統一由此 import。
// ============================================================
import { PERSONAS } from './personas.generated'
import type { PersonaAge, PersonaGender, PersonaMeta } from './personas.generated'

export { PERSONAS }
export type { PersonaMeta, PersonaGender, PersonaAge }

/** persona SVG 嘅公開路徑（Vite 由 public/ 直出）。 */
export const personaSvgUrl = (id: string): string => `/personas/${id}.svg`

const PERSONA_IDS = new Set(PERSONAS.map((p) => p.id))

/** 收窄：係咪有效 persona id（防止存咗已下架 / 亂數據）。 */
export const isPersonaId = (v: unknown): v is string =>
  typeof v === 'string' && PERSONA_IDS.has(v)

/** 按性別分組（畀揀頭像 UI 排「男老師 / 女老師」）。 */
export const PERSONAS_BY_GENDER: Record<PersonaGender, PersonaMeta[]> = {
  male: PERSONAS.filter((p) => p.gender === 'male'),
  female: PERSONAS.filter((p) => p.gender === 'female'),
}
