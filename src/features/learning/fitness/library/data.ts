// ============================================================
//  動作 / 器材庫 — curated 動作資料
//  ------------------------------------------------------------
//  真實健身知識：每個動作標明主/次肌群、器材、2-4 條姿勢重點
//  同最常見傷盲點。內容以一般阻力訓練常識為準，僅供學習，
//  唔構成醫療建議；有傷患或疑問請諮詢專業教練 / 物理治療師。
// ============================================================

export type ExerciseCategory =
  | '胸'
  | '背'
  | '腿'
  | '肩'
  | '手臂'
  | '核心'
  | '全身'

export interface Exercise {
  id: string
  /** 中文（英文） */
  name: string
  category: ExerciseCategory
  /** 需要器材；徒手動作用 ['徒手'] */
  equipment: string[]
  primaryMuscles: string[]
  secondaryMuscles: string[]
  /** 2-4 條正確姿勢重點 */
  formCues: string[]
  /** 常見傷盲點 / 安全提示 */
  safety: string
}

export const EXERCISES: Exercise[] = [
  // ───────── 胸 ─────────
  {
    id: 'bench-press',
    name: '槓鈴臥推（Barbell Bench Press）',
    category: '胸',
    equipment: ['槓鈴', '臥推架'],
    primaryMuscles: ['胸大肌'],
    secondaryMuscles: ['三角肌前束', '肱三頭肌'],
    formCues: [
      '肩胛骨後收下沉、夾穩，胸口微微挺起',
      '槓鈴落到乳頭水平、輕觸胸口，前臂全程垂直地面',
      '雙腳踏實地面，臀部唔好離凳（保持五點支撐）',
    ],
    safety:
      '重訓必有保護者或用安全槓，肘唔好過度外展成 90° 以免肩前痛；落槓彈胸借力易傷胸肌。',
  },
  {
    id: 'incline-db-press',
    name: '上斜啞鈴臥推（Incline Dumbbell Press）',
    category: '胸',
    equipment: ['啞鈴', '可調式臥推凳'],
    primaryMuscles: ['胸大肌上部'],
    secondaryMuscles: ['三角肌前束', '肱三頭肌'],
    formCues: [
      '凳角約 30°（過高會變肩推、轉去練肩）',
      '啞鈴推到頂唔好相撞，亦唔好完全鎖死手肘',
      '下放至胸側有伸展感，手腕保持中立唔好向後折',
    ],
    safety: '凳角過大令負荷轉移到肩；起放啞鈴用大腿借力上落，避免肩關節硬扯。',
  },
  {
    id: 'pushup',
    name: '掌上壓 / 伏地挺身（Push-up）',
    category: '胸',
    equipment: ['徒手'],
    primaryMuscles: ['胸大肌'],
    secondaryMuscles: ['肱三頭肌', '三角肌前束', '核心'],
    formCues: [
      '身體成一直線：頭、髖、腳踭一條線唔好塌腰或拱臀',
      '手約肩寬略闊，下放時手肘約 45°（唔好完全張開成 T 字）',
      '全程收緊核心同臀部，落到胸口近地面',
    ],
    safety: '塌腰會壓腰椎；肘外張成 90° 增肩關節壓力。撐唔住寧可跪姿做全幅度。',
  },
  {
    id: 'cable-fly',
    name: '繩索夾胸（Cable Fly）',
    category: '胸',
    equipment: ['滑輪機'],
    primaryMuscles: ['胸大肌'],
    secondaryMuscles: ['三角肌前束'],
    formCues: [
      '手肘保持微彎固定角度，動作由肩關節主導（唔係屈肘）',
      '想像「抱大樹」向中間收，頂峰夾胸一秒',
      '身體微前傾、核心收緊，唔好靠擺動身體借力',
    ],
    safety: '手肘完全伸直會將張力轉到肘關節；重量過大會令肩過度後拉、拉傷胸肌起點。',
  },

  // ───────── 背 ─────────
  {
    id: 'pullup',
    name: '引體上升（Pull-up）',
    category: '背',
    equipment: ['單槓'],
    primaryMuscles: ['背闊肌'],
    secondaryMuscles: ['肱二頭肌', '斜方肌中下部', '菱形肌'],
    formCues: [
      '起手先沉肩（肩胛下壓），再用背帶起身體',
      '想像手肘向地面、向後拉，胸口靠向槓',
      '頂點下巴過槓，落到手臂接近伸直但唔完全放鬆肩',
    ],
    safety: '完全鬆肩懸吊（死掛）易拉傷肩；借擺動（kipping）冇核心控制易閃腰、傷肩。',
  },
  {
    id: 'bent-over-row',
    name: '槓鈴俯身划船（Bent-over Barbell Row）',
    category: '背',
    equipment: ['槓鈴'],
    primaryMuscles: ['背闊肌', '斜方肌中部', '菱形肌'],
    secondaryMuscles: ['肱二頭肌', '後三角肌', '豎脊肌'],
    formCues: [
      '髖鉸鏈前傾約 45°，背部保持中立挺直唔好弓背',
      '槓貼住腿向肚臍 / 下腹方向拉，手肘貼身',
      '頂點夾肩胛，落槓有控制唔好用慣性甩',
    ],
    safety: '弓腰拉重量係腰椎間盤受傷高危動作；重量過大會變成全身擺盪借力。',
  },
  {
    id: 'lat-pulldown',
    name: '滑輪下拉（Lat Pulldown）',
    category: '背',
    equipment: ['滑輪機', '下拉桿'],
    primaryMuscles: ['背闊肌'],
    secondaryMuscles: ['肱二頭肌', '斜方肌中下部'],
    formCues: [
      '坐穩、大腿固定喺墊下，身體只微微後傾',
      '先沉肩再下拉，桿拉到上胸位置',
      '想像手肘向兩側落地，唔好用二頭硬屈手臂',
    ],
    safety: '切勿拉去頸後（behind-neck）—— 強迫肩外旋易夾擠 / 傷肩；身體大幅後仰變借力。',
  },
  {
    id: 'deadlift',
    name: '傳統硬舉（Conventional Deadlift）',
    category: '背',
    equipment: ['槓鈴'],
    primaryMuscles: ['豎脊肌', '臀大肌', '膕繩肌'],
    secondaryMuscles: ['背闊肌', '斜方肌', '前臂'],
    formCues: [
      '槓貼近小腿中段，肩在槓正上方略前，背部中立繃緊',
      '起槓用腿推地，髖同膊同步升起，槓全程貼身上行',
      '頂點站直夾臀，唔好過度後仰；落槓用髖鉸鏈先推臀向後',
    ],
    safety:
      '弓背（腰椎屈曲）負重係硬舉最大受傷主因；先繃緊核心（瓦氏呼吸）穩定脊柱，循序加重。',
  },

  // ───────── 腿 ─────────
  {
    id: 'back-squat',
    name: '槓鈴深蹲（Barbell Back Squat）',
    category: '腿',
    equipment: ['槓鈴', '深蹲架'],
    primaryMuscles: ['股四頭肌', '臀大肌'],
    secondaryMuscles: ['膕繩肌', '內收肌', '豎脊肌', '核心'],
    formCues: [
      '槓放上斜方肌（高槓）或後三角（低槓），核心繃緊',
      '髖膝同步下蹲，膝向腳尖方向、唔好內夾',
      '蹲到至少大腿平行，重心落喺腳掌中後段，全程挺胸',
    ],
    safety:
      '膝內扣（valgus）同弓腰係傷膝 / 傷腰高危；務必喺深蹲架內設安全桿，量力而為。',
  },
  {
    id: 'romanian-deadlift',
    name: '羅馬尼亞硬舉（Romanian Deadlift）',
    category: '腿',
    equipment: ['槓鈴'],
    primaryMuscles: ['膕繩肌', '臀大肌'],
    secondaryMuscles: ['豎脊肌', '背闊肌'],
    formCues: [
      '微屈膝後固定，動作由髖鉸鏈主導（臀向後推）',
      '槓貼大腿下滑，落到膕繩肌有明顯伸展即可（多數人到脛骨中段）',
      '背部全程中立繃緊，靠夾臀站直',
    ],
    safety: '為咗落更低而弓背係腰椎受傷主因；活動度不足唔好強行加深，先練髖鉸鏈。',
  },
  {
    id: 'lunge',
    name: '弓箭步 / 箭步蹲（Lunge）',
    category: '腿',
    equipment: ['徒手', '啞鈴'],
    primaryMuscles: ['股四頭肌', '臀大肌'],
    secondaryMuscles: ['膕繩肌', '小腿', '核心'],
    formCues: [
      '前腳踏出後，前膝對齊腳尖、唔好超出太多或內扣',
      '上身保持挺直，垂直下沉令後膝接近地面',
      '靠前腳腳跟發力推返起身',
    ],
    safety: '前膝內扣或軀幹前傾過多會加膝壓力；單腳平衡差先扶牆做，避免拗柴。',
  },
  {
    id: 'leg-press',
    name: '腿推機（Leg Press）',
    category: '腿',
    equipment: ['腿推機'],
    primaryMuscles: ['股四頭肌', '臀大肌'],
    secondaryMuscles: ['膕繩肌', '內收肌'],
    formCues: [
      '雙腳與肩同寬踏踏板中央，膝同腳尖同方向',
      '下放至膝約 90°，唔好深到腰 / 骨盆離開椅背',
      '推到頂唔好完全鎖死膝關節',
    ],
    safety: '下放過深令骨盆後傾、腰椎拱起受壓；鎖死膝關節頂重量易傷膝。',
  },
  {
    id: 'calf-raise',
    name: '提踵 / 小腿上提（Standing Calf Raise）',
    category: '腿',
    equipment: ['徒手', '啞鈴'],
    primaryMuscles: ['腓腸肌', '比目魚肌'],
    secondaryMuscles: [],
    formCues: [
      '前腳掌踏穩，腳踭盡量升高頂峰停一停',
      '慢慢落到腳踭略低於踏板有伸展感（全幅度）',
      '膝保持伸直（屈膝會偏練比目魚肌）',
    ],
    safety: '彈震式快上快落易拉傷小腿 / 跟腱；扶穩保持平衡，控制離心。',
  },

  // ───────── 肩 ─────────
  {
    id: 'overhead-press',
    name: '站姿肩推（Overhead Press）',
    category: '肩',
    equipment: ['槓鈴'],
    primaryMuscles: ['三角肌前束', '三角肌中束'],
    secondaryMuscles: ['肱三頭肌', '斜方肌上部', '核心'],
    formCues: [
      '槓放鎖骨前架上，手肘略在槓前，核心同臀收緊',
      '推起時頭微後收讓槓直線上行，過頭後頭再回中',
      '頂點手臂伸直、肩聳起穩定，唔好過度後仰腰',
    ],
    safety: '靠後仰腰借力推會壓腰椎；肩活動度不足硬推過頭易夾擠，先改坐姿或啞鈴。',
  },
  {
    id: 'lateral-raise',
    name: '啞鈴側平舉（Dumbbell Lateral Raise）',
    category: '肩',
    equipment: ['啞鈴'],
    primaryMuscles: ['三角肌中束'],
    secondaryMuscles: ['三角肌前束', '斜方肌上部'],
    formCues: [
      '手肘微彎固定，舉到手肘與肩同高即可（唔使更高）',
      '想像用手肘領舉、唔係用手腕，尾指略高似「倒水」',
      '慢慢落、控制離心，唔好靠擺身甩起',
    ],
    safety: '舉超過肩高 + 聳肩會夾擠肩峰；重量過大必擺身借力，輕重量慢做更有效。',
  },
  {
    id: 'face-pull',
    name: '臉拉（Face Pull）',
    category: '肩',
    equipment: ['滑輪機', '繩索把手'],
    primaryMuscles: ['後三角肌', '斜方肌中下部'],
    secondaryMuscles: ['菱形肌', '旋轉肌群'],
    formCues: [
      '滑輪設喺面 / 上胸高度，繩索向面拉並向兩側張開',
      '頂點手肘高過手腕、肩胛後收，做出「比讚」外旋',
      '保持輕重量、節奏受控，肩唔好聳起',
    ],
    safety: '對肩健康好，但重量過大會變成聳肩 + 軀幹後仰；重質不重量。',
  },

  // ───────── 手臂 ─────────
  {
    id: 'biceps-curl',
    name: '啞鈴二頭彎舉（Dumbbell Biceps Curl）',
    category: '手臂',
    equipment: ['啞鈴'],
    primaryMuscles: ['肱二頭肌'],
    secondaryMuscles: ['肱肌', '前臂'],
    formCues: [
      '上臂貼身固定，只動前臂（肘做唯一轉軸）',
      '彎到頂峰收緊二頭，慢慢落到接近伸直',
      '手腕保持中立唔好向內捲，避免借力擺身',
    ],
    safety: '靠擺動身體 / 甩腰借力會減效並壓腰；落得太快猛拉肘關節易傷肌腱。',
  },
  {
    id: 'triceps-pushdown',
    name: '繩索三頭下壓（Triceps Pushdown）',
    category: '手臂',
    equipment: ['滑輪機'],
    primaryMuscles: ['肱三頭肌'],
    secondaryMuscles: [],
    formCues: [
      '上臂夾貼身體兩側固定，手肘做唯一轉軸',
      '下壓到手臂完全伸直、頂峰收緊三頭',
      '回放有控制至前臂約平行地面，上臂全程唔郁',
    ],
    safety: '聳肩 / 上臂前後擺即係用背同肩借力；身體過度前傾壓重會走樣。',
  },
  {
    id: 'overhead-triceps-ext',
    name: '過頭三頭伸展（Overhead Triceps Extension）',
    category: '手臂',
    equipment: ['啞鈴'],
    primaryMuscles: ['肱三頭肌（長頭）'],
    secondaryMuscles: [],
    formCues: [
      '上臂貼耳側朝天固定，只屈伸手肘',
      '啞鈴落到後腦勺有伸展感，再伸直頂峰收緊',
      '核心收緊唔好挺腰借力，手肘唔好過度外張',
    ],
    safety: '肩或胸椎活動度不足會迫到挺腰代償；重量太大落得太低易拉傷肘 / 肩。',
  },
  {
    id: 'hammer-curl',
    name: '錘式彎舉（Hammer Curl）',
    category: '手臂',
    equipment: ['啞鈴'],
    primaryMuscles: ['肱肌', '肱橈肌'],
    secondaryMuscles: ['肱二頭肌', '前臂'],
    formCues: [
      '掌心相對（中立握）全程維持，似揸鎚仔',
      '上臂貼身固定，只屈前臂彎到頂',
      '慢慢落、唔好擺身，頂峰略停',
    ],
    safety: '同二頭彎舉一樣，最常見係擺腰借力；控制離心、量力選重。',
  },

  // ───────── 核心 ─────────
  {
    id: 'plank',
    name: '平板支撐（Plank）',
    category: '核心',
    equipment: ['徒手'],
    primaryMuscles: ['腹橫肌', '腹直肌'],
    secondaryMuscles: ['腹斜肌', '豎脊肌', '臀大肌', '肩'],
    formCues: [
      '前臂與肩同寬撐地，身體頭到腳成一直線',
      '收緊腹同臀（骨盆微後傾），唔好塌腰或拱臀',
      '頸保持中立眼望地，正常呼吸唔好閉氣',
    ],
    safety: '塌腰令腰椎受壓係最常見錯；撐到發抖塌腰寧可縮短時間，質量行先。',
  },
  {
    id: 'dead-bug',
    name: '死蟲式（Dead Bug）',
    category: '核心',
    equipment: ['徒手'],
    primaryMuscles: ['腹橫肌', '腹直肌'],
    secondaryMuscles: ['髖屈肌'],
    formCues: [
      '仰臥，雙手指天、雙髖膝屈成 90°',
      '對側手腳同時慢慢伸遠，腰背全程貼緊地面',
      '伸出時呼氣收緊核心，回中換邊',
    ],
    safety: '伸展時腰離地（拱起）就失去保護效果；幅度寧可細而保持下背貼地。',
  },
  {
    id: 'hanging-leg-raise',
    name: '懸吊舉腿（Hanging Leg Raise）',
    category: '核心',
    equipment: ['單槓'],
    primaryMuscles: ['腹直肌（下部）'],
    secondaryMuscles: ['髖屈肌', '前臂'],
    formCues: [
      '懸吊先沉肩穩定，唔好完全鬆掛',
      '用下腹捲起骨盆帶動抬腿（唔淨係屈髖）',
      '慢慢落、控制離心，唔好前後擺盪借力',
    ],
    safety: '擺盪用慣性會用髖屈肌借力兼閃腰；做唔到直腿先屈膝抬。',
  },
  {
    id: 'russian-twist',
    name: '俄羅斯轉體（Russian Twist）',
    category: '核心',
    equipment: ['徒手', '啞鈴'],
    primaryMuscles: ['腹斜肌'],
    secondaryMuscles: ['腹直肌', '髖屈肌'],
    formCues: [
      '坐姿微後傾、背挺直唔好弓，腳可離地增難度',
      '由軀幹（胸椎）旋轉帶動，唔淨係手左右擺',
      '節奏受控，每邊輕觸地或停一停',
    ],
    safety: '弓腰快速亂扭易拉傷下背；重量唔使大，受控旋轉先有效。',
  },

  // ───────── 全身 ─────────
  {
    id: 'kettlebell-swing',
    name: '壺鈴擺盪（Kettlebell Swing）',
    category: '全身',
    equipment: ['壺鈴'],
    primaryMuscles: ['臀大肌', '膕繩肌'],
    secondaryMuscles: ['豎脊肌', '核心', '肩'],
    formCues: [
      '髖鉸鏈為主（唔係深蹲），壺鈴盪到後檔再爆髖向前',
      '靠爆發夾臀將壺鈴「拋」到胸 / 肩高，手臂只係吊住',
      '背全程中立繃緊，頂點站直夾臀收核心',
    ],
    safety: '用手臂硬舉起或弓腰盪係傷腰 / 傷肩主因；先掌握髖鉸鏈再加重。',
  },
  {
    id: 'burpee',
    name: '波比跳（Burpee）',
    category: '全身',
    equipment: ['徒手'],
    primaryMuscles: ['股四頭肌', '胸大肌', '核心'],
    secondaryMuscles: ['臀大肌', '肱三頭肌', '肩'],
    formCues: [
      '蹲下手撐地，雙腳向後跳成掌上壓位（身體成直線）',
      '收腳回蹲，再向上爆發跳起、頭頂拍手',
      '落地屈膝緩衝，保持節奏唔好塌腰',
    ],
    safety: '疲勞時跳板凳位塌腰、落地硬膝最易受傷；累就減速或拆解動作完成。',
  },
  {
    id: 'thruster',
    name: '推舉蹲（Thruster）',
    category: '全身',
    equipment: ['槓鈴', '啞鈴'],
    primaryMuscles: ['股四頭肌', '臀大肌', '三角肌'],
    secondaryMuscles: ['肱三頭肌', '核心', '上背'],
    formCues: [
      '前蹲架住負荷，蹲到大腿平行',
      '起身爆發、借腿力順勢將負荷推過頭（一氣呵成）',
      '頂點站直手伸直，落槓回到架位再蹲下一下',
    ],
    safety: '上推階段最易後仰挺腰借力壓腰；肩活動度不足過頭會夾擠，循序加重。',
  },
]
