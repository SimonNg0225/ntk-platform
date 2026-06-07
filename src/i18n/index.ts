import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// ============================================================
//  i18n（多語言）
//  ------------------------------------------------------------
//  預設 zh-HK（廣東話）；另備 en。語言存 localStorage。
//  目前覆蓋行銷 / 商業化表層（Landing 等）+ 語言切換；產品 30+ 功能
//  嘅逐字 i18n 屬漸進工作（已建立 t() 模式，後續按 namespace 擴充）。
// ============================================================

export const LANGUAGES = [
  { id: 'zh-HK', label: '廣東話' },
  { id: 'en', label: 'English' },
] as const
export type LangId = (typeof LANGUAGES)[number]['id']

const STORAGE_KEY = 'ntk.lang'

function initialLang(): LangId {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'zh-HK' || v === 'en') return v
  } catch {
    /* ignore */
  }
  return 'zh-HK'
}

const resources = {
  'zh-HK': {
    translation: {
      signingIn: '登入中…',
      nav: { pricing: '定價', start: '免費開始', enterApp: '進入工作台' },
      hero: {
        badge: '專為香港老師而設',
        h1pre: '老師的日常工作，一個平台',
        h1accent: '由頭到尾搞掂',
        sub: '備課、AI 出題、成績與弱項分析、點名、家長溝通、行政文件 —— 散落喺 Excel、WhatsApp、紙張嘅教學工作，收返埋一個專業工作台。',
        ctaStart: '免費開始使用',
        ctaEnter: '進入工作台',
        ctaPricing: '查看定價',
        noCard: '無需信用卡 · 即開即用 · 適用任何任教科目',
      },
      featuresTitle: '涵蓋老師的一週',
      f: {
        prepTitle: '備課與課程進度',
        prepDesc: '撰寫教案、對住課程大綱逐班追蹤教學進度，學期規劃一目了然。',
        aiTitle: 'AI 出題與試卷',
        aiDesc: '輸入課題即生成 MC／短答／長題，一鍵入題庫、自動砌成試卷與工作紙。',
        gradeTitle: '成績與弱項分析',
        gradeDesc: '記分自動計算平均與排名，標出全班弱項，評估數據變成教學決策。',
        attTitle: '時間表與點名',
        attDesc: '每週課堂時間表、逐堂點名統計出席率，代課調堂一眼睇晒。',
        commTitle: '家長溝通與行政',
        commDesc: '聯絡記錄連範本、會議筆記、Word 行政文件逐欄填好即印。',
        aiaTitle: '教學 AI 助手',
        aiaDesc: '出題、教案大綱、批改評語、課堂活動 —— 適用於任何任教科目。',
      },
      trust: {
        local: '資料存你部機，登入先雲端同步',
        offline: '可安裝、離線可用（PWA）',
        a11y: '無障礙設計 · 手機 / 平板適配',
      },
      ctaTitle: '今個學期，由更有條理開始',
      ctaSub: '免費試用全部教學功能，需要時先升級。',
      footer: { privacy: '私隱政策', terms: '服務條款', pricing: '定價', copy: '為香港教育工作者而設' },
    },
  },
  en: {
    translation: {
      signingIn: 'Signing in…',
      nav: { pricing: 'Pricing', start: 'Get started', enterApp: 'Open workspace' },
      hero: {
        badge: 'Built for Hong Kong teachers',
        h1pre: "A teacher's whole workday, ",
        h1accent: 'handled in one place',
        sub: 'Lesson prep, AI question generation, grades & weakness analysis, attendance, parent comms, admin documents — your teaching work, scattered across Excel, WhatsApp and paper, brought into one professional workspace.',
        ctaStart: 'Start free',
        ctaEnter: 'Open workspace',
        ctaPricing: 'See pricing',
        noCard: 'No credit card · Works instantly · Any teaching subject',
      },
      featuresTitle: "Covers a teacher's week",
      f: {
        prepTitle: 'Lesson prep & curriculum',
        prepDesc: 'Write lesson plans and track each class against the syllabus — your term plan at a glance.',
        aiTitle: 'AI questions & papers',
        aiDesc: 'Type a topic to generate MC / short / long questions, save to the bank, auto-assemble papers and worksheets.',
        gradeTitle: 'Grades & weakness analysis',
        gradeDesc: 'Auto-compute averages and ranks, surface class weaknesses — turn assessment data into teaching decisions.',
        attTitle: 'Timetable & attendance',
        attDesc: 'Weekly timetable and per-lesson attendance rates; cover lessons and swaps at a glance.',
        commTitle: 'Parent comms & admin',
        commDesc: 'Contact logs with templates, meeting notes, fill-in Word admin documents ready to print.',
        aiaTitle: 'Teaching AI assistant',
        aiaDesc: 'Questions, lesson outlines, marking comments, class activities — for any subject you teach.',
      },
      trust: {
        local: 'Data on your device, synced once you sign in',
        offline: 'Installable, works offline (PWA)',
        a11y: 'Accessible · phone / tablet ready',
      },
      ctaTitle: 'Start this term more organised',
      ctaSub: 'Try every teaching feature free; upgrade when you need to.',
      footer: { privacy: 'Privacy', terms: 'Terms', pricing: 'Pricing', copy: 'Made for Hong Kong educators' },
    },
  },
}

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLang(),
  fallbackLng: 'zh-HK',
  interpolation: { escapeValue: false },
})

/** 切換語言並記住（Settings 用）。 */
export function setLanguage(lng: LangId): void {
  try {
    localStorage.setItem(STORAGE_KEY, lng)
  } catch {
    /* ignore */
  }
  void i18n.changeLanguage(lng)
}

export default i18n
