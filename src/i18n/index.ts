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
      landingMeta: {
        description:
          'EziTeach AI 是香港老師的 AI 工作台：由一句課題或任務開始，整合備課、出題、簡報、成績分析、文件整理、行政流程與課後跟進。可先免費開始，需要更多 AI 點數或 Pro 功能再升級。',
        socialDescription:
          '香港老師的 AI 工作台：備課、出題、簡報、成績分析、文件整理與課後跟進，一個地方完成。',
      },
      hero: {
        badge: '個人老師先用 · 香港課堂場景',
        painLabel: '香港老師的 AI 工作台',
        h1Title: '一句課題，備課到跟進一站做',
        h1Line1: '一句課題，',
        h1Line2: '備課到',
        h1Joiner: '',
        h1Line3: '跟進一站做',
        h1pre: '一位老師都開得起，',
        h1accent: '備課到回饋一條龍',
        sub: '輸入課題、任務或資料，EziTeach AI 會幫你分流到備課、出題、簡報、成績分析、文件整理、行政流程與課後跟進等工具。',
        ctaStart: '免費開始使用',
        ctaEnter: '進入工作台',
        ctaPricing: '查看定價',
        noCard: '可先免費開始 · 支援個人 Pro 訂閱 · 教師保留最後判斷',
        stats: {
          time: { value: '3 段', label: '課前、課中、課後工作接成一條線' },
          tools: { value: '20+', label: '教學、行政、成績、文件工作工具集中管理' },
          solo: { value: '1 位', label: '個人老師可先用，毋須等學校採購' },
        },
        checkLead: '由一句任務開始，逐步幫你收好：',
        ck1: '備課',
        ck2: '出題',
        ck3: '教學簡報',
        ck4: '成績分析',
        ck5: '文件速讀',
        ck6: '課後跟進',
      },
      featuresTitle: '目前可用功能',
      featuresHeadline: '不是再多一個 AI 聊天框，而是一套老師每日會開的工作台',
      workflow: {
        eyebrow: '由一句任務開始',
        title: '把零散工具收成一條清晰工作流',
        sub: 'EziTeach AI 的入口是一個主搜尋 / 任務框：你輸入課題、教學任務、成績或文件需要，系統會帶你去合適工具，而不是要你記住每個功能在哪裡。',
        before: {
          title: '課前：準備一堂可用的課',
          desc: '由課題或教材出發，整理教案、教學指引、題目、工作紙、簡報和 DSE 操練；先有可改版本，再由老師調整。',
        },
        during: {
          title: '課中：按鐘聲推進',
          desc: '時間表、待辦、行事曆、重要日子倒數和課堂任務放回同一個工作台，減少上堂前後來回切換。',
        },
        after: {
          title: '課後：回饋與跟進',
          desc: '匯入分數、生成成績報告、找出弱項、整理批改和待跟進學生，下一堂課要補什麼一眼就見到。',
        },
      },
      useCases: {
        eyebrow: '最高頻使用場景',
        title: '先處理老師最花時間、最容易出錯的工作',
        sub: 'EziTeach AI 不只展示功能清單，而是圍繞一位老師每天真的會遇到的任務：準備下一堂課、出教材、分析成績、整理文件和課後跟進。',
        nextLesson: {
          title: '下一堂課任務包',
          desc: '輸入課題或任務，先整理教學目標、流程、活動和所需材料，老師由「有得改」開始，而不是由空白文件開始。',
        },
        materials: {
          title: '出題、工作紙與簡報',
          desc: '生成 MC、短答、個案題、長題、評分準則、工作紙和 PowerPoint 草稿；適合趕課、補課和公開試操練。',
        },
        marking: {
          title: '成績分析與跟進',
          desc: '用 Excel Cal Mark 模板匯入分數，生成班平均、題目弱項、預測等級、風險分層和成績報告。',
        },
        admin: {
          title: '行政文件與溝通',
          desc: '會議筆記、錄音轉文字、文件速讀、掃描 PDF、家長訊息初稿和行政 Word 套版收回一處。',
        },
      },
      f: {
        prepTitle: '備課與教案',
        prepDesc: '教案、教學指引、時間表、課題匯入與課程進度集中管理；AI 列出教學重點、常見誤解、課堂活動與評估方式。',
        aiTitle: '出題與教材生成',
        aiDesc: '輸入課題即可生成 MC、短答、個案題、長題、工作紙、評分準則和 DSE 風格操練；題目可整理入題庫。',
        aiaTitle: '簡報工作室',
        aiaDesc: '由課題或貼上的內容生成 .pptx 草稿，支援多款設計模板、版式配置、封面與內頁配圖；需要時可下載再微調。',
        gradeTitle: '成績分析與批改',
        gradeDesc: '支援 Excel Cal Mark 模板匯入分數，分析題目表現、預測等級、弱項和跟進分組；AI 內容仍由老師覆核。',
        attTitle: '課堂與班務',
        attDesc: '時間表、待辦、行事曆、重要日子倒數與課堂任務整理，幫你上堂前後少啲切換。',
        commTitle: '行政、文件與溝通',
        commDesc: '家長訊息初稿、Word 行政文件套版、文件速讀、會議 / 觀課錄音轉文字、掃描 PDF 和工作週報。',
        moreTitle: '同一個工作台內還有',
        more: '教學 AI、全域搜尋、問我資料 AI、教學資源庫、資源分享區、老師社群、行事曆、快速擷取、科組協作',
      },
      proof: {
        eyebrow: '散戶先行',
        quote: '先令一位老師覺得「今晚真係幫到我」，科組和學校級 adoption 才有自然發生的理由。',
        quoteBy: '產品定位由個人老師切入：可免費開始、需要時個人訂閱、功能見效快、資料可控、學生資料處理有清楚提醒。當老師願意在科組分享成果，EziTeach AI 才順勢變成團隊工具。',
        solo: {
          title: '一位老師也能開始',
          desc: '不用等學校採購或 IT 開帳戶；先用免費版整理自己的課堂工作流，需要更多額度再升級。',
        },
        privacy: {
          title: '先保護學生私隱',
          desc: '成績和班務資料建議用代號或遮蔽可識別資料；AI 產出只作初稿，教師保留最後判斷。',
        },
        portable: {
          title: '本機優先，再雲端同步',
          desc: '個人老師最重視可控感：本機使用、登入後同步、需要時可匯出或清除資料。',
        },
      },
      trust: {
        solo: '個人老師可即開即用',
        privacy: '私隱先行，學生資料建議用代號',
        review: 'AI 只作初稿，教師保留最後判斷',
        portable: '可本機使用，登入後再雲端同步',
        local: '資料存你部機，登入先雲端同步',
        offline: '可安裝；部分本機功能可離線使用（PWA）',
        a11y: '無障礙設計 · 手機 / 平板適配',
      },
      faq: {
        eyebrow: '常見問題',
        title: '先解答購買前會問的事',
        sub: '教育產品最怕「看起來好用，但不敢真的放進日常」。這裡把私隱、收費、資料和 AI 責任先講清楚。',
        school: {
          q: '一定要學校採購先用到嗎？',
          a: '不用。EziTeach AI 以個人老師先行，你可以用免費版整理自己的備課、成績和課後工作；到科組或學校有需要時，再討論團隊方案。',
        },
        studentData: {
          q: '可以輸入學生資料嗎？',
          a: '如要處理成績、班務或課堂紀錄，建議先用學生編號或代號，避免輸入可識別資料。處理個人資料時仍要按學校政策和香港法例要求。',
        },
        subjects: {
          q: '只適合某一科嗎？',
          a: '不是。設定內可選不同任教科目，備課、出題、簡報、成績分析和行政流程本身是跨科目工作流。',
        },
        pricing: {
          q: '免費版和付費版最大分別是什麼？',
          a: '免費版讓你先試核心工作流；Plus / Pro 是個人訂閱，主要增加每月 AI 點數、雲端同步和高階能力，適合每星期穩定使用或密集備課。',
        },
        export: {
          q: '資料可以帶走嗎？',
          a: '可以。產品保留匯出和清除資料入口；部分功能亦可下載 Excel、CSV、Word、PDF 或 PowerPoint，方便你保留自己的教學成果。',
        },
        aiReview: {
          q: 'AI 生成內容可以直接用嗎？',
          a: 'AI 只應作初稿。題目、教案、成績分析、評語、家長訊息和正式文件都應由老師覆核，尤其涉及學生、評估或對外溝通時。',
        },
      },
      ctaTitle: '今個學期，把教學工作收回同一個地方',
      ctaSub: '先用免費版試核心工作流；需要更多 AI 點數、同步或 Pro 功能時再升級。',
      toolPills: {
        prep: '備課',
        teachingAI: '教學 AI',
        lessonPlan: '教案',
        materials: '出題',
        slides: '簡報',
        gradeAnalytics: '成績分析',
        scan: '掃描 PDF',
        transcribe: '錄音轉文字',
      },
      scene: {
        slideTitle: '課堂簡報',
        slideMeta: '12 slides · 已配圖',
        generatedTitle: '由課題生成',
        generatedItems: {
          lessonFocus: '教學重點',
          classActivity: '課堂活動',
          rubric: '評分準則',
        },
        taskPackTitle: '明日任務包',
        taskPackItems: {
          worksheet: '工作紙',
          shortAnswer: '短答題',
          parentMessage: '家長信初稿',
        },
        workspaceTitle: '今日工作台',
        workspaceMeta: '5 個任務 · 下堂前 18 分鐘',
        syncing: '同步中',
        rows: {
          prep: { title: '中三商業環境教案', meta: 'AI 已整理重點與活動' },
          quiz: { title: 'DSE 個案題 12 題', meta: '連參考答案與評分準則' },
          slides: { title: '教學簡報草稿', meta: '封面與版式已配好' },
          marking: { title: '待批改任務', meta: '今日跟進中' },
        },
        statusReady: '已準備',
        statusActive: '進行中',
        weaknessTitle: '全班弱項',
        weaknesses: {
          cashflow: '現金流',
          depreciation: '折舊',
          positioning: '市場定位',
        },
        downloadTitle: '下載即用',
        downloadBody: '教案、簡報、工作紙已放入同一個課堂包。',
      },
      footer: {
        privacy: '私隱政策',
        terms: '服務條款',
        guidelines: '社群守則',
        pricing: '定價',
        copy: '為香港教育工作者而設',
        dataNotice:
          '私隱政策及個人資料處理以香港《個人資料（私隱）條例》（第 486 章）的要求作設計方向；處理成績、班務或課堂紀錄前，請先使用代號或遮蔽可識別學生資料。',
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
          '：筆記、教案、題目、成績分析輸入、班務記錄等教學內容。預設只存喺你裝置嘅瀏覽器（localStorage）；登入後會同步到我哋嘅雲端供應商 Supabase。如需處理學生相關資料，建議使用學生編號或代號，並避免輸入可識別學生資料。',
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
          '平台供教師專業使用，不面向兒童。若教師在成績、班務或課堂紀錄工具輸入學生相關資料，須按學校政策及適用法律處理，並應盡量使用代號或遮蔽可識別資料；我哋不會主動向兒童收集個人資料。',
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
          '本平台為香港教師提供備課、出題、成績管理、班務跟進、對外訊息初稿、行政文件及 AI 教學助手等工具。我哋可能不時更新、增刪功能。',
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
        legalTitle: '法律、私隱與支援',
        legalHint:
          '服務條款、私隱政策、社群守則、定價與支援集中放喺呢度；處理學生相關資料前，建議先使用代號或遮蔽可識別資料。',
        legalLinks: {
          privacy: '私隱政策',
          terms: '服務條款',
          guidelines: '社群守則',
          pricing: '定價',
        },
        legalNoticeTitle: '學生資料處理提示',
        legalNotice:
          '處理成績、班務或課堂紀錄前，請先使用學生代號或遮蔽可識別個人資料。AI 內容只作初稿及輔助判斷，教師仍保留最後專業覆核。',
        legalCopyright: '© {{year}} EziTeach AI · 香港老師的 AI 工作台',
      },
    },
  },
  en: {
    translation: {
      ...appEn,
      signingIn: 'Signing in…',
      nav: { pricing: 'Pricing', start: 'Get started', enterApp: 'Open workspace' },
      landingNav: { workflow: 'Workflow', features: 'Features', faq: 'FAQ' },
      landingMeta: {
        description:
          'EziTeach AI is the AI workspace for Hong Kong teachers: start from a topic or task and organise lesson prep, question generation, slides, grade analytics, document handling, admin workflows and lesson follow-up. Start free, then upgrade for more AI credits or Pro features.',
        socialDescription:
          'The AI workspace for Hong Kong teachers: lesson prep, questions, slides, grade analytics, documents and follow-up in one place.',
      },
      hero: {
        badge: 'Individual teachers first · Hong Kong classroom context',
        painLabel: 'AI workspace for Hong Kong teachers',
        h1Title: 'One prompt, from lesson prep to follow-up',
        h1Line1: 'One prompt,',
        h1Line2: 'prep to',
        h1Joiner: ' ',
        h1Line3: 'follow-up',
        h1pre: 'One teacher can start, ',
        h1accent: 'from prep to feedback',
        sub: 'Enter a topic, task or file, and EziTeach AI routes you to lesson prep, question generation, slides, grade analytics, document handling, admin workflows and follow-up tools.',
        ctaStart: 'Start free',
        ctaEnter: 'Open workspace',
        ctaPricing: 'See pricing',
        noCard: 'Start free · Individual Pro subscription · Teacher keeps final judgement',
        stats: {
          time: { value: '3 phases', label: 'Before, during and after class connected' },
          tools: { value: '20+', label: 'Teaching, admin, grades and document work in one workspace' },
          solo: { value: '1 teacher', label: 'Start individually before school procurement' },
        },
        checkLead: 'Start with one task and organise:',
        ck1: 'Lesson prep',
        ck2: 'Questions',
        ck3: 'Slides',
        ck4: 'Grade analytics',
        ck5: 'Document digest',
        ck6: 'Follow-up',
      },
      featuresTitle: 'Available now',
      featuresHeadline: 'Not another AI chat box, but a workspace teachers can open every day',
      workflow: {
        eyebrow: 'Start with one task',
        title: 'Turn scattered tools into one clear workflow',
        sub: 'The entry point is a main search / task box. Enter a topic, teaching task, score file or document need, and the system guides you to the right tool instead of making you remember every feature.',
        before: {
          title: 'Before class: prepare a usable lesson',
          desc: 'From a topic or material, organise lesson plans, teaching guides, questions, worksheets, slides and DSE-style practice. Start from an editable draft, then adjust as the teacher.',
        },
        during: {
          title: 'During class: keep the lesson moving',
          desc: 'Timetable, tasks, calendar, countdowns and class-task planning sit in the same workspace, reducing switching before and after class.',
        },
        after: {
          title: 'After class: feedback and follow-up',
          desc: 'Import scores, generate reports, identify weak spots, organise marking and follow-up groups, so the next lesson focus is visible.',
        },
      },
      useCases: {
        eyebrow: 'High-frequency teacher jobs',
        title: 'Start with the work that costs teachers the most time and attention',
        sub: 'EziTeach AI is organised around real daily jobs: preparing the next lesson, generating materials, analysing grades, handling documents and following up after class.',
        nextLesson: {
          title: 'Next-lesson task pack',
          desc: 'Enter a topic or task and first organise learning goals, flow, activities and materials, so teachers start from something editable rather than a blank document.',
        },
        materials: {
          title: 'Questions, worksheets and slides',
          desc: 'Generate MC, short-answer, case, long questions, rubrics, worksheets and PowerPoint drafts for normal lessons, catch-up lessons and public-exam practice.',
        },
        marking: {
          title: 'Grade analytics and follow-up',
          desc: 'Use the Excel Cal Mark template to import scores and produce class averages, question weaknesses, grade predictions, risk groups and reports.',
        },
        admin: {
          title: 'Admin documents and communication',
          desc: 'Meeting notes, audio transcription, document digest, PDF scan, parent-message drafts and Word admin templates sit in one place.',
        },
      },
      f: {
        prepTitle: 'Planning and lesson prep',
        prepDesc: 'Lesson plans, teaching guides, timetable, topic import and curriculum progress in one place; AI lists key points, misconceptions, activities and assessments.',
        aiTitle: 'Questions & materials',
        aiDesc: 'Type a topic to generate MC, short-answer, case, long questions, worksheets, rubrics and DSE-style practice; questions can be organised into the question bank.',
        aiaTitle: 'Slide studio',
        aiaDesc: 'Generate .pptx drafts from a topic or pasted content, with design templates, layout support, cover and in-slide imagery; download and refine when needed.',
        gradeTitle: 'Grade analytics and marking',
        gradeDesc: 'Import scores with the Excel Cal Mark template, analyse question performance, predict grades, identify weak spots and build follow-up groups. AI output remains under teacher review.',
        attTitle: 'Classroom and class admin',
        attDesc: 'Timetable, tasks, calendar, countdowns and class-task planning help reduce switching before and after lessons.',
        commTitle: 'Admin, documents and communication',
        commDesc: 'Parent-message drafts, Word admin templates, document digest, meeting / lesson audio transcription, PDF scanning and weekly work reports.',
        moreTitle: 'Also in the same workspace',
        more: 'Teaching AI, global search, ask-my-data AI, resource library, resource sharing, teacher community, calendar, quick capture and panel collaboration',
      },
      proof: {
        eyebrow: 'Individual teachers first',
        quote: 'Win the moment when one teacher feels, “this actually helps me tonight,” and panel or school adoption has a reason to grow.',
        quoteBy: 'The product enters through the individual teacher: start free, upgrade personally when needed, get value quickly, keep data controllable and handle student information with clear reminders.',
        solo: {
          title: 'One teacher can start',
          desc: 'No procurement cycle or IT account setup required; start with the free plan and upgrade only when you need more capacity.',
        },
        privacy: {
          title: 'Student privacy first',
          desc: 'Scores and class records should use codes or masked details where possible. AI output is a draft and teachers keep final judgement.',
        },
        portable: {
          title: 'Local-first, then cloud sync',
          desc: 'Individual teachers need control: local use, sign-in sync, export and clear-data paths when needed.',
        },
      },
      trust: {
        solo: 'Individual teachers can start instantly',
        privacy: 'Privacy-first, use codes for student data',
        review: 'AI drafts; teachers keep final judgment',
        portable: 'Local use first, cloud sync after sign-in',
        local: 'Data on your device, synced once you sign in',
        offline: 'Installable; some local tools work offline (PWA)',
        a11y: 'Accessible · phone / tablet ready',
      },
      faq: {
        eyebrow: 'FAQ',
        title: 'Answer the questions buyers ask first',
        sub: 'Education products must feel safe enough for daily use. Privacy, pricing, data ownership and AI responsibility are made explicit before signup.',
        school: {
          q: 'Do I need school procurement first?',
          a: 'No. EziTeach AI is designed for individual teachers to start first. Use the free plan for your own lesson prep, grade and follow-up workflow, then discuss panel or school options when there is demand.',
        },
        studentData: {
          q: 'Can I enter student data?',
          a: 'For scores, class admin or lesson records, use student IDs or codes and avoid identifiable details where possible. Personal data handling must still follow school policy and Hong Kong law.',
        },
        subjects: {
          q: 'Is this only for one subject?',
          a: 'No. Lesson prep, question generation, slides, grade analytics and admin workflows are designed to work across subjects.',
        },
        pricing: {
          q: 'What is the main difference between free and paid plans?',
          a: 'The free plan lets you try the core workflow. Plus and Pro are individual subscriptions that mainly add monthly AI credits, cloud sync and advanced capacity for regular or heavy use.',
        },
        export: {
          q: 'Can I take my data with me?',
          a: 'Yes. Export and clear-data paths are built into the product, and some tools download Excel, CSV, Word, PDF or PowerPoint outputs.',
        },
        aiReview: {
          q: 'Can AI output be used directly?',
          a: 'AI output should be treated as a draft. Teachers should review questions, lesson plans, grade analysis, comments, parent messages and formal documents before using them.',
        },
      },
      ctaTitle: 'Bring your teaching work back into one place this term',
      ctaSub: 'Start with the free core workflow; upgrade when you need more AI credits, sync or Pro features.',
      toolPills: {
        prep: 'Prep',
        teachingAI: 'Teaching AI',
        lessonPlan: 'Lesson plans',
        materials: 'Question generation',
        slides: 'Slides',
        gradeAnalytics: 'Grade analytics',
        scan: 'Scan PDF',
        transcribe: 'Audio to text',
      },
      scene: {
        slideTitle: 'Lesson slides',
        slideMeta: '12 slides · images added',
        generatedTitle: 'Generated from topic',
        generatedItems: {
          lessonFocus: 'Teaching points',
          classActivity: 'Class activity',
          rubric: 'Rubric',
        },
        taskPackTitle: "Tomorrow's task pack",
        taskPackItems: {
          worksheet: 'Worksheet',
          shortAnswer: 'Short answers',
          parentMessage: 'Parent-message draft',
        },
        workspaceTitle: "Today's workspace",
        workspaceMeta: '5 tasks · 18 min before next class',
        syncing: 'Syncing',
        rows: {
          prep: { title: 'S3 business environment plan', meta: 'AI organised points and activities' },
          quiz: { title: '12 DSE case questions', meta: 'With answers and rubrics' },
          slides: { title: 'Teaching slide draft', meta: 'Cover and layouts prepared' },
          marking: { title: 'Marking tasks', meta: 'In progress today' },
        },
        statusReady: 'Ready',
        statusActive: 'In progress',
        weaknessTitle: 'Class weak spots',
        weaknesses: {
          cashflow: 'Cash flow',
          depreciation: 'Depreciation',
          positioning: 'Market positioning',
        },
        downloadTitle: 'Download-ready',
        downloadBody: 'Lesson plan, slides and worksheet are inside one lesson pack.',
      },
      footer: {
        privacy: 'Privacy',
        terms: 'Terms',
        guidelines: 'Community Guidelines',
        pricing: 'Pricing',
        copy: 'Made for Hong Kong educators',
        dataNotice:
          'The Privacy Policy and personal data handling are designed with Hong Kong Personal Data (Privacy) Ordinance (Cap. 486) requirements in mind; use codes or mask identifiable student details before handling scores, class admin or lesson records.',
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
          ': notes, lesson plans, questions, grade-analysis inputs, class records and other teaching content. By default this is stored only in your device’s browser (localStorage); once you sign in it syncs to our cloud provider, Supabase. If you need to handle student-related information, use student IDs or codes where possible and avoid identifiable student details.',
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
          'The Platform is for professional use by teachers and is not directed at children. If teachers enter student-related information in grade, class-management or lesson-record tools, they must handle it according to school policy and applicable law, and should use codes or mask identifiable details where possible. We do not actively collect personal data from children.',
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
          'The Platform provides Hong Kong teachers with tools for lesson prep, question generation, grade management, class follow-up, parent-message drafts, admin documents and an AI teaching assistant. We may update, add or remove features from time to time.',
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
        legalTitle: 'Legal, Privacy & Support',
        legalHint:
          'Terms, privacy, community guidelines, pricing and support are kept here. Before working with student-related data, use student codes or mask identifiable information.',
        legalLinks: {
          privacy: 'Privacy Policy',
          terms: 'Terms of Service',
          guidelines: 'Community Guidelines',
          pricing: 'Pricing',
        },
        legalNoticeTitle: 'Student Data Reminder',
        legalNotice:
          'Before processing grades, class admin or lesson records, use student codes or mask identifiable personal data. AI output is a draft and support tool; teachers keep final professional review.',
        legalCopyright: '© {{year}} EziTeach AI · AI workspace for Hong Kong teachers',
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
