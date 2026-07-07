import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { appEn } from './appEn'
import { BRAND_NAME, BRAND_TAGLINE_ZH } from '../lib/brand'

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
      shell: {
        brandName: BRAND_NAME,
        brandSub: BRAND_TAGLINE_ZH,
      },
      nav: { pricing: '定價', start: '免費開始', enterApp: '進入工作台' },
      landingNav: { workflow: '工作流', features: '功能', faq: '常見問題' },
      hero: {
        badge: '個人老師先用 · 香港課堂場景',
        painLabel: '老師痛點',
        h1Title: '香港老師的 AI 工作台：夜晚十一點，仲做緊聽日份簡報？',
        h1Line1: '夜晚十一點，',
        h1Line2: '仲做緊聽日',
        h1Joiner: '',
        h1Line3: '份簡報？',
        h1pre: '一位老師都開得起，',
        h1accent: '備課到回饋一條龍',
        sub: '由課題到教學簡報，一鍵生成，下載即用。備課、AI 出題、成績與跟進都收回同一個工作台。',
        ctaStart: '免費開始使用',
        ctaEnter: '進入工作台',
        ctaPricing: '查看定價',
        noCard: '可先免費開始 · 支援個人 Pro 訂閱 · 適用任何任教科目',
        stats: {
          time: { value: '3 步', label: '課前、課中、課後跟進一次過收好' },
          tools: { value: '30+', label: '常用教學工具集中在同一個工作台' },
          solo: { value: '1 人', label: '個人老師不用等學校採購都可先用' },
        },
        checkLead: '由備課到課後整理，逐步幫你收好：',
        ck1: '備課',
        ck2: '教案',
        ck3: '教學簡報',
        ck4: '改簿存檔',
        ck5: '會議記錄',
        ck6: '掃描存檔',
      },
      featuresTitle: '由一位老師的日常開始',
      featuresHeadline: '不是再多一個 AI 聊天框，而是老師每日真的會用的工作台',
      workflow: {
        eyebrow: '由一堂課開始',
        title: '把零散工作收成一條清晰流程',
        sub: 'EziTeach AI 不是叫老師重新學一套系統，而是把原本散在 WhatsApp、試算表、文件夾和腦內的工作，收回一條由課前到課後的路線。',
        before: {
          title: '課前：備好一堂課',
          desc: '把課題、教材和舊筆記變成教案、題目、簡報草稿與活動流程，先有可用版本再微調。',
        },
        during: {
          title: '課中：按鐘聲推進',
          desc: '點名、抽人、分組、計時和課堂任務放在同一頁，減少上堂時切換工具。',
        },
        after: {
          title: '課後：回饋與跟進',
          desc: '整理批改、弱項、評語和家長跟進，下一堂課要補什麼一眼就見到。',
        },
      },
      useCases: {
        eyebrow: '最先值得打中的場景',
        title: '先解決老師最願意付費的工作',
        sub: '商業化唔係堆滿功能，而是讓老師一開頁就知道：今晚最花時間、最煩、最容易出錯的工作，可以先被處理好。',
        nextLesson: {
          title: '下一堂課任務包',
          desc: '把課題、教材、時間表和待辦整理成一堂課包，老師由「有得改」開始，而不是由空白文件開始。',
        },
        materials: {
          title: '教材與簡報',
          desc: '由題目、工作紙到 PowerPoint，一次生成初稿；保留老師改動空間，適合趕課、補課和公開試操練。',
        },
        marking: {
          title: '批改與弱項',
          desc: '把評分準則、回饋句、成績和弱項分析放在同一條線，方便之後補底和家長跟進。',
        },
        admin: {
          title: '行政與溝通',
          desc: '會議筆記、文件速讀、家長訊息和掃描歸檔收回一處，減少老師放學後在多個工具之間來回。',
        },
      },
      f: {
        prepTitle: '備課與教案',
        prepDesc: '教案、課程進度、時間表、題庫一站管理；AI「點教」指引列出教學重點、學生常見誤解、課堂活動與評估。',
        aiTitle: '出題與教材生成',
        aiDesc: '輸入課題即生 MC／短答／個案／長題與工作紙；連評分準則與量表、官方課程指引課題匯入、DSE 風格操練。',
        aiaTitle: '教學簡報（PowerPoint）',
        aiaDesc: '揀課題或貼內容，一鍵生成 .pptx：34 套設計模板、版式自動配、封面與內頁自動配圖。',
        gradeTitle: '批改 · 成績 · 評語',
        gradeDesc: 'AI 批改答案與作文（連評分準則、病句標示、中英總評）；成績冊自動計平均、標弱項；全班成績表評語一次過生成。',
        attTitle: '班務 · 點名 · 課堂',
        attDesc: '班別與學生管理、逐堂點名統計出席；課堂工具隨機抽人、即時分組、計時、計分，上堂即用。',
        commTitle: '家長 · 行政 · 文件',
        commDesc: '家長溝通記錄連跟進；Word 行政文件套版即印、文件速讀抽重點、會議／觀課錄音轉文字、掃描 PDF。',
        moreTitle: '仲有更多',
        more: '教學 AI 助手、教學資源庫、資源分享區、老師社群、行事曆、重要日子倒數、快速擷取、日後科組協作',
      },
      proof: {
        eyebrow: '散戶先行',
        quote: '先令一位老師覺得「今晚真係幫到我」，學校級 adoption 先有機會自然發生。',
        quoteBy: '產品定位由個人老師切入：低門檻、快見效、私隱清楚、可搬走資料。當老師開始在科組分享成果，EziTeach AI 才順勢變成團隊工具。',
        solo: {
          title: '一位老師也能開始',
          desc: '不用等學校採購、不用 IT 開帳戶；先用免費版整理自己的課堂工作流。',
        },
        privacy: {
          title: '先保護學生私隱',
          desc: '頁面和文案明確提醒遮蔽學生資料，AI 產出保留教師覆核。',
        },
        portable: {
          title: '本機優先，再雲端同步',
          desc: '個人老師最重視可控感：本機資料、登入同步、需要時可匯出。',
        },
      },
      trust: {
        solo: '個人老師可即開即用',
        privacy: '私隱先行，學生資料要謹慎處理',
        review: 'AI 只作初稿，教師保留最後判斷',
        portable: '本機優先，登入後再雲端同步',
        local: '資料存你部機，登入先雲端同步',
        offline: '可安裝、離線可用（PWA）',
        a11y: '無障礙設計 · 手機 / 平板適配',
      },
      faq: {
        eyebrow: '常見問題',
        title: '先解答購買前會問的事',
        sub: '教育產品最怕「看起來好用，但不敢真的放進日常」。這裡把私隱、收費、資料和 AI 責任先講清楚。',
        school: {
          q: '一定要學校採購先用到嗎？',
          a: '不用。產品定位是個人老師先行，你可以用免費版整理自己的備課和課後工作；到科組或學校有需要時，再升級或討論團隊方案。',
        },
        studentData: {
          q: '可以輸入學生資料嗎？',
          a: '建議先用代號或遮蔽可識別資料。平台文案和流程會提醒老師保護學生私隱，處理個人資料時仍要按學校政策和香港法例要求。',
        },
        subjects: {
          q: '只適合 BAFS 嗎？',
          a: '不是。BAFS 是起始示範科目，設定內可選不同任教科目；出題、教案、簡報和行政流程本身是跨科目工作流。',
        },
        pricing: {
          q: '免費版和付費版最大分別是什麼？',
          a: '免費版讓你試完整個工作流；Plus / Pro 主要增加每月 AI 點數、同步和高階模型等能力，適合每星期穩定使用或密集備課。',
        },
        export: {
          q: '資料可以帶走嗎？',
          a: '可以。產品保留匯出和清除資料入口；個人老師先建立可控感，之後再決定是否登入同步。',
        },
        aiReview: {
          q: 'AI 生成內容可以直接用嗎？',
          a: 'AI 只應作初稿。題目、教案、評語和家長訊息都應由老師覆核，尤其涉及學生、評估或正式文件時。',
        },
      },
      ctaTitle: '今個學期，由更有條理開始',
      ctaSub: '免費試用全部教學功能，需要時先升級。',
      footer: {
        privacy: '私隱政策',
        terms: '服務條款',
        guidelines: '社群守則',
        pricing: '定價',
        copy: '為香港教育工作者而設',
        dataNotice:
          '私隱政策及個人資料處理以香港《個人資料（私隱）條例》（第 486 章）的要求作設計方向；提交內容前，請先避免輸入可識別學生資料。',
      },

      common: { backHome: '返回首頁' },
      legal: {
        updatedLabel: '最後更新：',
        disclaimer:
          '本頁內容僅供一般參考，唔構成法律意見；如中英文版本有歧義，以中文版為準。',
      },

      pricing: {
        metaTitle: `定價 · ${BRAND_NAME}`,
        metaDesc: `${BRAND_NAME} 方案與定價：免費版可試 AI 備課，Plus / Pro 提供更多 AI 點數同多裝置同步。`,
        title: '一位老師都用得起',
        subtitle: '先免費試完整個備課流程；需要更多 AI 點數、同步或高階模型時先升級。',
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
        comingSoon: '收費功能正準備開放，敬請期待。',
        noAuth: '暫時未能登入升級，請稍後再試或聯絡支援。',
        checkoutFailed: '開啟付款頁失敗。',
        portalFailed: '開啟客戶中心失敗。',
        notConfiguredPre: '收費功能正準備開放；如需優先試用，請聯絡支援。',
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
        updated: '2026 年 6 月 23 日',
        intro:
          `${BRAND_NAME}（「本平台」）尊重並保障你的個人資料私隱。本政策說明我哋會收集咩資料、點樣使用同保護，以及你擁有嘅權利。本平台主要為香港教育工作者而設，會按香港《個人資料（私隱）條例》（第 486 章）行事。`,
        s1Title: '我哋收集嘅資料',
        s1AccountLabel: '帳戶資料',
        s1Account: '：你用 Google 登入時提供嘅名稱同電郵地址。',
        s1InputLabel: '你輸入嘅內容',
        s1Input:
          '：筆記、教案、題目等教學內容。預設只存喺你裝置嘅瀏覽器（localStorage）；登入後會同步到我哋嘅雲端供應商 Supabase。現階段本平台唔收集學生個人資料（成績、名單等學生功能未開放）。',
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
          '雲端資料以行級安全（RLS）隔離，確保每位用戶只可存取自己嘅資料。部分服務商位於香港境外，你嘅資料可能會傳輸並儲存喺境外，我哋會採取合理措施確保有適當保障。我哋採取合理技術措施保護資料，但互聯網傳輸無法保證絕對安全。',
        s5Title: '你的權利',
        s5Body:
          '你可隨時在「設定」匯出或清除本機資料，亦可要求查閱、更正或刪除我哋持有的個人資料。你可在 Cookie 橫額或瀏覽器設定撤回分析同意。',
        s6Title: 'Cookie 與分析',
        s6Body: '我哋只在你「接受」後才載入分析 cookie。拒絕不會影響核心功能。錯誤監控屬維持服務之正當利益。',
        s7Title: '兒童',
        s7Body:
          '平台供教師專業使用。現階段平台唔提供亦唔收集任何學生個人資料；我哋亦不會向兒童收集個人資料。',
        s8Title: '聯絡我哋',
        s8Pre: '如對私隱有任何查詢，請電郵至',
        s8Post: '。',
      },

      terms: {
        title: '服務條款',
        updated: '2026 年 6 月 13 日',
        intro:
          `歡迎使用 ${BRAND_NAME}（「本平台」）。當你使用本平台，即表示你同意以下條款。如不同意，請停止使用。`,
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
        s6Title: '你的資料、內容與分享',
        s6Body:
          '你保留對自己輸入內容嘅權利。你授權我哋為提供服務所需而處理及儲存有關內容（包括雲端同步及 AI 處理）。當你喺資源分享區或老師社群分享內容，即表示你確認你擁有或有權分享該內容，並授予其他用戶為教學／非商業用途下載及使用該內容嘅非專屬、可撤回授權；你可隨時移除你分享嘅內容。社群行為守則詳見《社群守則》，資料處理詳見私隱政策。',
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

      guidelines: {
        title: '社群守則',
        updated: '2026 年 6 月 13 日',
        intro:
          `${BRAND_NAME} 嘅資源分享區同老師社群論壇，係畀全港老師交流教學資源同經驗嘅地方。為咗保持一個專業、互信、友善嘅環境，請遵守以下守則。本守則構成《服務條款》嘅一部分；違反者我哋可移除內容、發出警告或暫停帳戶。`,
        s1Title: '尊重同專業',
        s1Body:
          '以禮待人、就事論事。嚴禁人身攻擊、騷擾、歧視、仇恨言論或任何形式嘅欺凌。歡迎理性討論同表達不同意見，但唔好針對個人。',
        s2Title: '分享資源嘅版權',
        s2Body:
          '只可分享你自己創作、或你有權分享嘅內容。請尊重版權 —— 唔好上載出版社教科書、未經授權嘅試題或答案、考評局（HKEAA）版權材料等。上載時如實標示授權（「原創」或「可分享」），並確保你有權授予其他老師下載及課堂使用。',
        s3Title: '保護學生私隱',
        s3Body:
          '唔好上載含可識別學生個人資料嘅內容（姓名、相片、成績、學生作品等），除非已遮蔽處理或取得適當同意。處理學生資料須符合所屬學校政策及香港《個人資料（私隱）條例》。',
        s4Title: '內容要切題、有質素',
        s4Body:
          '請分享同教學相關嘅資源同討論。唔好洗版、賣廣告、招攬生意、重覆張貼，或發布與教學無關嘅內容。',
        s5Title: '禁止內容',
        s5Body:
          '嚴禁違法、侵權、淫穢、暴力、虛假誤導、含惡意程式或連結嘅內容，以及任何洩露未公開試題或違反保密協議嘅材料。',
        s6Title: '檢舉與處理',
        s6Body:
          '見到違規內容，可用每項資源或帖子嘅「檢舉」功能通知我哋。我哋會檢視並按情況移除內容、發出警告，或暫停／終止帳戶。即使以匿名分享，管理員仍可追溯帳戶以防濫用。',
        s7Title: '匿名分享',
        s7Body:
          '你可揀匿名分享，公開只顯示「匿名老師」。匿名唔等於免責 —— 你仍須對所分享內容負責，本守則一樣適用。',
        s8Title: '內容免責',
        s8Body:
          `${BRAND_NAME} 唔保證社群資源嘅準確性、完整性或適用性。用於課堂或評估前，請自行專業判斷及覆核。`,
        s9Title: '守則修改',
        s9Body:
          '我哋可不時更新本守則，並喺本頁公布更新日期。重大變更會盡量另行通知。如有查詢，請見《服務條款》嘅聯絡方式。',
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
      landingNav: { workflow: 'Workflow', features: 'Features', faq: 'FAQ' },
      hero: {
        badge: 'Individual teachers first · Hong Kong classroom context',
        painLabel: 'Teacher pain point',
        h1Title: 'The AI workspace for Hong Kong teachers: still making tomorrow’s slides at 11pm?',
        h1Line1: 'Still making',
        h1Line2: 'tomorrow’s',
        h1Joiner: ' ',
        h1Line3: 'slides at 11pm?',
        h1pre: 'One teacher can start, ',
        h1accent: 'from prep to feedback',
        sub: 'Go from topic to teaching slides in one flow. Generate, refine and download lesson packs inside the AI workspace for Hong Kong teachers.',
        ctaStart: 'Start free',
        ctaEnter: 'Open workspace',
        ctaPricing: 'See pricing',
        noCard: 'No credit card · No school account required · Any teaching subject',
        stats: {
          time: { value: '3 steps', label: 'Prep, lesson time and follow-up in one flow' },
          tools: { value: '30+', label: 'Teaching tools gathered in one workspace' },
          solo: { value: '1 teacher', label: 'Start before your school needs to buy anything' },
        },
        checkLead: 'From prep to post-lesson follow-up:',
        ck1: 'Lesson prep',
        ck2: 'Lesson plans',
        ck3: 'Slides',
        ck4: 'Marking',
        ck5: 'Meeting notes',
        ck6: 'Scan & file',
      },
      featuresTitle: "Starts with one teacher's week",
      featuresHeadline: 'Not another AI chat box, but a workspace teachers can use every day',
      workflow: {
        eyebrow: 'Start with one lesson',
        title: 'Turn scattered tasks into one clear flow',
        sub: 'EziTeach AI does not ask teachers to learn a new operating system. It gathers the work spread across chats, spreadsheets, folders and memory into a route from prep to follow-up.',
        before: {
          title: 'Before class: prepare the lesson',
          desc: 'Turn topics, materials and old notes into a lesson plan, questions, slide drafts and activity flow, then refine from a usable first version.',
        },
        during: {
          title: 'During class: keep the lesson moving',
          desc: 'Attendance, random picker, grouping, timer and class tasks sit on the same page, so there is less switching during class.',
        },
        after: {
          title: 'After class: feedback and follow-up',
          desc: 'Organise marking, weak spots, comments and parent follow-ups, so the next lesson plan is obvious.',
        },
      },
      useCases: {
        eyebrow: 'Where it pays off first',
        title: 'Start with the work teachers are willing to pay to reduce',
        sub: 'Commercial readiness is not about adding more features. It is about making the visitor see that tonight’s slow, risky and repetitive work can be handled first.',
        nextLesson: {
          title: 'Next-lesson task pack',
          desc: 'Turn topics, materials, timetable context and to-dos into one lesson pack, so teachers start from something editable rather than a blank document.',
        },
        materials: {
          title: 'Materials and slides',
          desc: 'Generate drafts for questions, worksheets and PowerPoint slides in one flow, while leaving space for teacher editing.',
        },
        marking: {
          title: 'Marking and weak spots',
          desc: 'Keep rubrics, feedback lines, grades and weakness analysis in one thread, ready for follow-up and parent communication.',
        },
        admin: {
          title: 'Admin and communication',
          desc: 'Meeting notes, document summaries, parent messages and scans sit in one place instead of across multiple tools after school.',
        },
      },
      f: {
        prepTitle: 'Planning & lessons',
        prepDesc: 'Lesson plans, curriculum progress, timetable and question bank in one place; an AI "how to teach" guide lists key points, common misconceptions, activities and assessment.',
        aiTitle: 'Questions & materials',
        aiDesc: 'Type a topic to generate MC / short / case / long questions and worksheets; with rubrics and grids, official-syllabus topic import and DSE-style drills.',
        aiaTitle: 'Teaching slides (PowerPoint)',
        aiaDesc: 'Pick a topic or paste content and generate a .pptx in one click: 34 design templates, auto layouts, auto cover and in-page images.',
        gradeTitle: 'Marking · grades · comments',
        gradeDesc: 'AI marks answers and essays (rubrics, error highlighting, EN/ZH summary); the gradebook auto-averages and flags weak spots; whole-class report comments in one pass.',
        attTitle: 'Classes · attendance · tools',
        attDesc: 'Manage classes and students, take per-lesson attendance; classroom tools: random picker, instant grouping, timer and scoreboard.',
        commTitle: 'Parents · admin · docs',
        commDesc: 'Parent contact logs with follow-ups; fill Word admin templates to print, doc digest, meeting/lesson audio to text, and PDF scanning.',
        moreTitle: 'And more',
        more: 'Teaching AI assistant, Resource library, Resource sharing, Teacher community, Calendar, Countdowns, Quick capture, panel collaboration later, Budget',
      },
      proof: {
        eyebrow: 'Individual teachers first',
        quote: 'Win the moment when one teacher feels, “this actually helps me tonight,” and school adoption has a reason to grow.',
        quoteBy: 'The product enters through the individual teacher: low friction, quick value, clear privacy and portable data. Once teachers share outcomes with their panels, EziTeach AI can naturally become a team tool.',
        solo: {
          title: 'One teacher can start',
          desc: 'No procurement cycle or IT account setup required; use the free plan to organise your own classroom workflow first.',
        },
        privacy: {
          title: 'Student privacy first',
          desc: 'The product reminds teachers to mask student data, and AI output stays under teacher review.',
        },
        portable: {
          title: 'Local-first, then cloud sync',
          desc: 'Individual teachers need control: local data, sign-in sync and export when needed.',
        },
      },
      trust: {
        solo: 'Individual teachers can start instantly',
        privacy: 'Privacy-first handling of student data',
        review: 'AI drafts; teachers keep final judgment',
        portable: 'Local-first, cloud sync after sign-in',
        local: 'Data on your device, synced once you sign in',
        offline: 'Installable, works offline (PWA)',
        a11y: 'Accessible · phone / tablet ready',
      },
      faq: {
        eyebrow: 'FAQ',
        title: 'Answer the questions buyers ask first',
        sub: 'Education products must feel safe enough for daily use. Privacy, pricing, data ownership and AI responsibility are made explicit before signup.',
        school: {
          q: 'Do I need school procurement first?',
          a: 'No. EziTeach AI is designed for individual teachers to start first. Use the free plan for your own workflow, then discuss panel or school options when there is demand.',
        },
        studentData: {
          q: 'Can I enter student data?',
          a: 'Use codes or remove identifiable details first. The product reminds teachers to protect student privacy; handling personal data must still follow school policy and Hong Kong law.',
        },
        subjects: {
          q: 'Is this only for BAFS?',
          a: 'No. BAFS is the starting subject pack, but the lesson planning, question generation, slides and admin workflows are designed to work across subjects.',
        },
        pricing: {
          q: 'What is the main difference between free and paid plans?',
          a: 'The free plan lets you try the full workflow. Plus and Pro mainly add monthly AI credits, sync and advanced model capacity for regular or heavy use.',
        },
        export: {
          q: 'Can I take my data with me?',
          a: 'Yes. Export and clear-data paths are built into the product, so individual teachers stay in control before deciding whether to sync.',
        },
        aiReview: {
          q: 'Can AI output be used directly?',
          a: 'AI output should be treated as a draft. Teachers should review questions, lesson plans, comments and parent messages before using them.',
        },
      },
      ctaTitle: 'Start this term more organised',
      ctaSub: 'Try every teaching feature free; upgrade when you need to.',
      footer: {
        privacy: 'Privacy',
        terms: 'Terms',
        guidelines: 'Community Guidelines',
        pricing: 'Pricing',
        copy: 'Made for Hong Kong educators',
        dataNotice:
          'The Privacy Policy and personal data handling are designed with Hong Kong Personal Data (Privacy) Ordinance (Cap. 486) requirements in mind; avoid entering identifiable student data before submission.',
      },

      common: { backHome: 'Back to home' },
      legal: {
        updatedLabel: 'Last updated: ',
        disclaimer:
          'This page is provided for general reference only and does not constitute legal advice; in case of any discrepancy between the Chinese and English versions, the Chinese version prevails.',
      },

      pricing: {
        metaTitle: `Pricing · ${BRAND_NAME}`,
        metaDesc:
          'EziTeach plans and pricing: start free with AI lesson prep, then upgrade for more AI credits and multi-device sync.',
        title: 'Affordable for individual teachers',
        subtitle: 'Try the full lesson-prep workflow free; upgrade only when you need more AI credits, sync, or advanced models.',
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
        comingSoon: 'Paid features are being prepared. Thanks for your patience.',
        noAuth: 'Sign-in and upgrade are temporarily unavailable. Try again later or contact support.',
        checkoutFailed: 'Failed to open the checkout page.',
        portalFailed: 'Failed to open the customer portal.',
        notConfiguredPre: 'Paid features are being prepared. Contact support if you need early access.',
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
        updated: '23 June 2026',
        intro:
          'EziTeach ("the Platform") respects and protects the privacy of your personal data. This policy explains what data we collect, how we use and protect it, and the rights you have. The Platform is primarily designed for Hong Kong educators and operates in accordance with the Hong Kong Personal Data (Privacy) Ordinance (Cap. 486).',
        s1Title: 'Data we collect',
        s1AccountLabel: 'Account data',
        s1Account: ': the name and email address you provide when signing in with Google.',
        s1InputLabel: 'Content you enter',
        s1Input:
          ': notes, lesson plans, questions and other teaching content. By default this is stored only in your device’s browser (localStorage); once you sign in it syncs to our cloud provider, Supabase. At this stage the Platform does not collect student personal data (grades, rosters and other student features are not yet available).',
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
          'Cloud data is isolated with row-level security (RLS), ensuring each user can only access their own data. Some service providers are located outside Hong Kong, so your data may be transferred to and stored overseas; we take reasonable measures to ensure an appropriate level of protection. We take reasonable technical measures to protect data, but transmission over the internet cannot be guaranteed to be absolutely secure.',
        s5Title: 'Your rights',
        s5Body:
          'You can export or clear local data at any time in Settings, and may request to access, correct or delete the personal data we hold. You can withdraw analytics consent via the cookie banner or your browser settings.',
        s6Title: 'Cookies and analytics',
        s6Body:
          'We only load analytics cookies after you "Accept". Declining does not affect core features. Error monitoring is a legitimate interest in maintaining the service.',
        s7Title: 'Children',
        s7Body:
          'The Platform is for professional use by teachers. At this stage the Platform does not provide for, nor collect, any student personal data; nor do we collect personal data from children.',
        s8Title: 'Contact us',
        s8Pre: 'For any privacy enquiries, please email',
        s8Post: '.',
      },

      terms: {
        title: 'Terms of Service',
        updated: '13 June 2026',
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
        s6Title: 'Your data, content and sharing',
        s6Body:
          'You retain the rights to the content you enter. You authorise us to process and store such content as needed to provide the service (including cloud sync and AI processing). When you share content in the resource-sharing space or teachers’ community, you confirm that you own or have the right to share it, and you grant other users a non-exclusive, revocable licence to download and use it for teaching / non-commercial purposes; you may remove your shared content at any time. Community conduct is set out in the Community Guidelines, and data handling in the Privacy Policy.',
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

      guidelines: {
        title: 'Community Guidelines',
        updated: '13 June 2026',
        intro:
          'The EziTeach resource-sharing space and teachers’ forum are places for Hong Kong teachers to exchange teaching materials and experience. To keep the environment professional, trusting and friendly, please follow these guidelines. They form part of the Terms of Service; we may remove content, issue warnings or suspend accounts for violations.',
        s1Title: 'Respect and professionalism',
        s1Body:
          'Be courteous and address the issue, not the person. Harassment, personal attacks, discrimination, hate speech and bullying of any kind are prohibited. Reasoned disagreement is welcome; targeting individuals is not.',
        s2Title: 'Copyright of shared resources',
        s2Body:
          'Only share content you created or have the right to share. Respect copyright — do not upload publishers’ textbooks, unauthorised exam papers or answers, or HKEAA copyright materials. Label the licence honestly ("Original" or "Shareable") and ensure you may grant other teachers the right to download and use it in class.',
        s3Title: 'Protect student privacy',
        s3Body:
          'Do not upload content with identifiable student personal data (names, photos, results, student work) unless redacted or properly consented. Handling of student data must comply with your school’s policies and the Personal Data (Privacy) Ordinance.',
        s4Title: 'Keep content relevant and useful',
        s4Body:
          'Share teaching-related resources and discussion. No spam, advertising, solicitation, repeated posting or off-topic content.',
        s5Title: 'Prohibited content',
        s5Body:
          'Strictly no illegal, infringing, obscene, violent, false or misleading content, no malware or malicious links, and no material that leaks unreleased exam questions or breaches confidentiality.',
        s6Title: 'Reporting and enforcement',
        s6Body:
          'Use the "Report" action on any resource or post to flag violations. We will review and may remove content, issue warnings, or suspend or terminate accounts. Even for anonymous posts, administrators can trace the account to prevent abuse.',
        s7Title: 'Anonymous sharing',
        s7Body:
          'You may share anonymously, shown publicly as "Anonymous teacher". Anonymity does not remove responsibility — you remain accountable for what you share, and these guidelines still apply.',
        s8Title: 'Content disclaimer',
        s8Body:
          'Community resources are contributed voluntarily by teachers; EziTeach does not guarantee their accuracy, completeness or fitness. Use your professional judgement and review before classroom or assessment use.',
        s9Title: 'Changes to these guidelines',
        s9Body:
          'We may update these guidelines from time to time and post the updated date on this page. We will try to give notice of material changes. For enquiries, see the contact details in the Terms of Service.',
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
