import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { appEn } from './appEn'

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
        prepTitle: '備課與教學指引',
        prepDesc: '撰寫教案、追蹤課程進度，再加 AI「點教」指引：教學重點、學生常見誤解、課堂活動與評估。',
        aiTitle: 'AI 出題、試卷與簡報',
        aiDesc: '輸入課題即生成 MC／短答／長題與工作紙；更可一鍵生成 PowerPoint 教學簡報 —— 34 套設計模板，版式與配圖自動排好。',
        gradeTitle: '批改 · 成績 · 評語',
        gradeDesc: 'AI 批改答案與作文（連評分準則、病句標示）；自動計平均標弱項，一鍵出全班成績表評語。',
        attTitle: '點名與課堂工具',
        attDesc: '逐堂點名統計出席；課堂工具隨機抽人、即時分組、計時、計分，上堂即用。',
        commTitle: '家長溝通與行政',
        commDesc: '聯絡記錄連範本、會議筆記、Word 行政文件即印；AI 文件速讀自動歸類、抽重點、列跟進。',
        aiaTitle: '教學 AI 助手',
        aiaDesc: '出題、教案、批改、活動，匯出 Word／PDF／PowerPoint —— 適用於任何任教科目。',
      },
      trust: {
        local: '資料存你部機，登入先雲端同步',
        offline: '可安裝、離線可用（PWA）',
        a11y: '無障礙設計 · 手機 / 平板適配',
      },
      ctaTitle: '今個學期，由更有條理開始',
      ctaSub: '免費試用全部教學功能，需要時先升級。',
      footer: { privacy: '私隱政策', terms: '服務條款', pricing: '定價', copy: '為香港教育工作者而設' },

      common: { backHome: '返回首頁' },

      pricing: {
        metaTitle: '定價 · 教學易 EziTeach',
        metaDesc: '教學易（EziTeach）方案與定價：免費版永久免費，Pro 解鎖無限 AI 同多裝置同步。',
        title: '簡單透明嘅定價',
        subtitle: '老師免費用齊教學功能，需要時先升級。',
        monthly: '月繳',
        annual: '年繳',
        annualSave: '慳 2 個月',
        mostPopular: '最受歡迎',
        opening: '開啟中…',
        manage: '管理訂閱',
        current: '目前方案',
        processing: '處理中…',
        upgradePro: '升級 Pro',
        startFree: '免費開始',
        comingSoon: '收費功能即將推出，敬請期待 🙏',
        noAuth: '未接 Supabase，暫時無法登入升級。',
        checkoutFailed: '開啟付款頁失敗。',
        portalFailed: '開啟客戶中心失敗。',
        notConfiguredPre: 'ⓘ 收費功能尚未啟用（未設定 Stripe）。設定步驟見',
      },

      cookie: {
        region: 'Cookie 同意',
        text: '我哋用分析 cookie 改善產品體驗。你可以選擇接受或拒絕；詳情見',
        privacy: '私隱政策',
        textEnd: '。',
        reject: '拒絕',
        accept: '接受',
      },

      privacy: {
        title: '私隱政策',
        updated: '2026 年 6 月 7 日',
        intro:
          '教學易 EziTeach（「本平台」）尊重並保障你的個人資料私隱。本政策說明我哋會收集咩資料、點樣使用同保護，以及你擁有嘅權利。本平台主要為香港教育工作者而設，會按香港《個人資料（私隱）條例》（第 486 章）行事。',
        s1Title: '我哋收集嘅資料',
        s1AccountLabel: '帳戶資料',
        s1Account: '：你用 Google 登入時提供嘅名稱同電郵地址。',
        s1InputLabel: '你輸入嘅內容',
        s1Input:
          '：筆記、班別、成績、教案、題目等。預設只存喺你裝置嘅瀏覽器（localStorage）；登入後會同步到我哋嘅雲端供應商 Supabase。',
        s1AiLabel: 'AI 請求',
        s1Ai: '：你使用教學 AI 時輸入嘅文字／圖片，會經我哋的伺服器代理送往 Google Gemini 處理，用以生成回應。',
        s1PayLabel: '付款資料',
        s1PayPre: '：訂閱由 Stripe 處理；我哋',
        s1PayStrong: '不會',
        s1PayPost: '儲存你的信用卡號碼。',
        s1AnalyticsLabel: '分析與診斷',
        s1AnalyticsPre: '：在你',
        s1AnalyticsStrong: '同意',
        s1AnalyticsPost: '後，我哋會用 PostHog 收集匿名使用統計；並用 Sentry 收集錯誤報告以改善穩定性。',
        s2Title: '使用目的',
        s2Pre: '提供及維運平台功能、雲端同步、處理訂閱、改善產品體驗、保障系統安全及履行法律責任。我哋',
        s2Strong: '不會',
        s2Post: '出售你的個人資料。',
        s3Title: '第三方服務',
        s3Body:
          '本平台依賴以下服務商，各自有其私隱政策：Supabase（雲端儲存／驗證）、Google Gemini（AI）、Stripe（付款）、PostHog（分析）、Sentry（錯誤監控）、Vercel（寄存）。',
        s4Title: '資料儲存與保安',
        s4Body:
          '雲端資料以行級安全（RLS）隔離，確保每位用戶只可存取自己嘅資料。我哋採取合理技術措施保護資料，但互聯網傳輸無法保證絕對安全。',
        s5Title: '你的權利',
        s5Body:
          '你可隨時在「設定」匯出或清除本機資料，亦可要求查閱、更正或刪除我哋持有的個人資料。你可在 Cookie 橫額或瀏覽器設定撤回分析同意。',
        s6Title: 'Cookie 與分析',
        s6Body: '我哋只在你「接受」後才載入分析 cookie。拒絕不會影響核心功能。錯誤監控屬維持服務之正當利益。',
        s7Title: '兒童',
        s7Body:
          '平台供教師專業使用。我哋不會主動向兒童收集個人資料；老師輸入嘅學生資料由老師按校方政策負責管理。',
        s8Title: '聯絡我哋',
        s8Pre: '如對私隱有任何查詢，請電郵至',
        s8Post: '。',
      },

      terms: {
        title: '服務條款',
        updated: '2026 年 6 月 7 日',
        intro:
          '歡迎使用 教學易 EziTeach（「本平台」）。當你使用本平台，即表示你同意以下條款。如不同意，請停止使用。',
        s1Title: '服務說明',
        s1Body:
          '本平台為香港教師提供備課、出題、成績管理、點名、家長溝通、行政文件及 AI 教學助手等工具。我哋可能不時更新、增刪功能。',
        s2Title: '帳戶',
        s2Body:
          '部分功能需以 Google 帳戶登入。你須對帳戶活動及所輸入內容負責，並確保處理學生資料時符合所屬學校之政策及適用法律。',
        s3Title: '可接受使用',
        s3Body:
          '你同意不會將平台用於違法用途、上載侵權或不當內容、嘗試干擾系統運作，或繞過使用額度及安全限制。',
        s4Title: '訂閱與收費',
        s4Item1: '免費版提供核心功能及 AI 使用額度（部分功能設每日 / 每月上限）。',
        s4Item2: 'Pro 為週期性訂閱，由 Stripe 收費，到期自動續訂，直至你取消。',
        s4Item3: '你可隨時在客戶中心取消，服務維持至當期結束。',
        s4Item4: '除適用法律另有規定外，已付款項一般不獲退還。',
        s5Title: 'AI 內容免責',
        s5Body:
          'AI 生成之題目、教案、評語等僅供參考，可能有錯誤或不準確之處。你須在專業判斷下自行覆核，方可用於教學或評估。',
        s6Title: '你的資料與內容',
        s6Body:
          '你保留對自己輸入內容嘅權利。你授權我哋為提供服務所需而處理及儲存有關內容（包括雲端同步及 AI 處理）。資料處理詳見私隱政策。',
        s7Title: '知識產權',
        s7Body: '平台之軟件、設計及商標屬本平台或其授權人所有，未經許可不得複製或再分發。',
        s8Title: '免責聲明與責任限制',
        s8Body:
          '本平台按「現狀」提供，不就特定用途之適用性作任何明示或默示保證。在適用法律允許之最大範圍內，我哋不就任何間接或後果性損失承擔責任。',
        s9Title: '終止',
        s9Body: '你可隨時停止使用並刪除資料。若你嚴重違反本條款，我哋可暫停或終止你的帳戶。',
        s10Title: '條款修改',
        s10Body: '我哋可不時更新本條款，並在本頁公布更新日期。重大變更會盡量另行通知。',
        s11Title: '適用法律',
        s11Body: '本條款受香港特別行政區法律管轄，並按其詮釋。',
        s12Title: '聯絡我哋',
        s12Pre: '查詢請電郵至',
        s12Post: '。',
      },

      settings: {
        appearance: '外觀',
        appearanceHint: '選擇介面主題',
        language: '語言 · Language',
        languageHint: '介面語言（行銷頁面已支援；產品功能逐步加入）。',
        profile: '個人資料',
        subjects: '任教科目',
        subjectsHint:
          '揀你嘅任教科目，載入起始課題大綱；教學 AI 亦會以此科為語境。課題之後可喺「課程進度」自行增刪改。',
        dataOverview: '我的資料一覽',
        dataOverviewHint: '睇清楚本機儲存咗幾多嘢，匯出備份前心裡有數。',
        dataManagement: '資料管理',
        dataManagementHint: '你嘅資料目前儲存喺呢部裝置嘅瀏覽器。定期匯出備份，或者喺換機時匯入。',
        appUpdate: '應用程式更新',
        appUpdateHint:
          '部署咗新版但見唔到更新？可手動檢查；或清除快取強制載入最新版（你嘅資料唔受影響）。',
      },
    },
  },
  en: {
    translation: {
      ...appEn,
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
        prepTitle: 'Lesson prep & teaching guide',
        prepDesc: 'Lesson plans and curriculum tracking, plus an AI "how to teach" guide: key points, common misconceptions, activities and assessment.',
        aiTitle: 'AI questions, papers & slides',
        aiDesc: 'Type a topic to generate MC / short / long questions and worksheets — or one-click a PowerPoint lesson deck with 34 design templates, auto-matched layouts and photos.',
        gradeTitle: 'Marking · grades · comments',
        gradeDesc: 'AI marks answers and essays (with rubrics and error highlighting); auto averages and weaknesses, plus one-click report-card comments for the whole class.',
        attTitle: 'Attendance & classroom tools',
        attDesc: 'Per-lesson attendance, plus classroom tools: random picker, instant grouping, timer and scoreboard.',
        commTitle: 'Parent comms & admin',
        commDesc: 'Contact logs with templates, meeting notes, fill-in Word documents to print; AI doc digest auto-categorises and extracts key points.',
        aiaTitle: 'Teaching AI assistant',
        aiaDesc: 'Questions, plans, marking, activities — export to Word / PDF / PowerPoint — for any subject you teach.',
      },
      trust: {
        local: 'Data on your device, synced once you sign in',
        offline: 'Installable, works offline (PWA)',
        a11y: 'Accessible · phone / tablet ready',
      },
      ctaTitle: 'Start this term more organised',
      ctaSub: 'Try every teaching feature free; upgrade when you need to.',
      footer: { privacy: 'Privacy', terms: 'Terms', pricing: 'Pricing', copy: 'Made for Hong Kong educators' },

      common: { backHome: 'Back to home' },

      pricing: {
        metaTitle: 'Pricing · EziTeach',
        metaDesc:
          'EziTeach plans and pricing: the free plan is free forever, Pro unlocks unlimited AI and multi-device sync.',
        title: 'Simple, transparent pricing',
        subtitle: 'Teachers get every teaching feature free; upgrade only when you need to.',
        monthly: 'Monthly',
        annual: 'Annual',
        annualSave: 'Save 2 months',
        mostPopular: 'Most popular',
        opening: 'Opening…',
        manage: 'Manage subscription',
        current: 'Current plan',
        processing: 'Processing…',
        upgradePro: 'Upgrade to Pro',
        startFree: 'Start free',
        comingSoon: 'Paid features are coming soon — thanks for your patience 🙏',
        noAuth: 'Supabase is not connected, so sign-in and upgrade are unavailable for now.',
        checkoutFailed: 'Failed to open the checkout page.',
        portalFailed: 'Failed to open the customer portal.',
        notConfiguredPre: 'ⓘ Paid features are not yet enabled (Stripe is not configured). For setup steps, see',
      },

      cookie: {
        region: 'Cookie consent',
        text: 'We use analytics cookies to improve the product experience. You can accept or decline; for details see the',
        privacy: 'Privacy Policy',
        textEnd: '.',
        reject: 'Decline',
        accept: 'Accept',
      },

      privacy: {
        title: 'Privacy Policy',
        updated: '7 June 2026',
        intro:
          'EziTeach ("the Platform") respects and protects the privacy of your personal data. This policy explains what data we collect, how we use and protect it, and the rights you have. The Platform is primarily designed for Hong Kong educators and operates in accordance with the Hong Kong Personal Data (Privacy) Ordinance (Cap. 486).',
        s1Title: 'Data we collect',
        s1AccountLabel: 'Account data',
        s1Account: ': the name and email address you provide when signing in with Google.',
        s1InputLabel: 'Content you enter',
        s1Input:
          ': notes, classes, grades, lesson plans, questions and so on. By default this is stored only in your device’s browser (localStorage); once you sign in it syncs to our cloud provider, Supabase.',
        s1AiLabel: 'AI requests',
        s1Ai: ': the text and images you enter when using the teaching AI are sent through our server proxy to Google Gemini for processing to generate responses.',
        s1PayLabel: 'Payment data',
        s1PayPre: ': subscriptions are handled by Stripe; we do ',
        s1PayStrong: 'not',
        s1PayPost: ' store your credit card number.',
        s1AnalyticsLabel: 'Analytics and diagnostics',
        s1AnalyticsPre: ': with your ',
        s1AnalyticsStrong: 'consent',
        s1AnalyticsPost:
          ', we use PostHog to collect anonymous usage statistics and Sentry to collect error reports to improve stability.',
        s2Title: 'Purposes of use',
        s2Pre:
          'To provide and operate Platform features, cloud sync, process subscriptions, improve the product experience, safeguard system security and meet legal obligations. We do ',
        s2Strong: 'not',
        s2Post: ' sell your personal data.',
        s3Title: 'Third-party services',
        s3Body:
          'The Platform relies on the following service providers, each with its own privacy policy: Supabase (cloud storage / authentication), Google Gemini (AI), Stripe (payments), PostHog (analytics), Sentry (error monitoring) and Vercel (hosting).',
        s4Title: 'Data storage and security',
        s4Body:
          'Cloud data is isolated with row-level security (RLS), ensuring each user can only access their own data. We take reasonable technical measures to protect data, but transmission over the internet cannot be guaranteed to be absolutely secure.',
        s5Title: 'Your rights',
        s5Body:
          'You can export or clear local data at any time in Settings, and may request to access, correct or delete the personal data we hold. You can withdraw analytics consent via the cookie banner or your browser settings.',
        s6Title: 'Cookies and analytics',
        s6Body:
          'We only load analytics cookies after you "Accept". Declining does not affect core features. Error monitoring is a legitimate interest in maintaining the service.',
        s7Title: 'Children',
        s7Body:
          'The Platform is for professional use by teachers. We do not actively collect personal data from children; student data entered by a teacher is managed by that teacher in accordance with their school’s policies.',
        s8Title: 'Contact us',
        s8Pre: 'For any privacy enquiries, please email',
        s8Post: '.',
      },

      terms: {
        title: 'Terms of Service',
        updated: '7 June 2026',
        intro:
          'Welcome to EziTeach ("the Platform"). By using the Platform, you agree to the following terms. If you do not agree, please stop using it.',
        s1Title: 'Description of service',
        s1Body:
          'The Platform provides Hong Kong teachers with tools for lesson prep, question generation, grade management, attendance, parent communication, admin documents and an AI teaching assistant. We may update, add or remove features from time to time.',
        s2Title: 'Accounts',
        s2Body:
          'Some features require signing in with a Google account. You are responsible for your account activity and the content you enter, and must ensure that handling student data complies with your school’s policies and applicable law.',
        s3Title: 'Acceptable use',
        s3Body:
          'You agree not to use the Platform for unlawful purposes, upload infringing or improper content, attempt to interfere with the operation of the system, or bypass usage quotas and security limits.',
        s4Title: 'Subscriptions and billing',
        s4Item1: 'The free plan provides core features and a daily AI usage quota.',
        s4Item2: 'Pro is a recurring subscription, billed by Stripe, renewing automatically on expiry until you cancel.',
        s4Item3: 'You can cancel at any time in the customer portal; service continues until the end of the current period.',
        s4Item4: 'Except as required by applicable law, amounts paid are generally non-refundable.',
        s5Title: 'AI content disclaimer',
        s5Body:
          'AI-generated questions, lesson plans, comments and the like are for reference only and may contain errors or inaccuracies. You must review them yourself using professional judgement before using them for teaching or assessment.',
        s6Title: 'Your data and content',
        s6Body:
          'You retain the rights to the content you enter. You authorise us to process and store such content as needed to provide the service (including cloud sync and AI processing). For details on data handling, see the Privacy Policy.',
        s7Title: 'Intellectual property',
        s7Body:
          'The Platform’s software, design and trademarks belong to the Platform or its licensors and may not be copied or redistributed without permission.',
        s8Title: 'Disclaimer and limitation of liability',
        s8Body:
          'The Platform is provided "as is", without any express or implied warranty of fitness for a particular purpose. To the maximum extent permitted by applicable law, we are not liable for any indirect or consequential loss.',
        s9Title: 'Termination',
        s9Body:
          'You may stop using the Platform and delete your data at any time. If you seriously breach these terms, we may suspend or terminate your account.',
        s10Title: 'Changes to terms',
        s10Body:
          'We may update these terms from time to time and will publish the update date on this page. We will try to give separate notice of material changes.',
        s11Title: 'Governing law',
        s11Body: 'These terms are governed by and construed in accordance with the laws of the Hong Kong Special Administrative Region.',
        s12Title: 'Contact us',
        s12Pre: 'For enquiries, please email',
        s12Post: '.',
      },

      settings: {
        appearance: 'Appearance',
        appearanceHint: 'Choose the interface theme',
        language: 'Language · 語言',
        languageHint: 'Interface language (marketing pages supported; product features added gradually).',
        profile: 'Profile',
        subjects: 'Teaching subject',
        subjectsHint:
          'Pick your teaching subject to load a starter topic outline; the teaching AI also uses this subject as context. You can add, edit or remove topics later in "Curriculum progress".',
        dataOverview: 'My data overview',
        dataOverviewHint: 'See clearly how much is stored on this device, so you know before exporting a backup.',
        dataManagement: 'Data management',
        dataManagementHint:
          'Your data is currently stored in this device’s browser. Export backups regularly, or import when switching devices.',
        appUpdate: 'App update',
        appUpdateHint:
          'Deployed a new version but not seeing the update? Check manually, or clear the cache to force the latest version (your data is unaffected).',
      },
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
