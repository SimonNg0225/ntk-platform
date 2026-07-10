import type { ComposerMaterialTool } from '../features/shared/composerHandoff'

export type ComposerRoute = {
  featureId: string
  label: string
  handoffText?: string
  materialTool?: ComposerMaterialTool
}

const hasIntent = (text: string, patterns: readonly RegExp[]) =>
  patterns.some((pattern) => pattern.test(text))

function stripSearchIntent(input: string): string {
  return (
    input
      .trim()
      .replace(
        /^(幫我|請|please)?\s*(全域搜尋|搜尋|搜索|搜尋返|找回|找|查找|search|find)\s*/i,
        '',
      )
      .replace(/^(一下|下)\s*/i, '')
      .trim() || input.trim()
  )
}

function stripAskDataIntent(input: string): string {
  return (
    input
      .trim()
      .replace(
        /^(幫我|請|please)?\s*(問我的資料\s*AI|問我資料\s*AI|問我的資料|問我資料|根據我的資料|用我的資料|查我的資料)\s*[:：,，]?\s*/i,
        '',
      )
      .trim() || input.trim()
  )
}

function materialToolFor(text: string): ComposerMaterialTool {
  if (/試卷|exam paper|paper/i.test(text)) return 'paper'
  if (/工作紙|worksheet/i.test(text)) return 'worksheet'
  if (/選擇題|多項選擇|\bmc\b|mcq/i.test(text)) return 'mc'
  if (/個案|case/i.test(text)) return 'case'
  if (/長題|essay|long question/i.test(text)) return 'long'
  if (/短答|short answer/i.test(text)) return 'short'
  return 'worksheet'
}

export function inferWorkToolRoute(input: string): ComposerRoute | null {
  const text = input.trim().toLowerCase()
  if (!text) return null

  if (
    hasIntent(text, [
      /(整|做|製作|生成|設計|準備|建立|create|make|build).{0,18}(ppt|powerpoint|簡報|投影片|slides?|deck|presentation)/i,
      /^(ppt|powerpoint|簡報|投影片|slides?|deck|presentation)\s*(製作|生成|設計|create|make)?/i,
    ])
  ) {
    return { featureId: 'work-slides', label: '簡報工作室' }
  }

  if (
    hasIntent(text, [
      /成績|分數|測驗結果|考試結果|預測等級|弱項|合格率|班平均/i,
      /(分析|比較|預測|診斷).{0,12}(測驗|考試|學生|班級)/i,
    ])
  ) {
    return { featureId: 'work-grade-analytics', label: '成績分析' }
  }

  if (hasIntent(text, [/評分準則|評分量表|rubric|marking scheme|評分指引/i])) {
    return { featureId: 'work-rubric', label: '評分準則' }
  }

  if (
    hasIntent(text, [
      /工作紙|小測|出題|試卷|練習題|題目|選擇題|多項選擇|短答|長題|個案題|worksheet|quiz|exam paper|mcq/i,
      /(生成|設計|準備|製作).{0,16}(教材|練習|測驗|考核)/i,
    ])
  ) {
    return {
      featureId: 'work-generate',
      label: '教材生成',
      materialTool: materialToolFor(text),
    }
  }

  if (
    hasIntent(text, [
      /備課|教案|lesson plan|教學計劃/i,
      /(準備|設計|規劃).{0,18}(一堂|課堂|教學流程|教學活動)/i,
    ])
  ) {
    return { featureId: 'work-lesson-plan', label: '備課 / 教案' }
  }

  if (hasIntent(text, [/錄音|轉文字|逐字稿|transcrib|audio|聲音|mp3|m4a/i])) {
    return { featureId: 'work-transcribe', label: '錄音轉文字' }
  }

  if (hasIntent(text, [/掃描|影低|影相|相片|scan|拍照|pdf\s*掃描/i])) {
    return { featureId: 'work-scan', label: '掃描 PDF' }
  }

  if (hasIntent(text, [/word.{0,8}(範本|模板|套版)|行政文件.{0,8}(生成|套版)|填寫.{0,8}範本/i])) {
    return { featureId: 'work-admin-docs', label: '行政文件' }
  }

  if (hasIntent(text, [/(文件|通告|報告).{0,12}(摘要|撮要|重點|待辦|速讀)/i, /文件速讀|document digest/i])) {
    return { featureId: 'work-doc-digest', label: '文件速讀' }
  }

  if (hasIntent(text, [/家長.{0,12}(訊息|電郵|回覆|溝通)|電郵回覆|email reply/i])) {
    return { featureId: 'work-prompt-library', label: '教學助手' }
  }

  if (
    hasIntent(text, [
      /^(幫我|請|please)?\s*(全域搜尋|搜尋|搜索|搜尋返|找回|找|查找|search|find)/i,
      /搜尋返.*(筆記|教案|題目|資源|會議|待辦)/i,
    ])
  ) {
    return {
      featureId: 'search',
      label: '全域搜尋',
      handoffText: stripSearchIntent(input),
    }
  }

  return null
}

export function inferLearningComposerRoute(input: string): ComposerRoute {
  const text = input.trim().toLowerCase()
  if (!text) return { featureId: 'learning-ai', label: '個人 AI 助手' }
  if (
    hasIntent(text, [
      /問我.*資料|我的資料|根據.*資料|用.*資料.*答|資料.*ai/i,
      /我最近.*(記低|學過|安排)|我有什麼(目標|日程|待辦)/i,
    ])
  ) {
    return {
      featureId: 'ask-data',
      label: '資料問答 AI',
      handoffText: stripAskDataIntent(input),
    }
  }
  if (
    hasIntent(text, [
      /^(幫我|請|please)?\s*(全域搜尋|搜尋|搜索|搜尋返|找回|找|查找|search|find)/i,
      /全域搜尋|平台中.*(搜尋|找)|搜尋返.*(筆記|知識卡|日誌|目標|日程)/i,
    ])
  ) {
    return {
      featureId: 'search',
      label: '全域搜尋',
      handoffText: stripSearchIntent(input),
    }
  }
  if (hasIntent(text, [/知識卡|flashcard|卡片|溫習卡/i])) {
    return { featureId: 'learning-card-generator', label: 'AI 生成知識卡' }
  }
  if (hasIntent(text, [/筆記|整理|總結|note|notes/i])) {
    return { featureId: 'learning-notes', label: '個人筆記' }
  }
  if (hasIntent(text, [/複習|溫習|到期|記憶|srs|flashcard/i])) {
    return { featureId: 'learning-flashcards', label: '知識卡 + 複習' }
  }
  if (hasIntent(text, [/目標|計劃|plan|下一步|goal/i])) {
    return { featureId: 'learning-goals', label: '個人目標' }
  }
  return { featureId: 'learning-ai', label: '個人 AI 助手' }
}
