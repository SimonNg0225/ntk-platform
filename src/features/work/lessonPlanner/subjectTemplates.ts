// ============================================================
//  逐科教案範本（內建常數）
//  ------------------------------------------------------------
//  每科 ~3 個範本，反映該科常見課堂形態 / 教學風格；用戶揀任教科目
//  後，備課時顯示該科範本（直接用 / 畀 AI 做骨架）。未知科目 → 通用組。
//  範本 = LessonPlan(objectives) + PlanMeta(phases/materials) 嘅骨架。
// ============================================================

export interface TplPhase {
  label: string
  minutes: number
  detail: string
}

export interface BuiltinLessonTemplate {
  id: string
  subjectId: string
  name: string
  style: string
  objectives: string
  phases: TplPhase[]
  materials: string[]
}

// subjectId 省略（build 時補 id）。
type RawTpl = Omit<BuiltinLessonTemplate, 'id'>

// ───────── 通用風格組（未設科目 / 未知科目 fallback）─────────
export const GENERIC_TEMPLATES: BuiltinLessonTemplate[] = [
  {
    id: 'generic-tpl-1',
    subjectId: 'generic',
    name: '概念講授（三段式）',
    style: '講授',
    objectives: '1. 學生能說明本課核心概念\n2. 學生能舉例應用所學概念\n3. 學生能完成相關課堂練習',
    phases: [
      { label: '引入 (Hook)', minutes: 5, detail: '以提問 / 情境 / 短片帶出今日課題，激活先備知識。' },
      { label: '講解 (Teach)', minutes: 20, detail: '逐步講解核心概念，配合例子與板書。' },
      { label: '課堂活動 (Activity)', minutes: 18, detail: '學生做練習 / 討論 / 應用任務，老師巡視回饋。' },
      { label: '鞏固 (Check)', minutes: 8, detail: '即場提問 / 小測，檢查理解。' },
      { label: '總結 (Summary)', minutes: 4, detail: '歸納重點，預告下節。' },
    ],
    materials: ['PowerPoint 簡報', '課堂工作紙', '練習題'],
  },
  {
    id: 'generic-tpl-2',
    subjectId: 'generic',
    name: '探究式課堂',
    style: '探究',
    objectives: '1. 學生能就問題提出假設\n2. 學生能搜集 / 分析資料驗證假設\n3. 學生能歸納結論並匯報',
    phases: [
      { label: '提出問題', minutes: 7, detail: '以真實情境引發探究問題，學生提出初步猜想。' },
      { label: '小組探究', minutes: 18, detail: '學生搜集 / 分析資料，記錄發現。' },
      { label: '匯報分享', minutes: 15, detail: '各組匯報，互相提問。' },
      { label: '歸納總結', minutes: 10, detail: '老師引導歸納，連結課程概念。' },
    ],
    materials: ['探究任務卡', '資料 / 數據', '匯報工作紙'],
  },
  {
    id: 'generic-tpl-3',
    subjectId: 'generic',
    name: '活動為本課堂',
    style: '活動',
    objectives: '1. 學生能透過活動體驗概念\n2. 學生能協作完成任務\n3. 學生能反思活動所學',
    phases: [
      { label: '引入與分組', minutes: 6, detail: '介紹活動目標與規則，分組。' },
      { label: '活動進行', minutes: 25, detail: '學生協作完成活動任務，老師引導。' },
      { label: '分享', minutes: 12, detail: '各組分享成果與心得。' },
      { label: '反思總結', minutes: 7, detail: '連結學習目標，反思所學。' },
    ],
    materials: ['活動材料', '任務說明卡', '反思工作紙'],
  },
  {
    id: 'generic-tpl-4',
    subjectId: 'generic',
    name: '操卷應試訓練',
    style: '操卷',
    objectives: '1. 學生能在限時內完成試題\n2. 學生能識別常見失分原因\n3. 學生能掌握答題策略',
    phases: [
      { label: '題型分析', minutes: 8, detail: '分析考核範圍與評分重點。' },
      { label: '限時作答', minutes: 22, detail: '學生在模擬考試條件下作答。' },
      { label: '對答案 / 講解', minutes: 12, detail: '逐題講解參考答案與常見錯誤。' },
      { label: '訂正反思', minutes: 8, detail: '學生訂正並記錄失分原因。' },
    ],
    materials: ['歷屆 / 模擬試題', '評分準則', '失分分析表'],
  },
  {
    id: 'generic-tpl-5',
    subjectId: 'generic',
    name: '討論 / 思辨課堂',
    style: '討論',
    objectives: '1. 學生能就議題提出有理據立場\n2. 學生能回應不同觀點\n3. 學生能持平歸納多角度看法',
    phases: [
      { label: '議題引入', minutes: 6, detail: '展示議題，學生表態。' },
      { label: '資料 / 立場準備', minutes: 12, detail: '學生研讀資料，準備論點。' },
      { label: '討論 / 辯論', minutes: 18, detail: '正反交流，老師引導追問。' },
      { label: '反思總結', minutes: 9, detail: '歸納多角度，個人反思。' },
    ],
    materials: ['議題資料', '立場 / 觀察工作紙', '評估準則'],
  },
]

// ───────── 逐科範本（subagent 起草，已校；build 時補 id）─────────
const RAW: RawTpl[] = [
  // ── 經濟 econ ──
  { subjectId: 'econ', name: '概念講授：需求與供應均衡', style: '講授', objectives: '1. 能繪製需求與供應曲線並解釋斜率成因\n2. 能分析影響需求量及需求轉移嘅因素並以圖表說明均衡變動\n3. 能用理論解釋現實價格現象', phases: [ { label: '引入', minutes: 6, detail: '展示雞蛋價格上升新聞，問「咩原因令雞蛋貴咗？」引出需求/供應轉移分別。' }, { label: '圖表講解', minutes: 15, detail: '白板畫 D、S 曲線，解釋「需求量變」vs「需求變」，示範曲線移動與均衡變化。' }, { label: '時事圖表分析', minutes: 12, detail: '分析香港樓價案例，討論低息、人口、辣招對 D、S 影響，要求繪圖。' }, { label: '即堂練習', minutes: 10, detail: '完成 3 情景題，以圖表說明均衡價量變動方向。' }, { label: '總結', minutes: 7, detail: '歸納影響移動嘅系統因素，強調圖文並茂作答。' } ], materials: ['需求供應圖表工作紙', '雞蛋/樓市時事節錄', '情景練習題', '因素總結筆記', 'DSE 評分示例'] },
  { subjectId: 'econ', name: '時事探究：以邊際分析解讀政策', style: '探究', objectives: '1. 能用邊際成本與邊際收益分析理性決策\n2. 能就政策（最低工資、消費券）評估邊際效益及成本\n3. 能從經濟視角提出有理據建議', phases: [ { label: '探究問題引入', minutes: 5, detail: '問「最低工資應否加至$50/小時？」學生先寫直覺答案。' }, { label: '概念鷹架', minutes: 10, detail: '介紹邊際分析（多聘一人 MC vs MR），以快餐店例子說明僱主決策點。' }, { label: '小組資料研讀', minutes: 12, detail: '閱讀最低工資政策報告節錄，識別受影響行業及就業效應。' }, { label: '辯論與分析', minutes: 13, detail: '正反方以邊際概念支持立場，老師追問「邊際效益大定成本大？」' }, { label: '總結反思', minutes: 10, detail: '歸納「沒有免費午餐」原則，比較直覺與分析後結論。' } ], materials: ['最低工資統計數據節錄', '勞動市場供求圖工作紙', '邊際分析概念卡', '辯論立場記錄表', '政策評估寫作框架'] },
  { subjectId: 'econ', name: 'DSE 操卷：數據題與論述題', style: '操卷', objectives: '1. 能限時解讀統計圖表並提取關鍵數據\n2. 能用「概念—理論—實例—結論」框架答 8 分論述題\n3. 能準確運用 DSE 評分用語', phases: [ { label: '題型解構', minutes: 8, detail: '分析 4 分、8 分題評分差異，示範「分析」vs「描述」答案分別。' }, { label: '數據解讀練習', minutes: 10, detail: '就 GDP/通脹/失業率圖答 3 短題，用具體數據描述趨勢。' }, { label: '限時論述題', minutes: 20, detail: '限時完成一條 8 分論述題（如擴張性財政政策效果）。' }, { label: '範文對比', minutes: 12, detail: '對比 Level 4 與 Level 5 示範答案，學生加批注。' } ], materials: ['DSE 數據題（2 年）', '統計圖工作紙', '8 分論述練習卷', 'Level 4 vs 5 對比表', '經濟術語評分字眼清單'] },

  // ── 中國語文 chin ──
  { subjectId: 'chin', name: '範文精讀：修辭手法與文意分析', style: '精讀', objectives: '1. 能識別常見修辭（比喻、對偶、排比、借代）並分析效果\n2. 能理解篇章結構及作者意圖，以文本證據支持\n3. 能仿效修辭手法寫作', phases: [ { label: '引入', minutes: 5, detail: '朗讀《岳陽樓記》開首，學生閉眼聆聽感受節奏。' }, { label: '文本細讀', minutes: 15, detail: '逐段精讀，學生圈關鍵詞，標注修辭類別及作用。' }, { label: '修辭分析', minutes: 12, detail: '板書對偶 / 排比結構對比，分析景物描寫如何烘托憂樂觀。' }, { label: '仿寫練習', minutes: 12, detail: '就「校園一景」以排比 / 對偶寫 4-6 句，即場點評。' }, { label: '總結', minutes: 6, detail: '歸納修辭答題格式，預告文言語譯。' } ], materials: ['《岳陽樓記》注釋講義', '修辭分類工作紙', '文本細讀批注指引', '仿寫練習格', '修辭答題格式卡'] },
  { subjectId: 'chin', name: '卷四口語說話：議題討論訓練', style: '說話', objectives: '1. 能就議題提出有條理立場並運用論據\n2. 能在小組討論積極回應、追問\n3. 能流暢表達、避免贅詞', phases: [ { label: '議題引入', minutes: 5, detail: '展示議題卡「中學應否全面 BYOD？」，學生 3 分鐘準備立場。' }, { label: '技巧示範', minutes: 8, detail: '分析卷四示範片段嘅「引述、反駁、追問」語言表達。' }, { label: '小組討論', minutes: 18, detail: '模擬卷四討論，老師以評估表記錄參與、論點、語言。' }, { label: '觀察反饋', minutes: 10, detail: '針對性口頭反饋：贅詞、切題、回應他人。' }, { label: '個人反思', minutes: 9, detail: '填自我評估表，寫一個改善目標。' } ], materials: ['議題討論卡（5 個）', '卷四評估準則講義', '說話技巧示範片段', '小組觀察評估表', '自我評估反思表'] },
  { subjectId: 'chin', name: '寫作工作坊：議論文立論與結構', style: '寫作', objectives: '1. 能確立可辯論點，以「論點—論據—論證」組織段落\n2. 能運用連接詞增強邏輯\n3. 能識別及修改議論文常見問題', phases: [ { label: '審題', minutes: 7, detail: '展示「逆境使人成長，你同意嗎？」分析關鍵詞與立場。' }, { label: '立論示範', minutes: 10, detail: '示範將立場轉化成具體分論點。' }, { label: '段落寫作', minutes: 18, detail: '就一分論點寫完整議論段（150-200 字），含論點、事例、論證、小結。' }, { label: '同儕修改', minutes: 10, detail: '交換作品，按四項批注並指出 1 個改進點。' }, { label: '總結', minutes: 7, detail: '匿名展示段落，討論修改方向，歸納評分要點。' } ], materials: ['審題工作紙', '論點—論據—論證範本', '分論點擴充練習格', '同儕修改量表', 'DSE 優秀範文節錄'] },

  // ── 英國語文 eng ──
  { subjectId: 'eng', name: 'Reading Workshop: Inferential Comprehension', style: '精讀', objectives: '1. Students can identify explicit and implicit information and distinguish facts from inferences\n2. Students can use contextual clues to deduce meaning of unfamiliar vocabulary\n3. Students can apply annotation strategies for argumentative texts', phases: [ { label: 'Warm-up', minutes: 5, detail: 'Display three headlines; students predict article content, activating prior knowledge.' }, { label: 'First Reading', minutes: 8, detail: 'Students read an unseen argumentative article (~450 words) silently, underlining key arguments.' }, { label: 'Vocabulary in Context', minutes: 10, detail: 'Model deducing 4 target words from context; students attempt 3 using a clue chart.' }, { label: 'Inferential Q&A', minutes: 15, detail: 'Answer 5 questions (literal to inferential); Socratic questioning in discussion.' }, { label: 'Annotation Sharing', minutes: 8, detail: 'Compare annotations with a partner; highlight strong examples.' }, { label: 'Wrap-up', minutes: 7, detail: 'Summarise three inference strategies; link to DSE Paper 1 Part B.' } ], materials: ['Unseen argumentative article', 'Context clue vocabulary chart', 'Comprehension question sheet (5 Qs)', 'Text annotation guide card', 'DSE Paper 1 Part B samples'] },
  { subjectId: 'eng', name: 'Writing Workshop: Persuasive Essays', style: '寫作', objectives: '1. Students can construct a clear thesis and supporting topic sentences\n2. Students can employ persuasive devices (rhetorical questions, counter-argument, modals)\n3. Students can use discourse markers for cohesion', phases: [ { label: 'Model Text Analysis', minutes: 10, detail: 'Analyse a Band 5 model essay: thesis placement, topic sentences, counter-argument pattern.' }, { label: 'Language Focus', minutes: 12, detail: 'Teach 3 persuasive devices with HK-context examples; practise transformations.' }, { label: 'Planning', minutes: 8, detail: 'Map thesis, 2 arguments, one counter-argument with rebuttal using a template.' }, { label: 'Timed Drafting', minutes: 15, detail: 'Draft intro + one body paragraph under timed conditions.' }, { label: 'Peer Feedback', minutes: 8, detail: 'Exchange drafts; give one glow + one grow comment on a feedback form.' } ], materials: ['Band 5 model persuasive essay', 'Persuasive devices reference card', 'Essay planning template', 'Timed drafting prompt card', 'Peer feedback form'] },
  { subjectId: 'eng', name: 'Integrated Skills: Listening & Speaking Debate', style: '活動', objectives: '1. Students can extract key arguments from a listening text for discussion\n2. Students can deliver a 2-minute spoken argument with discourse markers\n3. Students can respond to opposing views with polite, evidence-based rebuttals', phases: [ { label: 'Listening Task', minutes: 10, detail: 'Listen to a 3-min radio debate; complete a note-taking grid of arguments + evidence.' }, { label: 'Language Input', minutes: 8, detail: 'Introduce expressions for polite disagreement, signposting, and stress for emphasis.' }, { label: 'Group Preparation', minutes: 12, detail: 'Groups plan 2 arguments per side using clip evidence; teacher checks coherence.' }, { label: 'Mini Debate', minutes: 15, detail: 'Structured mini-debate; others observe with a checklist.' }, { label: 'Reflection & Feedback', minutes: 8, detail: 'Whole-class feedback on pronunciation, debate language, rebuttals; self-evaluate.' } ], materials: ['Radio debate audio clip (3 min)', 'Listening note-taking grid', 'Spoken debate expressions card', 'Group debate planning template', 'Self-evaluation checklist'] },

  // ── 數學 math ──
  { subjectId: 'math', name: '概念建構：二次函數圖像', style: '講授', objectives: '1. 識辨 y = ax²+bx+c 中 a、b、c 對拋物線嘅影響\n2. 能以頂點式描述頂點及對稱軸\n3. 正確繪製二次函數圖像並標關鍵點', phases: [ { label: '引入', minutes: 5, detail: '以拋擲籃球路徑引入，問「點解係曲線唔係直線」。' }, { label: '講解示範', minutes: 15, detail: '板書由 y=x²→2x²→−x²+3，用彩色粉筆示範由係數讀圖像特徵。' }, { label: '引導提問', minutes: 8, detail: '問「若 a<0 圖像點變？」學生即席在迷你白板畫預測。' }, { label: '課堂練習', minutes: 15, detail: '完成讀圖識式、由係數畫圖、錯誤分析三題，同桌互改。' }, { label: '總結鞏固', minutes: 7, detail: '用動畫展示 a、h、k 滑桿改變圖像，整理筆記。' } ], materials: ['坐標格工作紙（含錯誤分析）', '迷你白板及筆', 'GeoGebra/Keynote 滑桿演示', '彩色粉筆', '半完成筆記框架'] },
  { subjectId: 'math', name: '例題示範與操練：三角函數方程', style: '示範操練', objectives: '1. 運用參考角及 CAST 在 0°–360° 求方程所有解\n2. 識別常見錯誤：遺漏第二象限解、角度超界\n3. 限時內完整列解題步驟', phases: [ { label: '暖身快問', minutes: 5, detail: '展示 CAST 圖，學生口答各象限三角比正負。' }, { label: '例題示範', minutes: 12, detail: '解 sin θ=−√3/2，板書四步：定參考角→判象限→列全解→篩範圍。' }, { label: '仿做練習', minutes: 10, detail: '仿做 cos θ=−1/2，針對「只寫一解」「參考角錯」點評。' }, { label: '錯誤分析', minutes: 8, detail: '投影 3 份學生答案，圈問題並寫正確步驟。' }, { label: '限時操卷', minutes: 12, detail: '獨立完成兩題 DSE 難度（含 tan、2θ 形式）。' }, { label: '講解收結', minutes: 3, detail: '講標準答案，提示記錄錯題。' } ], materials: ['CAST 圖工作紙', '例題板書框架', 'DSE 三角方程題精選', '錯誤分析投影片', '計時器'] },
  { subjectId: 'math', name: '探究規律：數列與通項', style: '探究', objectives: '1. 透過觀察規律歸納等差及等比數列通項\n2. 能以數學語言表達並驗證猜想\n3. 應用通項解決實際問題', phases: [ { label: '情境引入', minutes: 5, detail: '展示「1,3,5,7…」磁磚圖，問「第 100 塊係第幾個？」' }, { label: '小組探究', minutes: 15, detail: '各組獲數列卡，找規律、建公式、驗算，記錄於大白紙。' }, { label: '成果分享', minutes: 10, detail: '代表展示推導，老師引導至 T(n)=a+(n−1)d。' }, { label: '概念整固', minutes: 8, detail: '對比等差（加）與等比（乘），以複息示範等比應用。' }, { label: '應用練習', minutes: 12, detail: '完成三題應用，從情境建數列、求項、判斷成員。' } ], materials: ['數列探究卡（四款）', '大白紙及馬克筆', '磁磚情境圖', '應用題工作紙', '通項公式整理框架'] },

  // ── 公民與社會發展 csd ──
  { subjectId: 'csd', name: '議題探究：中國扶貧與可持續發展', style: '議題探究', objectives: '1. 分析中國脫貧政策措施及成效\n2. 從經濟、社會、環境評估對可持續發展影響\n3. 多角度持平回應「政府主導扶貧是否有效」', phases: [ { label: '導入議題', minutes: 7, detail: '播放山村脫貧前後對比短片，收集學生初步觀點。' }, { label: '資料閱讀', minutes: 12, detail: '閱讀數據圖表、批評文章、SDG 報告，標記關鍵證據。' }, { label: '小組討論', minutes: 12, detail: '用利弊框架整理論點，各持一方準備陳詞。' }, { label: '班級辯論', minutes: 10, detail: '正反陳詞，引導識別「立場與證據」分別。' }, { label: '批判反思', minutes: 9, detail: '思考資料局限，寫「持平觀點」模擬資料回應。' } ], materials: ['三份資料包', '利弊分析框架工作紙', '扶貧對比短片', '「持平觀點」書寫框架', '資料回應評分準則'] },
  { subjectId: 'csd', name: '國情認識：「一國兩制」下香港憲制地位', style: '講授', objectives: '1. 說明《基本法》框架下香港憲制地位及高度自治\n2. 區分「一國」與「兩制」範疇與限制\n3. 列舉居民受《基本法》保障嘅權利', phases: [ { label: '引入提問', minutes: 5, detail: '展示「香港係唔係獨立國家？」學生表態。' }, { label: '概念講解', minutes: 15, detail: '層級圖解釋《憲法》→《基本法》→香港法例，分一國 / 兩制空間。' }, { label: '條文分析', minutes: 10, detail: '閱讀第 2、23、45 條，提取自治、中央保留、權利三類資訊。' }, { label: '情景應用', minutes: 12, detail: '判斷三情景屬「一國」還是「兩制」並解釋。' }, { label: '總結歸納', minutes: 8, detail: '完成概念圖，強調依法定義，避免簡化。' } ], materials: ['《基本法》條文摘錄', '憲制層級圖', '情景判斷工作紙', '概念圖框架', 'DSE 題目範例'] },
  { subjectId: 'csd', name: '全球議題：氣候變化與國際合作', style: '資料回應', objectives: '1. 解讀多類型資料說明氣候變化成因及影響\n2. 評估已發展與發展中國家不同立場及責任\n3. 結構化回應「國際合作能否有效解決氣候問題」', phases: [ { label: '暖身活動', minutes: 5, detail: '展示極端天氣圖片，學生快速說一個成因一個影響。' }, { label: '資料解讀', minutes: 15, detail: '解讀溫升圖、碳排放圖、發言摘錄，完成三欄分析表。' }, { label: '多角度分析', minutes: 12, detail: '從四個持份者角度分析立場，引導「共同但有區別的責任」。' }, { label: '書面回應', minutes: 13, detail: '完成資料回應題，引用至少兩份資料寫正反論點。' }, { label: '同儕評改', minutes: 5, detail: '按準則互評並寫一句改善建議。' } ], materials: ['氣候資料集（5 份）', '三欄分析工作紙', '持份者角色卡', '資料回應評分準則', '同儕評改表'] },

  // ── 物理 phys ──
  { subjectId: 'phys', name: '概念建構：牛頓第二定律', style: '講授', objectives: '1. 陳述 F=ma 並說明各量單位及意義\n2. 分析加速度、質量、合力關係\n3. 正確繪自由體圖並解二維受力', phases: [ { label: '引入演示', minutes: 6, detail: '用氣墊軌道示範同一力推不同質量滑車，觀察 a∝1/m。' }, { label: '概念講解', minutes: 14, detail: '推導 F=ma，強調合外力，建立自由體圖繪製規範。' }, { label: '例題示範', minutes: 10, detail: '示範斜面問題：畫自由體圖→分解力→列方程→計加速度。' }, { label: '學生練習', minutes: 12, detail: '完成水平摩擦力、升降機磅秤兩題，糾正「忘記法向力」。' }, { label: '錯誤分析收結', minutes: 8, detail: '投影兩份學生答案，總結自由體圖「三必須」。' } ], materials: ['氣墊軌道及滑車', '自由體圖工作紙', '升降機磅秤題', '錯誤分析投影片', '彩色粉筆'] },
  { subjectId: 'phys', name: '實驗探究：驗證歐姆定律', style: '實驗', objectives: '1. 設計電路測不同電壓下電流，繪 I-V 圖\n2. 由斜率計算電阻並分析誤差\n3. 識別安全注意並正確操作儀表', phases: [ { label: '安全簡介', minutes: 5, detail: '講解電壓限制（≤12V）、量程選取、短路風險，簽安全守則。' }, { label: '電路設計討論', minutes: 8, detail: '討論安培計內外接法，問「100Ω 應用邊種？」畫電路圖。' }, { label: '實驗操作', minutes: 18, detail: '搭電路，調電壓 2–10V 記電流，重複取平均。' }, { label: '數據分析', minutes: 12, detail: '繪 I–V 圖，最佳擬合算斜率（1/R），計百分誤差。' }, { label: '結果討論收結', minutes: 7, detail: '報告 R 值，討論誤差原因，歸納歐姆定律條件。' } ], materials: ['電阻 100Ω', '可調直流電源 0–12V', '電壓表及電流表', '導線、麵包板、開關', '坐標紙及安全守則'] },
  { subjectId: 'phys', name: '操卷應試：力學 DSE 題型精練', style: '操卷', objectives: '1. 限時完整答 DSE 力學題（動量、能量守恆）\n2. 避免單位錯誤、方向未說明、精確度不足\n3. 運用答題策略提升效率', phases: [ { label: '答題策略講解', minutes: 5, detail: '介紹三策略：先寫方程、最後代值、檢查單位與有效數字。' }, { label: '限時作答', minutes: 20, detail: '完成 DSE 力學部分（動量守恆碰撞、能量法）。' }, { label: '自我批改', minutes: 8, detail: '對標準答案自批，標失分位並分類錯誤。' }, { label: '重點講解', minutes: 12, detail: '針對共同失分講解：動量矢量正負、機械能守恆條件。' }, { label: '改善目標設定', minutes: 5, detail: '記錄失分原因並設下次目標。' } ], materials: ['DSE 物理 Paper 1A 力學題', '標準答案投影片', '錯誤分類表', '計時器', '改善目標記錄卡'] },

  // ── 化學 chem ──
  { subjectId: 'chem', name: '概念建構：化學鍵與物質性質', style: '講授', objectives: '1. 區分離子鍵、共價鍵、金屬鍵形成條件\n2. 由鍵型預測熔沸點、導電性、溶解性\n3. 用電負性差判斷鍵型解釋宏觀性質', phases: [ { label: '引入現象', minutes: 6, detail: '展示食鹽、蠟燭、銅線，問「邊樣導電？邊樣熔點最高？」' }, { label: '概念講解', minutes: 16, detail: '分三段講離子、共價、金屬鍵，配點子模型板書。' }, { label: '引導歸納', minutes: 8, detail: '共同填鍵型比較表，糾正「離子化合物溶水必導電」迷思。' }, { label: '應用練習', minutes: 12, detail: '判斷 MgO、CH₄、Fe、HCl、SiO₂ 鍵型並預測一性質。' }, { label: '總結收結', minutes: 8, detail: '以 SiO₂ 共價晶體破除「高熔點=離子」迷思。' } ], materials: ['食鹽/石蠟/銅線實物', '化學鍵比較表', '點子模型圖', '應用練習工作紙', 'NaCl 晶格模型'] },
  { subjectId: 'chem', name: '實驗探究：金屬活躍性系列', style: '實驗', objectives: '1. 設計實驗比較鋅、鐵、銅活躍性順序\n2. 觀察金屬與酸及鹽溶液反應並分析\n3. 說明安全守則及正確處理廢料', phases: [ { label: '安全簡介', minutes: 5, detail: '講稀鹽酸守則：護目鏡手套、皮膚接觸沖水、廢液入廢液缸。' }, { label: '設計討論', minutes: 8, detail: '討論用置換反應比較活躍性，設計實驗矩陣。' }, { label: '實驗操作', minutes: 18, detail: '點滴板進行置換（Zn/Fe/Cu 對 HCl 及各鹽溶液），記錄現象。' }, { label: '數據整理', minutes: 10, detail: '以「＋/−」標反應，推導順序並寫離子方程式。' }, { label: '討論收結', minutes: 9, detail: '報告結果，討論差異原因，引入電化序，分類收集廢液。' } ], materials: ['鋅/鐵/銅片', '稀鹽酸及 ZnSO₄/FeSO₄/CuSO₄', '點滴板、滴管、鑷子', '護目鏡及手套', '觀察記錄表及廢液缸'] },
  { subjectId: 'chem', name: '操卷應試：有機化學 DSE 題型', style: '操卷', objectives: '1. 由反應類型辨識條件及主要產物\n2. 正確書寫有機方程式（結構簡式 + 條件）\n3. 分析常見陷阱並運用答題策略', phases: [ { label: '反應類型複習', minutes: 7, detail: '以反應卡快問快答（取代/加成/消去），診斷弱項。' }, { label: '限時作答', minutes: 18, detail: '完成 DSE 有機長題（烴類衍生物合成路線），標注條件。' }, { label: '自我批改', minutes: 7, detail: '對標準答案自批，注意條件寫法及結構式。' }, { label: '重點講解', minutes: 13, detail: '深講醇氧化產物、酯化條件及可逆性，各舉陷阱題。' }, { label: '錯題整理', minutes: 5, detail: '抄入錯題本，注錯誤類型及正確寫法。' } ], materials: ['DSE 化學 Paper 2 有機題', '反應類型舉卡', '標準答案投影片', '錯題本及分類貼紙', '有機反應思維圖'] },

  // ── 生物 bio ──
  { subjectId: 'bio', name: '細胞結構概念講授', style: '概念講授', objectives: '1. 能辨認並描述動植物細胞主要胞器及功能\n2. 能比較動植物細胞異同並以圖解正確呈現', phases: [ { label: '引入', minutes: 5, detail: '展示洋蔥表皮與口腔上皮顯微照片，提問觀察異同。' }, { label: '直接教學', minutes: 15, detail: '配動態圖解講解各胞器結構與功能，用功能類比助記。' }, { label: '配對練習', minutes: 10, detail: '完成胞器名稱與功能配對，糾正細胞壁/膜混淆。' }, { label: '比較圖繪製', minutes: 12, detail: '繪動物與植物細胞圖，以顏色區分，小組互核。' }, { label: '總結與鞏固', minutes: 8, detail: '以 Venn diagram 歸納異同，預告顯微鏡實驗。' } ], materials: ['細胞結構 PPT 圖解', '胞器配對工作紙', '彩色筆及繪圖格', '顯微鏡照片', 'Venn diagram 模板'] },
  { subjectId: 'bio', name: '光合作用實驗探究', style: '實驗探究', objectives: '1. 設計控制變因實驗驗證光照對光合速率影響\n2. 準確記錄數據並以曲線圖呈現及解釋', phases: [ { label: '提問與假設', minutes: 7, detail: '展示密封魚缸水草圖，引導提出假設並討論如何量速率（氣泡數）。' }, { label: '實驗設計討論', minutes: 8, detail: '以水蘊草置燈不同距離，控制水溫、CO₂，辨自/因/控變量。' }, { label: '實驗操作', minutes: 18, detail: '在 5/10/20/30cm 燈距記每分鐘氣泡數。' }, { label: '數據分析', minutes: 10, detail: '整合數據繪折線圖，解釋趨勢（含光飽和點）。' }, { label: '匯報與反思', minutes: 7, detail: '分享結果與誤差來源，連結農業應用。' } ], materials: ['水蘊草', '燒杯、台燈、捲尺', '碳酸氫鈉溶液', '計時器及記錄表', '坐標紙/試算表'] },
  { subjectId: 'bio', name: 'DSE 生物操卷精練', style: '操卷精練', objectives: '1. 識別並運用指令詞（describe、explain、suggest）符合評分\n2. 限時完成結構性問題並自評失分原因', phases: [ { label: '指令詞解析', minutes: 8, detail: '分析 describe/explain/compare/suggest 答題要求，配 marking scheme。' }, { label: '限時作答', minutes: 20, detail: '完成遺傳與生殖單元結構性題（Paper 1B）。' }, { label: '對照評分準則', minutes: 10, detail: '自批標失分點，留意關鍵術語（allele、phenotype）。' }, { label: '錯誤歸類討論', minutes: 8, detail: '統計共同失分，講高頻錯誤（meiosis/mitosis）。' }, { label: '即時修訂', minutes: 4, detail: '重答失分題，鞏固正確模式。' } ], materials: ['DSE Paper 1B 遺傳題', '官方評分準則', '指令詞解析講義', '紅筆', '錯誤歸類記錄表'] },

  // ── 中國文學 chlit ──
  { subjectId: 'chlit', name: '詩歌精讀賞析', style: '作品精讀', objectives: '1. 能分析詩歌意象、用典及手法並引原文闡釋\n2. 能感受詩人情感，以完整段落表述賞析', phases: [ { label: '背景導入', minutes: 6, detail: '簡介詩人生平背景，思考時代如何影響情感基調。' }, { label: '朗讀感知', minutes: 5, detail: '齊讀《靜夜思》《黃鶴樓送孟浩然之廣陵》，感受節奏。' }, { label: '字詞疏解', minutes: 8, detail: '疏解「煙花三月」「孤帆遠影」，板書意象象徵。' }, { label: '意象分析', minutes: 15, detail: '小組各領意象分析作用，完成分析卡並分享。' }, { label: '賞析段落寫作', minutes: 12, detail: '就「詩人如何以意象表達離情」寫 80 字賞析。' }, { label: '總結', minutes: 4, detail: '歸納共同手法，強調引用格式，預告比較賞析。' } ], materials: ['李白詩歌精選文本', '意象分析工作紙', '詩人生平講義', '意象網絡圖', '賞析段落範文'] },
  { subjectId: 'chlit', name: '古今詩人比較賞析', style: '比較賞析', objectives: '1. 能就相同主題比較不同朝代詩人手法與情感異同\n2. 能運用比較框架以有組織文字呈現論點', phases: [ { label: '主題聚焦', minutes: 5, detail: '展示「思鄉」圖像，引出比較杜甫〈月夜憶舍弟〉與余光中〈鄉愁〉。' }, { label: '分組細讀', minutes: 12, detail: 'A、B 組各讀一詩，完成「情感、意象、語言」三欄分析。' }, { label: '交叉分享', minutes: 10, detail: '代表介紹結果，共同建立比較框架（同/異）。' }, { label: '比較寫作', minutes: 15, detail: '寫比較賞析段（120 字），含「同」「異」並引原文。' }, { label: '同伴評改', minutes: 8, detail: '依量表互評，標可強化處，共同講評一篇。' } ], materials: ['杜甫及余光中詩文本', '三欄比較工作表', '比較賞析評改量表', '主題引入 PPT', '連接詞參考卡'] },
  { subjectId: 'chlit', name: '文學創作仿寫工作坊', style: '創作實踐', objectives: '1. 能模仿所學詩文形式特點進行創作\n2. 能就同學創作提出具體文學評語', phases: [ { label: '範本解構', minutes: 8, detail: '以洛夫〈邊界望鄉〉拆解「以具體承載抽象」技法。' }, { label: '意象腦震盪', minutes: 7, detail: '列「記憶/等待」相關五個具體意象，避免陳套。' }, { label: '創作草稿', minutes: 15, detail: '仿寫自由詩（8-12 行），至少用一種手法。' }, { label: '朗讀分享', minutes: 10, detail: '朗讀作品，以「我注意到/我感受到」回應。' }, { label: '修訂與反思', minutes: 10, detail: '據回饋修訂，寫創作說明。' } ], materials: ['洛夫〈邊界望鄉〉講義', '意象腦震盪工作紙', '創作稿紙', '藝術手法參考卡', '同伴回應句式卡'] },

  // ── 英語文學 englit ──
  { subjectId: 'englit', name: 'Shakespeare Close Reading', style: 'Close Reading', objectives: '1. Students can analyse the effect of literary devices in a Shakespearean passage\n2. Students can write a close reading paragraph using Point-Evidence-Analysis with accurate quotation', phases: [ { label: 'First Impressions', minutes: 6, detail: 'Read aloud the Hamlet soliloquy without context; students note tone words.' }, { label: 'Guided Annotation', minutes: 12, detail: 'Annotate the extract; model annotation of the extended metaphor of fortune.' }, { label: 'Device Analysis', minutes: 12, detail: 'In groups, trace one device through the passage on an analysis grid.' }, { label: 'Paragraph Writing', minutes: 15, detail: 'Write a close reading paragraph on Hamlet’s conflict with 2 embedded quotations.' }, { label: 'Peer Review', minutes: 5, detail: 'Colour-coded checklist (analysis / explanation / summary); read a strong example.' } ], materials: ['Hamlet Act III soliloquy extract', 'Literary devices analysis grid', 'P-E-A paragraph checklist', 'Model annotation (visualiser)', 'Peer review guide'] },
  { subjectId: 'englit', name: 'Themes, Context & Authorial Intent', style: 'Themes & Context', objectives: '1. Students can connect themes to historical/social context and authorial choices\n2. Students can evaluate how critical lenses illuminate interpretation', phases: [ { label: 'Context Carousel', minutes: 8, detail: 'Rotate four stations on The Great Gatsby context; record one fact each.' }, { label: 'Theme Mapping', minutes: 10, detail: 'Build a theme web citing textual moments (green light, Valley of Ashes).' }, { label: 'Critical Lens Jigsaw', minutes: 15, detail: 'Groups read via a lens, present readings of Daisy’s characterisation.' }, { label: 'Directed Writing', minutes: 12, detail: 'Write a 150-word response integrating context, a lens and textual evidence.' }, { label: 'Exit Ticket', minutes: 5, detail: 'One insight + one question on context shaping theme.' } ], materials: ['The Great Gatsby set text', 'Context carousel station cards', 'Critical lens cards', 'Theme web template', 'Exit ticket slips'] },
  { subjectId: 'englit', name: 'DSE Essay Writing Workshop', style: 'Essay Writing', objectives: '1. Students can structure a literary essay with thesis, argument and evaluative conclusion\n2. Students can self-assess drafts against DSE criteria and target revisions', phases: [ { label: 'Unpacking the Question', minutes: 7, detail: 'Underline key terms of an Of Mice and Men question; brainstorm thesis angles.' }, { label: 'Outline Planning', minutes: 8, detail: 'Build a timed outline (thesis + 3 topic sentences + conclusion).' }, { label: 'Timed Draft', minutes: 20, detail: 'Write a 500–600 word essay under exam conditions.' }, { label: 'Self-Assessment', minutes: 10, detail: 'Annotate draft with rubric codes (thesis/evidence/analysis/coherence).' }, { label: 'Targeted Improvement', minutes: 5, detail: 'Rewrite the weakest analysis sentence to deepen interpretation.' } ], materials: ['Of Mice and Men set text', 'Essay question handout', 'Essay outline template', 'DSE marking rubric', 'Self-assessment code card'] },

  // ── 中國歷史 chist ──
  { subjectId: 'chist', name: '隋唐政制史事講授', style: '史事講授', objectives: '1. 能描述三省六部制架構及運作並解釋對皇權影響\n2. 能以時序梳理科舉演變並分析對士族政治衝擊', phases: [ { label: '承前提問', minutes: 5, detail: '複習魏晉門閥政治，思考皇帝如何制衡世族。' }, { label: '三省六部圖解', minutes: 15, detail: '板書架構圖（中書擬詔→門下審駁→尚書執行），輔魏徵駁詔例。' }, { label: '科舉時序整理', minutes: 10, detail: '在時間軸填隋創立、唐擴科、武則天武舉等節點。' }, { label: '影響分析討論', minutes: 12, detail: '小組就「科舉如何動搖士族壟斷」分政治/社會/文化三層。' }, { label: '板書歸納', minutes: 8, detail: '整理「制度→目的→影響」提綱，學生補一句最重要影響。' } ], materials: ['三省六部架構圖（填充）', '科舉演變時間軸', '隋唐政治章節', '魏徵駁詔史料（白話）', '板書提綱框架'] },
  { subjectId: 'chist', name: '鴉片戰爭史料研習', style: '史料研習', objectives: '1. 能辨析不同立場史料嘅價值與局限\n2. 能運用多則史料印證或修正詮釋並指出矛盾', phases: [ { label: '背景激活', minutes: 6, detail: '時間軸複習 1839–1842 主要事件。' }, { label: '史料初讀', minutes: 8, detail: 'A 組林則徐致英女王信、B 組巴麥尊訓令，標作者/目的/立場。' }, { label: '史料價值分析', minutes: 12, detail: '完成史料分析卡（性質/立場/可信度/偏頗）。' }, { label: '跨組對讀', minutes: 10, detail: '交換史料，尋戰爭起因詮釋上的矛盾。' }, { label: '短答作答', minutes: 10, detail: '答「鴉片戰爭主因」，引兩份史料並反思局限。' }, { label: '點評反思', minutes: 4, detail: '點評「史料說=真相」嘅錯誤邏輯。' } ], materials: ['林則徐致英女王信節錄', '巴麥尊訓令節錄（中譯）', '史料分析卡', '事件時間軸卡', '史料引用格式卡'] },
  { subjectId: 'chist', name: 'DSE 中史論述操卷', style: '論述操卷', objectives: '1. 能構建具史觀立場論點並以史實支持\n2. 能限時完成結構完整論述並運用同意/不完全同意格式', phases: [ { label: '審題技巧', minutes: 8, detail: '分析「你是否同意…試加以論述」格式，示範審題。' }, { label: '論點架構規劃', minutes: 7, detail: '就唐太宗統治題規劃架構（表態→論點→補充→總結）。' }, { label: '限時論述寫作', minutes: 22, detail: '限時作答（600–800 字），引具體史實。' }, { label: '對照評改準則', minutes: 8, detail: '解說「史觀層次/史實/邏輯」三項，自評失分。' }, { label: '重點糾錯', minutes: 5, detail: '展示高分段落，對比論述與記述差異。' } ], materials: ['DSE 中史論述題（唐代）', '論述架構工作紙', '官方評分準則', '高分示範節錄', '論述句式參考卡'] },

  // ── 歷史 hist ──
  { subjectId: 'hist', name: '第一次世界大戰爆發原因講授', style: '史事講授', objectives: '1. 能列舉並解釋一戰直接與間接原因（民族主義、帝國主義、軍備、結盟）\n2. 能用因果分析薩拉熱窩事件如何觸發全面戰爭', phases: [ { label: '引入', minutes: 5, detail: '展示 1914 歐洲結盟地圖，觀察兩大陣營分佈。' }, { label: '直接原因講解', minutes: 10, detail: '講薩拉熱窩刺殺時序，配時間軸說明 7 月危機連鎖宣戰。' }, { label: '間接原因分析', minutes: 15, detail: '以 MAIN 框架逐一講解，引英德海軍競賽數據佐證。' }, { label: '因果層次練習', minutes: 12, detail: '將史料卡按「遠因/近因/導火線」分類並解釋。' }, { label: '總結', minutes: 8, detail: '示範將分析轉為論點句「…是主因，因為…」。' } ], materials: ['歐洲結盟地圖（1914）', '7 月危機時間軸工作紙', '史料卡片組', 'MAIN 框架板書', '論點句型示例'] },
  { subjectId: 'hist', name: '凡爾賽條約史料研習', style: '史料研習', objectives: '1. 能從一手二手史料提取信息並評估來源、目的、局限\n2. 能就條約對德國影響援引史料構建論點', phases: [ { label: '史料導入', minutes: 7, detail: '分發《十四點》、報章社論、德國抗議、第 231 條原文，標立場。' }, { label: '解讀示範', minutes: 10, detail: '以 OPVL 法示範分析第 231 條「戰爭罪責」字眼。' }, { label: '小組研習', minutes: 18, detail: '各負責一史料完成 OPVL 分析並找矛盾或互補。' }, { label: '交叉驗證', minutes: 10, detail: '討論德國反應與英國報章描述差異，何者更可信。' }, { label: '論點寫作', minutes: 8, detail: '寫史料題答案，引兩史料支持/反駁「凡爾賽是公正和平」。' } ], materials: ['史料套（4 份，中英對照）', 'OPVL 分析工作紙', '凡爾賽領土地圖', '史料題答題框架卡', 'DSE 評分準則節錄'] },
  { subjectId: 'hist', name: '冷戰論述操卷訓練', style: '論述操卷', objectives: '1. 能限時組織多角度論點就冷戰起源撰論述文\n2. 能自評論述結構並改善立場、論據、結語', phases: [ { label: '題目分析', minutes: 5, detail: '拆解「美國應為冷戰負最大責任，你是否同意？」' }, { label: '論點構圖', minutes: 8, detail: '列同意（杜魯門主義、馬歇爾計劃）與不同意（蘇聯擴張）論據。' }, { label: '限時寫作', minutes: 25, detail: '模擬考試撰完整論述文（立場+正反論點+結語）。' }, { label: '同儕評改', minutes: 10, detail: '按準則互評並給改善建議。' }, { label: '教師點評', minutes: 5, detail: '投影典型答案，指出立場搖擺/史實錯等失分。' } ], materials: ['DSE 論述題庫（冷戰）', '論點思維導圖工作紙', '評分準則對照表', '高/低分答案範例', '冷戰大事年表'] },

  // ── 地理 geog ──
  { subjectId: 'geog', name: '季風氣候成因概念講授', style: '概念講授', objectives: '1. 能解釋亞洲季風成因（海陸熱力差異、氣壓梯度、科氏力）\n2. 能讀氣候圖辨季風特徵並與其他氣候比較', phases: [ { label: '引入', minutes: 6, detail: '展示香港與孟買氣候圖，指出降雨規律引出季風。' }, { label: '成因講解', minutes: 15, detail: '配動態氣壓圖解釋夏冬氣流方向，用地球儀示範科氏力。' }, { label: '氣候圖分析', minutes: 12, detail: '分析三城市氣候圖，填特徵表辨降雨高峰與季風對應。' }, { label: '比較討論', minutes: 10, detail: '對比季風氣候與地中海型降雨分佈。' }, { label: '總結評估', minutes: 8, detail: '出口卡：畫夏季季風風向並說明成因。' } ], materials: ['亞洲氣壓動態圖', '三城市氣候圖工作紙', '氣候類型比較表', '地球儀', '出口卡'] },
  { subjectId: 'geog', name: '本地河流地貌野外考察', style: '野外考察', objectives: '1. 能實地運用地形圖及工具記錄河道剖面、流速、粒徑\n2. 能據數據分析上中下游差異並聯繫侵蝕搬運沉積', phases: [ { label: '考察前準備', minutes: 8, detail: '室內簡介地形圖、三測量站、流速計用法，分配任務。' }, { label: '上游站數據', minutes: 12, detail: '量河道寬度、水深、流速，採礫石量粒徑，繪 V 形谷剖面。' }, { label: '下游站數據', minutes: 12, detail: '重複測量，觀沉積物粒徑變化、彎曲度、洪泛平原。' }, { label: '數據整理', minutes: 10, detail: '繪上下游剖面比較圖及粒徑柱狀圖，提地貌假設。' }, { label: '考察後討論', minutes: 10, detail: '對比兩站，解釋流速與侵蝕力，寫考察結論。' } ], materials: ['考察地形圖（1:5000）', '流速計及測量繩', '游標卡尺', '野外記錄工作紙', '防水手套及安全背心'] },
  { subjectId: 'geog', name: '人口結構數據圖表分析', style: '數據圖表分析', objectives: '1. 能解讀人口金字塔、轉型模型、年齡中位數圖提取趨勢\n2. 能用人口轉型理論分析香港老化成因並評估影響', phases: [ { label: '圖表導入', minutes: 7, detail: '展示 1981 與 2021 人口金字塔，描述形狀變化。' }, { label: '圖表技巧', minutes: 8, detail: '示範由金字塔讀撫養比、老化指數並轉化為比較陳述。' }, { label: '數據分析練習', minutes: 15, detail: '分析轉型模型、出生死亡率折線、中位數趨勢三圖。' }, { label: '影響評估', minutes: 12, detail: '討論老化對勞動力、強積金、醫療開支影響，引政府數據。' }, { label: '答題技巧', minutes: 8, detail: '示範「描述趨勢→解釋成因→評估影響」整合作答。' } ], materials: ['人口金字塔對比', '人口轉型模型圖', '統計處數據工作紙', '答題框架', 'DSE 人口題範例'] },

  // ── 倫理與宗教 ers ──
  { subjectId: 'ers', name: '功利主義與安樂死倫理探討', style: '倫理議題探討', objectives: '1. 能用功利主義及義務論分析安樂死爭議辨核心分歧\n2. 能就「主動安樂死應否合法化」表立場並回應反方', phases: [ { label: '案例導入', minutes: 7, detail: '播比利時安樂死合法化新聞，記初步反應。' }, { label: '理論框架講解', minutes: 10, detail: '講邊沁功利主義與康德義務論如何處理安樂死，板書對比。' }, { label: '立場辯論準備', minutes: 10, detail: '支持/反對組以指定理論找論據，引荷蘭、加拿大案例。' }, { label: '結構性辯論', minutes: 15, detail: '「哲學椅」模式輪流陳述並回應，引導用倫理概念語言。' }, { label: '反思總結', minutes: 8, detail: '重審立場，寫反思說明哪種理論更具說服力。' } ], materials: ['安樂死新聞報導', '功利vs義務論對比表', '各國立法案例卡', '哲學椅辯論規則', '反思工作紙'] },
  { subjectId: 'ers', name: '《約伯記》宗教文本研讀', style: '宗教文本研讀', objectives: '1. 能從《約伯記》節錄提取苦難神學核心主張並以文本解釋立場\n2. 能比較猶太苦難觀與佛教業報觀對「無辜受苦」嘅回應', phases: [ { label: '文本導入', minutes: 8, detail: '分發節錄，標約伯、以利法、上帝各持立場。' }, { label: '逐段分析', minutes: 15, detail: '精讀以利法罪責論、約伯申訴、上帝旋風答覆三段。' }, { label: '跨宗教比較', minutes: 12, detail: '介紹佛教業報與《法句經》，填比較表。' }, { label: '詮釋討論', minutes: 10, detail: '討論旋風答覆是解釋還是迴避，區分宗教詮釋與倫理評價。' }, { label: '書面回應', minutes: 8, detail: '寫短文：若你是約伯朋友會用哪種神學立場安慰他。' } ], materials: ['《約伯記》節錄工作紙', '《法句經》苦難節錄', '宗教苦難觀比較表', '神學立場分析圖', '詮釋題答題指引'] },
  { subjectId: 'ers', name: '器官移植優先分配個案討論', style: '個案討論', objectives: '1. 能識別器官分配涉及嘅道德原則並分析衝突\n2. 能就個案提出有倫理根據建議並評估對持份者影響', phases: [ { label: '個案呈現', minutes: 7, detail: '派發三名等候移植病人個案，腎臟只得一個如何決定。' }, { label: '倫理原則介紹', minutes: 8, detail: '講四大生命倫理原則（自主/善行/不傷害/公正）。' }, { label: '小組個案分析', minutes: 15, detail: '各代表一倫理立場分析應優先給誰，填分析框架。' }, { label: '跨組協商', minutes: 12, detail: '組「倫理委員會」模擬協商並說理由。' }, { label: '反思評估', minutes: 8, detail: '講醫管局實際分配準則，比較現實與小組決策。' } ], materials: ['器官分配個案工作紙', '四大倫理原則卡', '倫理分析框架工作紙', '香港移植分配準則節錄', '倫理委員會角色卡'] },

  // ── 旅遊與款待 ths ──
  { subjectId: 'ths', name: '香港酒店業發展概念講授', style: '概念講授', objectives: '1. 能說明香港酒店業分類及趨勢並引數據\n2. 能分析入境旅遊推拉因素並解釋對經濟貢獻及挑戰', phases: [ { label: '數據引入', minutes: 6, detail: '展示入境旅客統計圖，問為何內地旅客佔比最高。' }, { label: '酒店分類講解', minutes: 12, detail: '介紹星級制度及三大類別，配本港案例分析客群與定價。' }, { label: '推拉因素分析', minutes: 12, detail: '建構推拉因素表（推力、拉力），引問卷數據佐證。' }, { label: '行業挑戰討論', minutes: 12, detail: '討論面對新加坡、東京、Airbnb 衝擊應如何定位。' }, { label: '總結', minutes: 8, detail: '歸納 SWOT 框架，學生指出最重要發展機遇。' } ], materials: ['旅發局統計年報節錄', '酒店分類案例幻燈片', '推拉因素工作紙', 'SWOT 概念圖', 'DSE 過往相關題'] },
  { subjectId: 'ths', name: '餐飲服務技巧實作培訓', style: '服務技巧實作', objectives: '1. 能示範中西餐服務基本技巧（擺位、上菜次序、餐具）\n2. 能在模擬情境應用服務語言並處理投訴及特殊需求', phases: [ { label: '理論簡介', minutes: 7, detail: '講中西餐服務差異與正式宴會擺位規範。' }, { label: '教師示範', minutes: 10, detail: '示範完整西式服務流程，邊做邊講服務語言。' }, { label: '學生分組實作', minutes: 18, detail: '扮服務員/領班/顧客，輪流實踐並互評儀態、語言、技術。' }, { label: '投訴處理情景劇', minutes: 10, detail: '以 LEAST 法則處理三個投訴情景。' }, { label: '點評回饋', minutes: 7, detail: '點評表現，播國際酒店培訓片對比。' } ], materials: ['模擬餐桌擺位套裝', '西式服務流程圖', '投訴處理情景卡', '服務評核量表', '酒店服務示範影片'] },
  { subjectId: 'ths', name: '生態旅遊可持續發展個案', style: '個案研習', objectives: '1. 能用可持續旅遊三維度分析個案利弊\n2. 能就旅遊與環保矛盾提出政策建議並評估持份者立場', phases: [ { label: '個案導入', minutes: 7, detail: '分發馬爾代夫旅遊個案（旅客增長圖、珊瑚白化數據）。' }, { label: '框架講解', minutes: 8, detail: '介紹三維度框架及 UNWTO 定義，以 Costa Rica 案例說明。' }, { label: '持份者分析', minutes: 12, detail: '各代表一持份者分析利益與訴求。' }, { label: '政策諮詢模擬', minutes: 15, detail: '模擬諮詢會議陳述立場，討論配額、生態稅等措施。' }, { label: '個案報告', minutes: 10, detail: '寫結論識別最關鍵挑戰並提政策建議引數據。' } ], materials: ['馬爾代夫個案資料包', '三維度分析框架', '持份者立場卡', 'Costa Rica 案例簡介', '報告寫作框架'] },

  // ── 資訊及通訊科技 ict ──
  { subjectId: 'ict', name: '網絡安全概念講授', style: '概念講授', objectives: '1. 能識別常見網絡攻擊類型並解釋運作\n2. 能說明對稱與非對稱加密概念及應用\n3. 能評估個人網絡行為風險並提改善', phases: [ { label: '引入', minutes: 7, detail: '播網絡詐騙新聞，分析受害者安全錯誤。' }, { label: '直接講授', minutes: 15, detail: '講常見攻擊（DDoS、SQL 注入、釣魚）配封包示意圖。' }, { label: '加密示範', minutes: 12, detail: '演示凱撒密碼與 RSA 概念，用簡化數字體驗對稱/非對稱。' }, { label: '小組討論', minutes: 10, detail: '分析三真實案例識別漏洞及防護方案。' }, { label: '總結評估', minutes: 8, detail: '完成風險評估工作紙，評自身三個服務安全等級。' } ], materials: ['網絡攻擊新聞影片', '加密算法投影片', '風險評估工作紙', 'OSI 模型參考卡', '釣魚郵件樣本'] },
  { subjectId: 'ict', name: 'Python 數據處理實作', style: '程式實作', objectives: '1. 能用 csv 模組讀取數據並作基本統計\n2. 能用條件及迴圈篩選數據並輸出報告\n3. 能識別並修正邏輯錯誤', phases: [ { label: '熱身回顧', minutes: 5, detail: '複習列表與字典語法，完成三道填充題。' }, { label: '任務說明', minutes: 8, detail: '發圖書館借閱 CSV，任務：統計各類借閱次數找最受歡迎三本。' }, { label: '引導式編程', minutes: 15, detail: '示範 csv.reader 讀取、字典累加，學生同步輸入運行。' }, { label: '獨立延伸', minutes: 15, detail: '完成 sorted 排序及格式化打印，較快者寫入新 CSV。' }, { label: '調試分享', minutes: 8, detail: '抽兩位學生展示，共同找索引越界等錯誤。' } ], materials: ['借閱數據 CSV', 'Thonny IDE', 'Python 語法參考卡', '任務說明工作紙', '延伸挑戰題卡'] },
  { subjectId: 'ict', name: '數據庫設計專題研習', style: '專題研習', objectives: '1. 能識別實體屬性繪第三正規化 ER 圖\n2. 能用 SQL（SELECT、JOIN、GROUP BY）查詢關聯數據庫\n3. 能協作撰報告評估設計優劣', phases: [ { label: '情境引入', minutes: 7, detail: '介紹「小型診所系統」，展示 Excel 數據冗餘問題。' }, { label: 'ER 圖設計', minutes: 12, detail: '小組繪病人/醫生/預約/藥物 ER 圖，標主鍵外鍵關係。' }, { label: 'SQL 建表匯入', minutes: 12, detail: '在 DB Browser 建表並執行 INSERT 驗證完整性。' }, { label: 'SQL 查詢任務', minutes: 15, detail: '完成五道查詢（最多預約醫生、有過敏病人），用 JOIN/GROUP BY。' }, { label: '組際評鑑', minutes: 6, detail: '互換 ER 圖以評核表評正規化、鍵、查詢效率。' } ], materials: ['診所情境說明書', 'ER 圖工作紙', 'DB Browser for SQLite', 'SQL 語法速查表', '數據表評核表'] },

  // ── 設計與應用科技 dat ──
  { subjectId: 'dat', name: '設計流程概念與頭腦風暴', style: '設計流程', objectives: '1. 能運用設計循環分析問題並訂設計規格\n2. 能以思維導圖及草圖呈現多元創意，提至少三方案\n3. 能依規格評估方案優劣選最佳概念', phases: [ { label: '設計問題分析', minutes: 8, detail: '呈現「為視障人士設計輔助工具」，以 5W1H 分析需求。' }, { label: '訂立規格', minutes: 10, detail: '討論功能、物料、人體工學、美學，建量化規格表。' }, { label: '頭腦風暴', minutes: 12, detail: '6 分鐘無批判草圖速繪（至少 8 縮圖），Round Robin 分享。' }, { label: '概念發展', minutes: 12, detail: '選三概念詳細草圖，說明物料及工藝。' }, { label: '概念評選', minutes: 10, detail: '用設計矩陣按功能/可行/創新/成本評分選最優。' } ], materials: ['設計挑戰說明卡', '問題定義工作紙', 'A3 草圖紙', '設計矩陣評估表', '物料樣本展示箱'] },
  { subjectId: 'dat', name: '木工榫接結構製作', style: '動手製作', objectives: '1. 能安全使用線鋸、木工鑿製作誤差 ≤1mm 嘅榫頭榫眼\n2. 能理解木材順橫紋對強度影響並適當選材\n3. 能按流程圖完成榫接木盒主體', phases: [ { label: '安全簡報', minutes: 6, detail: '示範護目鏡、線鋸推拉、鑿刀方向，簽安全承諾卡。' }, { label: '工具示範', minutes: 10, detail: '示範標線器劃榫線、線鋸切割、鑿刀清理榫眼。' }, { label: '個人製作', minutes: 25, detail: '切割四塊側板，配對榫頭榫眼，砂紙打磨。' }, { label: '試配合調整', minutes: 8, detail: '乾配合檢查鬆緊，微調並記錄偏差。' }, { label: '反思清潔', minutes: 5, detail: '寫製作日誌，清潔工作台歸還工具。' } ], materials: ['松木板材', '線鋸、木工鑿套裝', '標線器及鋼尺', '砂紙（120/240 號）', '製作流程圖及安全承諾卡'] },
  { subjectId: 'dat', name: '產品設計評鑑與改良', style: '評鑑反思', objectives: '1. 能用功能/人體工學/美學/可持續四維度評鑑產品\n2. 能識別缺陷提改良方案並以標注草圖呈現\n3. 能用專業詞彙撰評鑑報告段落', phases: [ { label: '評鑑框架引入', minutes: 8, detail: '介紹四維度框架，以廚刀現場示範評鑑。' }, { label: '產品實物分析', minutes: 15, detail: '各組獲日用品，量測並記錄重量尺寸物料表面處理。' }, { label: '用家測試模擬', minutes: 10, detail: '輪流扮不同用家測試人體工學，記錄不適。' }, { label: '改良方案設計', minutes: 12, detail: '針對最重要缺陷繪改良草圖，標物料及效果。' }, { label: '分享評議', minutes: 8, detail: '展示原品與改良草圖，以「正面+建議」提問。' } ], materials: ['日用品實物', '評鑑工作紙（四維度）', '量尺及電子磅', 'A4 草圖紙', '彩色筆及標籤紙'] },

  // ── 健康管理與社會關懷 hmsc ──
  { subjectId: 'hmsc', name: '長期病患照顧概念講授', style: '概念講授', objectives: '1. 能解釋常見慢性病成因、症狀及生活影響\n2. 能說明社區照顧服務功能及申請條件\n3. 能分析長期病患生理心理社交需要提整全計劃', phases: [ { label: '引入', minutes: 7, detail: '播糖尿病患者生活紀錄片，寫下印象最深困難。' }, { label: '概念講解', minutes: 15, detail: '以整全健康模式講慢性病機制及心理壓力，配流行病學數據。' }, { label: '社區資源介紹', minutes: 10, detail: '展示服務架構圖，填服務對應需要配對表。' }, { label: '照顧計劃討論', minutes: 12, detail: '為指定個案制訂計劃（醫療、飲食、心理、社交）。' }, { label: '問答鞏固', minutes: 8, detail: '以 Kahoot 10 題鞏固，針對高錯題補講。' } ], materials: ['糖尿病患者紀錄片', '整全健康模式投影片', '社區照顧服務架構圖', '照顧計劃工作紙', 'Kahoot 問答'] },
  { subjectId: 'hmsc', name: '青少年精神健康個案研習', style: '個案研習', objectives: '1. 能識別青少年精神健康警示訊號及求助途徑\n2. 能以生態系統理論分析保護與風險因素\n3. 能評估不同介入方案適用性', phases: [ { label: '個案呈現', minutes: 8, detail: '發「阿明個案」，標警示訊號。' }, { label: '生態系統分析', minutes: 12, detail: '繪生態系統圖標各層次風險與保護因素。' }, { label: '介入方案比較', minutes: 12, detail: '簡介認知行為、正念、輔導、家庭治療優勢限制。' }, { label: '小組建議', minutes: 10, detail: '制訂優先方案，說選擇理由及專業人員角色。' }, { label: '倡議反思', minutes: 8, detail: '討論學校可做甚麼，反思精神健康污名化。' } ], materials: ['阿明個案文本', '生態系統圖工作紙（A3）', '介入方案比較表', '精神健康服務資源手冊', '彩色筆及便利貼'] },
  { subjectId: 'hmsc', name: '長者溝通技巧角色扮演', style: '角色扮演', objectives: '1. 能示範與認知障礙症長者溝通技巧\n2. 能在模擬場景識別無效溝通並即時調整\n3. 能反思個人溝通風格並聯繫照顧倫理', phases: [ { label: '技巧輸入', minutes: 8, detail: '以短片對比有效/無效溝通，歸納五項原則。' }, { label: '角色準備', minutes: 7, detail: '抽角色卡（照顧者/不同程度長者），準備策略。' }, { label: '第一輪扮演', minutes: 12, detail: '演「協助服藥被拒」，觀察員記錄語言/非語言行為。' }, { label: '即時反饋調整', minutes: 8, detail: '分享觀察，調整後演第二輪（長者情緒激動）。' }, { label: '全班解說', minutes: 12, detail: '展示兩組，聯繫照顧倫理，寫反思日誌。' } ], materials: ['角色卡及場景說明', '溝通觀察表', '對比溝通短片', '反思日誌工作紙', '認知障礙症知識卡'] },

  // ── 科技與生活 tl ──
  { subjectId: 'tl', name: '食品營養標籤解讀與分析', style: '概念講授', objectives: '1. 能解讀營養標籤計算每日建議攝取量百分比\n2. 能識別加工過程影響營養素流失因素\n3. 能據不同人群需要評估食品適合性', phases: [ { label: '引入', minutes: 7, detail: '展示兩款「健康聲稱」零食，揭示標籤數據差異。' }, { label: '標籤解讀教學', minutes: 12, detail: '講七項必標營養素，示範計算「佔每日所需百分比」。' }, { label: '實物分析活動', minutes: 15, detail: '比較 5 款食品鈉、糖、飽和脂肪並排健康程度。' }, { label: '人群需要配對', minutes: 10, detail: '為孕婦、發育男生、高血壓長者選最適合早餐。' }, { label: '總結', minutes: 8, detail: '寫「致家長的健康飲食建議」短文。' } ], materials: ['各款食品包裝（5 款/組）', '食品標籤法規摘要', '營養計算工作紙', '每日建議攝取量表', '建議短文工作紙'] },
  { subjectId: 'tl', name: '紡織纖維鑑別實作', style: '纖維探究', objectives: '1. 能用燃燒、顯微鏡、觸感鑑別棉、羊毛、聚酯、尼龍\n2. 能據纖維特性為不同用途推薦物料\n3. 能理解快速時裝影響提可持續消費建議', phases: [ { label: '特性講解', minutes: 8, detail: '對比天然與合成纖維結構性能，填特性比較表。' }, { label: '安全示範', minutes: 5, detail: '示範燃燒測試安全程序（鑷子夾、遠離易燃、聞氣味）。' }, { label: '燃燒鑑別', minutes: 15, detail: '燃燒五款樣本，觀速度、火焰、氣味、灰燼鑑別。' }, { label: '顯微鏡觀察', minutes: 12, detail: '100 倍觀棉（扭曲帶狀）羊毛（鱗片），繪素描。' }, { label: '選材與可持續討論', minutes: 12, detail: '為夏季運動服推薦纖維，討論快速時裝環境代價。' } ], materials: ['五款纖維樣本', '燃燒測試工具組', '光學顯微鏡', '纖維特性工作紙', '可持續時裝資料卡'] },
  { subjectId: 'tl', name: '家居食品安全實作', style: '食品實作', objectives: '1. 能解釋食物中毒成因並識別高風險食品及危險溫度區\n2. 能示範交叉污染預防及食物儲存方法\n3. 能為家庭設計廚房衛生管理方案', phases: [ { label: '案例分析', minutes: 8, detail: '呈現本港食物中毒數據，分類三宗個案成因。' }, { label: '危險溫度區教學', minutes: 8, detail: '以溫度計測雪櫃、室溫、沸水，講 4°C/60°C 原則。' }, { label: '交叉污染實作', minutes: 15, detail: '操作六色刀具砧板分類及七步洗手，找模擬廚房隱患。' }, { label: '食物儲存實習', minutes: 12, detail: '按 FIFO 原則正確放置食材入模擬雪櫃層架。' }, { label: '家庭方案設計', minutes: 9, detail: '為三人家庭設計一頁「廚房衛生管理備忘錄」。' } ], materials: ['六色刀具砧板套裝', '食物溫度計', '廚房隱患場景圖', '食材模型/實物', '家庭衛生管理工作紙'] },

  // ── 科學（綜合/組合）sci ──
  { subjectId: 'sci', name: '探究浮力：阿基米德原理實驗', style: '探究實驗', objectives: '1. 透過實驗測排水量與浮力歸納阿基米德原理\n2. 識別自變/應變/控制變量並記錄數據撰報告', phases: [ { label: '引入情境', minutes: 5, detail: '展示鋼船漂浮與鐵球下沉對比，問「同樣係鐵點解唔同？」' }, { label: '假設與設計', minutes: 8, detail: '討論提假設，確定自變（體積）、應變（浮力）、控制變量。' }, { label: '實驗操作', minutes: 18, detail: '用彈簧秤、量筒測空氣中與水中重力差，讀排水體積。' }, { label: '數據分析', minutes: 10, detail: '繪浮力與排水重力散點圖，歸納原理討論誤差。' }, { label: '總結延伸', minutes: 9, detail: '用原理解釋潛水艇浮沉，預告密度。' } ], materials: ['彈簧秤（0–5N）', '量筒（100mL）', '水槽與溢水杯', '金屬塊與木塊', '數據記錄工作紙'] },
  { subjectId: 'sci', name: '細胞的結構與功能：概念講授', style: '概念講授', objectives: '1. 辨別動植物細胞結構異同並解釋細胞器功能\n2. 運用顯微鏡觀察洋蔥表皮並與圖示對應', phases: [ { label: '複習引入', minutes: 5, detail: '複習生物體層次，展示細胞放大圖提問共同點。' }, { label: '直接教學：動物細胞', minutes: 10, detail: '逐一呈現細胞核、膜、粒線體等，配功能類比。' }, { label: '直接教學：植物細胞', minutes: 8, detail: '對比講細胞壁、液泡、葉綠體，以「植物有三多」助記。' }, { label: '顯微鏡觀察', minutes: 15, detail: '觀洋蔥表皮染色切片，繪圖標結構與課本對比。' }, { label: '鞏固評估', minutes: 12, detail: '以 Mentimeter 問答評估，針對錯誤補講。' } ], materials: ['互動白板及細胞 PPT', '顯微鏡（每組一台）', '洋蔥表皮碘液切片', '細胞結構工作紙', 'Mentimeter 平台'] },
  { subjectId: 'sci', name: '橋樑結構 STEM 工程挑戰', style: 'STEM專題', objectives: '1. 應用三角形穩定原理設計最大負重橋樑\n2. 透過工程設計循環培養解難及協作', phases: [ { label: '挑戰簡介', minutes: 6, detail: '宣布規則：限定材料 30cm 跨度橋承最大重量。' }, { label: '研究與設計', minutes: 10, detail: '瀏覽橋樑資料卡，討論三角形抗壓，繪草圖算材料。' }, { label: '建造橋樑', minutes: 15, detail: '用冰棒棍與熱熔膠建造，提醒安全用膠槍。' }, { label: '測試記錄', minutes: 10, detail: '逐組放重錘每次 +100g，記承重與破壞位置。' }, { label: '反思改良', minutes: 9, detail: '對比最大最小承重結構差異，提書面改良。' } ], materials: ['冰棒棍（每組 50 根）', '熱熔膠槍與膠棒', '橋樑結構資料卡', '重錘組（100g×20）', '設計圖工作紙及量尺'] },

  // ── 體育 pe ──
  { subjectId: 'pe', name: '籃球運球上籃技術教學', style: '技能教學', objectives: '1. 正確示範低運球及行進間上籃兩步步法\n2. 在移動對抗中提升控球穩定與上籃成功率', phases: [ { label: '熱身活動', minutes: 8, detail: '慢跑後動態伸展，徒手模擬運球激活手腕膝關節。' }, { label: '技術示範講解', minutes: 7, detail: '示範低運球要領及上籃兩步步法，學生模仿站立動作。' }, { label: '分站練習', minutes: 15, detail: '三站循環：定點運球、無球步法、慢速上籃，逐站糾正。' }, { label: '結合練習', minutes: 13, detail: '半場「運球→變向→上籃」，限時三次，同伴觀察回饋。' }, { label: '放鬆小結', minutes: 7, detail: '靜態伸展，點評常見錯誤，預告防守。' } ], materials: ['籃球（每人一個）', '三色標誌筒', '技術觀察評分工作紙', '示範短片（iPad）', '哨子與計時器'] },
  { subjectId: 'pe', name: '體能循環訓練：核心與心肺', style: '體適能訓練', objectives: '1. 完成六站循環達心率 70–80% 有氧效果\n2. 正確執行平板支撐、深蹲等核心動作達標率 80%+', phases: [ { label: '熱身跑與動態操', minutes: 8, detail: '慢跑一圈後動態操（開合跳、高抬腿、臀繞環）。' }, { label: '動作示範講解', minutes: 7, detail: '示範六站動作，講平板腰背挺直、深蹲膝不超腳尖。' }, { label: '循環訓練（第一輪）', minutes: 12, detail: '每站 40 秒工作 20 秒休息，巡視糾正核心收緊。' }, { label: '循環訓練（第二輪）', minutes: 12, detail: '休息 90 秒後第二輪，自測心率，對比 RPE。' }, { label: '緩和放鬆', minutes: 11, detail: '靜態拉伸，講運動後拉伸作用，建議強度調整。' } ], materials: ['運動墊（每人一張）', '分站標誌牌（六站）', '計時音樂播放器', 'RPE 疲勞量表', '哨子與秒錶'] },
  { subjectId: 'pe', name: '排球：接發球戰術與比賽應用', style: '比賽戰術', objectives: '1. 分析 3-3 陣型接發球站位責任制定輪轉策略\n2. 在教學比賽運用戰術溝通減少接球失誤', phases: [ { label: '熱身與技術複習', minutes: 10, detail: '對牆墊球熱身，兩人互拋接墊，提示手臂平台、降重心。' }, { label: '戰術講解', minutes: 8, detail: '白板繪 3-3 陣型標責任區，講不同落點接球次序與呼叫。' }, { label: '針對性練習', minutes: 12, detail: '三人按站位接發球，呼叫球權後接至二傳位置。' }, { label: '教學比賽', minutes: 15, detail: '3 組教學比賽，記接球失誤與有效呼叫，每三分暫停調整。' }, { label: '賽後檢討', minutes: 10, detail: '播錄影分析成功失誤，歸納「呼叫→移位→接球」流程。' } ], materials: ['排球（每組一個）', '球網與場地標誌', '陣型戰術白板', 'iPad 錄影架', '接球統計記錄表'] },

  // ── 視覺藝術 va ──
  { subjectId: 'va', name: '彩墨山水：水墨技法創作', style: '藝術創作', objectives: '1. 掌握乾筆、濕筆、潑墨三種技法並有意識運用\n2. 創作融入個人意境嘅彩墨山水並用藝術詞彙描述', phases: [ { label: '欣賞引入', minutes: 7, detail: '對比張大千潑墨與工筆山水，問「感受到哪種氣氛？」' }, { label: '技法示範', minutes: 10, detail: '示範乾筆、濕筆、潑墨，強調水分控制是關鍵。' }, { label: '技法練習', minutes: 8, detail: '練習紙分區嘗試三技法，記錄成功水分比例。' }, { label: '個人創作', minutes: 20, detail: '宣紙構圖遠山近石水面，自由運用技法加礦物色。' }, { label: '分享反思', minutes: 8, detail: '以「我用了__技法表現__效果」介紹，貼紙回饋。' } ], materials: ['生宣紙與練習紙', '毛筆（大中小）', '墨汁與礦物色', '張大千山水圖冊', '調色碟與清水桶'] },
  { subjectId: 'va', name: '香港街道藝術：賞析與批評', style: '賞析評賞', objectives: '1. 運用費爾德曼四步法評析本土街道藝術\n2. 識別符號象徵並聯繫社會文化背景作詮釋', phases: [ { label: '引入', minutes: 6, detail: '對比 PMQ 塗鴉與非法噴漆，「係/唔係藝術」表態。' }, { label: '教授四步法', minutes: 8, detail: '示範描述→分析→詮釋→判斷，強調描述只陳事實。' }, { label: '小組賞析', minutes: 12, detail: '各組獲街道藝術圖按四步填賞析，老師提問引導。' }, { label: '匯報討論', minutes: 15, detail: '展示圖像匯報，聯繫香港歷史文化深化詮釋。' }, { label: '個人判斷', minutes: 9, detail: '寫 200 字判斷，引兩個分析點支撐。' } ], materials: ['街道藝術圖片集（8 幅）', '費爾德曼四步工作紙', '互動白板', '地區文化背景卡', '彩色貼紙'] },
  { subjectId: 'va', name: '版畫探索：橡皮磚凸版印刷', style: '媒材探索', objectives: '1. 安全使用雕刻刀刻橡皮磚理解「留白刻走」原理\n2. 透過多次試印探索墨色厚薄與紙張對效果影響', phases: [ { label: '媒材與安全', minutes: 7, detail: '展示雕刻刀種類，示範持刀及「刀向遠離身體」原則。' }, { label: '設計轉印', minutes: 8, detail: '設計簡潔圖案（香港城市元素），轉印至橡皮磚（鏡像）。' }, { label: '雕刻橡皮磚', minutes: 15, detail: '用 V 形刀刻輪廓、U 形刀挖留白，先細節後大塊。' }, { label: '試印調整', minutes: 12, detail: '滾輪上墨試印不同紙張，據試印補刻調整。' }, { label: '正式印刷反思', minutes: 10, detail: '完成三至五張印刷，分享「最意外的發現」。' } ], materials: ['橡皮磚（10×15cm）', '雕刻刀組（V/U/平口）', '黑色印刷墨', '滾輪與玻璃板', '新聞紙/卡紙/宣紙'] },

  // ── 音樂 music ──
  { subjectId: 'music', name: '直笛合奏：節奏精準與音準訓練', style: '演奏', objectives: '1. 正確吹奏 B、A、G、E、D 五個基本音音準可接受\n2. 以 ♩=80 合奏兩聲部並按指揮調整強弱', phases: [ { label: '音階熱身', minutes: 6, detail: '慢速吹 G 大調五聲音階，強調腹部支撐及吐音清晰。' }, { label: '樂理複習', minutes: 7, detail: '寫切分節奏型，以「ta-ti-ta」口念再拍手鞏固。' }, { label: '分聲部練習', minutes: 12, detail: '高低聲部分別練習，以「唱→吹」確認音高。' }, { label: '兩聲部合奏', minutes: 15, detail: '合奏，指揮以手勢引導漸強漸弱，回放錄音自評。' }, { label: '反思預告', minutes: 10, detail: '對比專業錄音，填「做得好/需改善」，分派練習。' } ], materials: ['高音直笛（自備）', '鋼琴', '兩聲部樂譜', '白板節奏卡', 'GarageBand 錄音'] },
  { subjectId: 'music', name: '電影配樂：音樂與情感聆聽賞析', style: '聆聽賞析', objectives: '1. 辨別音樂元素（速度、調式、音色、動態）如何塑造情緒\n2. 以結構化語言比較兩段電影配樂並提情感詮釋', phases: [ { label: '無聲電影實驗', minutes: 6, detail: '同一片段播兩次（無聲/有配樂），表達感受差異。' }, { label: '元素框架教學', minutes: 8, detail: '講聆聽四維度（速度/調式/音色/動態），填工作紙。' }, { label: '第一段聆聽', minutes: 10, detail: '聽《大白鯊》主題兩遍，分析速度加速與恐懼關係。' }, { label: '第二段聆聽', minutes: 10, detail: '聽《天使愛美麗》鋼琴主題，辨大調與音色互動。' }, { label: '比較討論', minutes: 16, detail: '以兩欄對比匯報異同，補作曲家意圖，課後寫短評。' } ], materials: ['電影片段（兩齣）', '聆聽分析工作紙', '高質素音箱', '聆聽元素框架簡報', '耳機（選用）'] },
  { subjectId: 'music', name: '廣東歌改編：流行曲旋律創作', style: '創作', objectives: '1. 運用 C 大調以 4/4 拍為歌詞填 8 小節原創旋律\n2. 解釋旋律創作選擇與歌詞情感對應', phases: [ { label: '聆聽與樂理複習', minutes: 7, detail: '播熟悉廣東歌，注意旋律起伏配合九聲，複習 C 大調與 4/4。' }, { label: '創作框架教學', minutes: 8, detail: '鋼琴示範「問答句式」：前 4 小節落屬音、後 4 小節落主音。' }, { label: '旋律創作', minutes: 15, detail: '為兩句歌詞填 8 小節旋律，哼唱後記錄音高試驗節奏。' }, { label: '試唱與回饋', minutes: 12, detail: '到鋼琴單指彈並唱，同伴記「最動聽樂句」及建議。' }, { label: '修改分享', minutes: 8, detail: '據回饋修改，以「第__小節用__節奏，因為__情感」分享。' } ], materials: ['鋼琴', '五線譜創作工作紙', '廣東歌練習歌詞卡', '鉛筆與橡皮', 'GarageBand（選用）'] },
]

/** 由 RAW 砌成 Record，補 id（`${subjectId}-tpl-N`）。 */
export const SUBJECT_LESSON_TEMPLATES: Record<string, BuiltinLessonTemplate[]> = (() => {
  const map: Record<string, BuiltinLessonTemplate[]> = {}
  const count: Record<string, number> = {}
  for (const t of RAW) {
    const n = (count[t.subjectId] = (count[t.subjectId] ?? 0) + 1)
    ;(map[t.subjectId] ??= []).push({ ...t, id: `${t.subjectId}-tpl-${n}` })
  }
  return map
})()

/** 回該科內建範本；未知 / 'custom' / 未設 → 通用組。 */
export function templatesForSubject(subjectId?: string): BuiltinLessonTemplate[] {
  if (!subjectId) return GENERIC_TEMPLATES
  return SUBJECT_LESSON_TEMPLATES[subjectId] ?? GENERIC_TEMPLATES
}

/** 全部範本（含通用）—— validator / 搜尋用。 */
export function allBuiltinTemplates(): BuiltinLessonTemplate[] {
  return [...GENERIC_TEMPLATES, ...Object.values(SUBJECT_LESSON_TEMPLATES).flat()]
}
