import type { Deck } from '../../../../lib/export/types'

// ============================================================
//  風格示意 deck —— steps 1-3 右邊預覽用，揀模板即時換色睇設計感。
//  純示意內容；step 4 生成後會換成用戶真 deck。
// ============================================================

export const SAMPLE_DECK: Deck = {
  title: '示範簡報 — 揀個設計風格',
  subtitle: 'Choose your design',
  coverImageQuery: 'classroom learning',
  slides: [
    { title: '學習目標', bullets: ['理解核心概念', '連結生活例子', '扣連考評要求'] },
    {
      title: '課堂三步',
      bullets: [],
      layout: 'steps',
      steps: [
        { title: '引入', desc: '由生活情境出發' },
        { title: '講解', desc: '拆解原理同例子' },
        { title: '練習', desc: '即時應用鞏固' },
      ],
    },
    {
      title: '關鍵數據',
      bullets: [],
      layout: 'stats',
      stats: [
        { value: '3', label: '學習步驟' },
        { value: '100%', label: '課堂適用' },
        { value: '幾分鐘', label: '完成生成' },
      ],
      takeaway: '一份簡報，幾分鐘搞掂',
    },
  ],
}
