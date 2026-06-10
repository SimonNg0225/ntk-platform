import i18n from '../../../i18n'

// ============================================================
//  測驗模式 QuizMode — 功能級 i18n bundle（decoupled side-effect）：只加 'en' 嘅 `quiz` namespace。
//  ------------------------------------------------------------
//  解耦設計：呢個檔淨係 addResourceBundle('en', …) 注入英文，
//  唔郁共用 i18n/index.ts。namespace 用 'quiz'，deepMerge +
//  overwrite = true。zh-HK 保持原樣（唔加 bundle）—— 元件度用
//  t('quiz.<key>', { defaultValue: '<原文廣東話>' }) 取值，
//  廣東話介面 byte-identical。
// ============================================================

i18n.addResourceBundle(
  'en',
  'translation',
  {
    quiz: {
      // ── 頁面身份 / masthead ──
      kicker: 'Quiz Arena',
      title: 'Self-Quiz',
      subtitle: 'Pick a mode and start — auto-marked, instant mastery feedback',

      // ── 賽況行 ──
      battleCount: 'Played {{count}} times',
      bestScore: 'Best {{score}}%',

      // ── Tabs ──
      tabQuiz: 'Quiz',
      tabStats: 'Stats',
      tabMistakes: 'Mistake Bank',
    },
  },
  true,
  true,
)
