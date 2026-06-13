# 逐科科目檔案（Subject Knowledge Profiles）— 建立 / 調教 playbook

> 助手請注意：當用戶提到要為某科**餵官方文件**（課程 syllabus / DSE 題目 /
> marking scheme / 考生範例 / 考評報告）嚟調教批改或其他功能，就跟呢份做。

## 目的
將每一科嘅 AI 行為（批改、課程大綱、教學指引、出題、DSE 操練、評分準則、簡報）
由「generic 估」升級成「按官方 DSE 標準度身定制」。老師逐科餵官方文件，
助手**提煉成衍生指引**，更新該科檔案。一次一科、可累積。

## 現狀（要升級嘅起點）
- `src/features/work/grading/markingProfiles.ts` — 現有 **27 科 v0 generic** 批改檔案
  （`persona` / `rubric` 評分準則 / `issues` 錯處分類 / `notes` 批改慣例）。packId 對齊
  `SUBJECT_PACKS`。
- `src/features/work/grading/structured.ts` — profile 驅動嘅結構化批改 prompt + JSON 解析。
- 課程大綱：`src/data/subjects.ts` 嘅 `SUBJECT_PACKS`（每科 `topics`）。
- 其他食 subject context 嘅功能：教學指引 `work/teachGuide/TeachGuide.tsx`、
  出題 `work/MaterialGen.tsx` / `work/QuestionBank.tsx`、DSE 操練 `work/dse/DseDrill.tsx`、
  評分準則 `work/rubric/RubricGen.tsx`、教學簡報 `work/slides/SlideGen.tsx`。

## 由文件提煉乜（distillation map）
| 文件 | 提煉成 |
|---|---|
| 課程及評估指引（syllabus） | 準確評分準則 + 卷別 / 比重 / 題型 + 等級描述（5\*\* / 5 / 4…）+ 官方課題大綱 |
| Marking scheme | 批改慣例（得分 / 失分點、command words：解釋 / 評估 / 比較…）|
| 考評報告（examiner report） | 學生常見錯誤 → 錯處分類 + 失分提示 |
| 考生範例（sample scripts） | 校準錨點（distill 成「呢類作答 ≈ 第幾級」嘅特徵；**唔照抄原文**）|

## 版權鐵律（必守）
- DSE 試題 / marking scheme / 考生範例 / 考評報告 = **HKEAA 版權**。
- 只可將文件**提煉成衍生指引**（準則、比重、常見錯誤、等級描述）入 codebase。
- **唔可以**將整份試題 / 範例原文照搬入 repo。
- 呢啲文件同衍生內容**絕對唔可以**流入公開資源分享區（違反《社群守則》）。

## 建議架構（逐科鋪開時）
- 一科一個檔：`src/data/subjectProfiles/<packId>.ts`（易微調、唔撞並行 session）。
- 每個檔 = 該科「知識檔案」單一真相來源：syllabus 課題 + 評估結構 + command words +
  批改慣例 + 等級描述 + 評分準則 + 錯處分類。
- 批改（markingProfiles）同各 AI 功能引用呢個單一來源。
- （未鋪開前，先直接更新 `markingProfiles.ts` 嗰科 entry 亦可。）

## 工作流程（一次一科）
1. 用戶畀某科文件（路徑或貼文字；大 PDF 講明邊幾頁關鍵）。
2. 讀 + 按上面 map 提煉。
3. 更新該科檔案（rubric / notes / 等級描述 / 課題…）。
4. 跑 `npx tsc --noEmit` + `npm run build` + `npx vitest run`，貼結果（驗證先講做好）。
5. 畀用戶睇 diff → 微調 → 落下一科。

## 點交文件
- 放 `docs/syllabus/<packId>/…`（或任何路徑話我知），或直接貼文字上嚟。
- 最高價值：**評估指引嗰節** + **考評報告嘅「general comments」**。
- marking scheme / 範例最敏感，助手只 distill、唔存原文。
