import type { SubjectKnowledge } from '../../../data/subjectProfiles/types'
import type { StructuredOpts } from './structured'

// ============================================================
//  Rich 結構化批改 prompt —— 由科目知識檔案（strand / area）驅動
//  ------------------------------------------------------------
//  輸出 JSON 格式同 structured.ts 一致，所以 parseStructured 照用。
//  畀有 rich 知識檔嘅科（如 BAFS 兩範疇）做度身定制批改。
// ============================================================

export interface RichOpts extends StructuredOpts {
  /** 學習範疇 key（如 BAFS 嘅 accounting / bm / core）。 */
  strandKey?: string
  /** 課題範疇 key；空 = 全部（由 AI 按題目自動判斷）。 */
  areaKey?: string
}

/** 攞目前生效嘅 strand（揾唔到 → 第一個）。 */
export function resolveStrand(k: SubjectKnowledge, strandKey?: string) {
  return k.strands.find((s) => s.key === strandKey) ?? k.strands[0]
}

export function buildRichSystem(k: SubjectKnowledge, opts: RichOpts = {}): string {
  const strand = resolveStrand(k, opts.strandKey)
  const area = opts.areaKey ? strand.areas.find((a) => a.key === opts.areaKey) : undefined
  const isEn = k.lang === 'en'

  const rubricLine = opts.rubric?.trim()
    ? `按以下老師自訂評分準則批改：\n${opts.rubric.trim()}`
    : area
      ? `按以下準則評分：${area.rubric.map((r) => `${r.criterion}（${r.max}）— ${r.focus}`).join('；')}`
      : `按 ${strand.label} 常見準則評分（概念 / 應用 / 論證 或 計算 / 格式），請按題目自動判斷課題。`

  const maxNote = opts.totalMarks?.trim()
    ? `總滿分為 ${opts.totalMarks.trim()}，請按比例分配各準則。`
    : '如無另定，總滿分 = 各準則滿分合計。'

  const focus: string[] = []
  if (area) {
    focus.push(`【課題範疇】${area.label}`)
    if (area.keyConcepts.length) focus.push(`核心概念：${area.keyConcepts.join('、')}`)
    if (area.markingConventions.length) focus.push(`批改慣例：\n- ${area.markingConventions.join('\n- ')}`)
    if (area.commonErrors.length) focus.push(`考生常見失分（要主動捉）：\n- ${area.commonErrors.join('\n- ')}`)
  } else {
    focus.push(`【範疇】${strand.label}（涵蓋：${strand.areas.map((a) => a.label).join('、')}）`)
  }

  const issueKeys = (area?.issueTypes?.length ? area.issueTypes : ['concept', 'calc', 'application', 'wording']).join('|')
  const cw = k.commandWords.map((c) => `${c.word}：${c.meaning}`).join('\n')
  const lv = k.levelDescriptors.map((l) => `${l.level}：${l.descriptor}`).join('\n')

  const parts: string[] = [
    strand.persona,
    `科目：${k.label}。`,
    rubricLine,
    maxNote,
    ...focus,
    `【DSE 命令詞】\n${cw}`,
    `【答題等級參考】\n${lv}`,
  ]
  if (opts.question?.trim()) parts.push(`【題目 / 提示】\n${opts.question.trim()}`)
  parts.push(
    '只輸出一個 JSON 物件，唔好有任何其他文字或 markdown code fence：',
    '{',
    '  "total": 總分(數字), "maxTotal": 滿分(數字),',
    '  "scores": [{"criterion":"準則名","score":得分,"max":該項滿分,"comment":"一句評語"}],',
    `  "issues": [{"quote":"原文失分點/錯處（照抄，短）","type":"${issueKeys}","suggestion":"建議改法"}],`,
    '  "overall": "總評（2-4 句，具體、有建設性，避免人身批評）"',
    '}',
    '規則：',
    '- 緊扣題目 / 個案；方法 / 步驟啱但答案錯，應酌量畀方法分；計算要帶單位 / 貨幣。',
    '- issues 嘅 quote 必須係學生作答真實出現嘅文字（照抄，唔好改寫）；數理 / 會計可引錯誤算式或步驟。',
    `- 錯處 type 只可用：${issueKeys}。`,
    isEn ? '- comment / suggestion / overall in English.' : '- comment / suggestion / overall 用繁體中文。',
    '- 公平、有理據；只輸出 JSON。',
  )
  return parts.join('\n')
}
