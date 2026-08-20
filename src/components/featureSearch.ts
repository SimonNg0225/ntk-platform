export const FEATURE_SEARCH_ALIASES: Record<string, string[]> = {
  'work-classroom-pack': ['課堂套裝', '整套備課', '一堂課', '教案 工作紙 簡報', 'lesson pack', 'classroom pack'],
  'work-ai': ['助手對話', 'chat', '追問', '修改答案', '繼續生成'],
  'work-prompt-library': ['教學助手', 'prompt', 'prompt 大全', 'AI 助手', '家長信', '電郵', 'email', '評語', '課堂活動'],
  'work-voice-assistant': ['Ezi 助手', '智能助手', '語音助手', '智能語音', 'voice assistant', '講嘢', '咪高峰', '廣東話', 'Friday'],
  'work-lesson-plan': ['備課', '教案', 'lesson plan', '下一堂', '教學目標', '教學流程'],
  'work-generate': ['出題', '小測', 'quiz', 'worksheet', '練習', '試卷', '題目', 'MC'],
  'work-teach-guide': ['如何教', '教法', '教學指引', '學生誤解', '活動設計'],
  'work-slides': ['PPT', 'PowerPoint', 'slides', '簡報', '教學簡報'],
  'work-rubric': ['rubric', '評分', '評分點', '評分準則', '參考答案', 'marking'],
  'work-dse': ['DSE', '公開試', '操練', 'past paper', '考試題'],
  'work-grade-analytics': ['成績', '分數', '預測等級', '弱項', '班級分析', 'grade'],
  'work-topic-import': ['syllabus', '課程指引', '課題', '匯入課題'],
  'work-resources': ['資源', '教材', '講義', '連結', '收藏'],
  'work-community': ['分享', '下載', '老師資源', 'community'],
  'work-tasks': ['待辦', 'todo', '批改', '跟進', '行政事項'],
  'work-meeting-notes': ['會議', 'meeting', 'minutes', '會議記錄'],
  'work-admin-docs': ['行政文件', 'docx', '範本', '通告', '表格'],
  'work-scan': ['掃描', 'scan', '相片', 'PDF'],
  'work-doc-digest': ['文件摘要', '速讀', 'PDF', '行政文件', '重點'],
  'work-transcribe': ['長錄音', '錄音檔', '逐字稿', 'transcribe', 'meeting audio'],
  'work-observation': ['觀課', '評課', 'lesson observation'],
  'work-report': ['週報', '工作報告', '回顧', 'report'],
  'learning-ai': ['AI 助手', 'chat', '問 AI', '解釋', '總結'],
  'learning-card-generator': ['flashcard', '知識卡', '溫習卡', '生成卡'],
  'learning-notes': ['筆記', 'notes', '記低', '整理'],
  'learning-flashcards': ['flashcard', 'SRS', '溫習', '複習'],
  'learning-goals': ['目標', 'goal', '計劃'],
  'ask-data': ['問資料', '我的資料', '搜尋資料', 'AI search'],
  calendar: ['日曆', 'calendar', '排程', '提醒', 'deadline', '日程'],
  search: ['搜尋', 'search', '搜尋資料', '全域'],
  inbox: ['快速擷取', 'inbox', '記低', '收件箱', 'capture'],
  countdown: ['倒數', 'deadline', '重要日子', '考試'],
  quiz: ['測驗', 'quiz', 'MC', '自測', '做題'],
}

export function matchesSearchQuery(query: string, texts: readonly string[]): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return texts.some((text) => text.toLowerCase().includes(q))
}
