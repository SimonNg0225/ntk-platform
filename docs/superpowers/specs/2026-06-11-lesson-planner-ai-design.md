# 備課 / 教案 三項升級 — 設計文件

- **日期**：2026-06-11
- **狀態**：已批准，直接執行（feature branch → ff-merge main）
- **Feature**：`work-lesson-plan`（LessonPlanner）

## 目標（brainstorm 結論）
1. **UIUX 對齊工作儀表板**（bento 卡片語言）。
2. **AI 教案生成**：揀課題 + 簡填今日教學內容/活動（可選範本做骨架）→ AI 出靚教案。
3. **逐科手寫範本**：每科 ~3 個專屬範本（按該科常見課堂形態/風格）。

全部落到**現有 `LessonPlan` + `PlanMeta` 模型**（AI 產出 / 範本都係正常教案，用現有 PlanEditor 改、可列印）。

## 資料模型（沿用，不改 schema）
- `LessonPlan`：`{ title, classId?, topicId?, date?, objectives?, activities?, resourcesNote?, createdAt }`
- `PlanMeta`（key=plan.id）：`{ status, phases: LessonPhase[], materials: MaterialItem[], reflection?, ... }`
- `LessonPhase`：`{ id, label, minutes, detail }`；`MaterialItem`：`{ id, text, done }`

## A. AI 教案生成
**檔案**：`lessonPlanner/lessonAi.ts`（prompt + parser，純函數部分 TDD）+ `lessonPlanner/GenerateModal.tsx`
- 輸入：課題（科目 topics）、今日教學內容/活動（free text）、可選班別、可選總時長、可選範本骨架、Flash/Pro。
- `buildLessonSystem(subjectName, durationMin, skeleton?)`：subject-aware，要求 JSON
  `{ objectives, phases:[{label,minutes,detail}], materials:[string], activities }`。
  有 skeleton（範本 phases）→ 指示「跟呢個分段骨架（label/minutes）填內容」。
- `parseLessonGen(raw)`（純函數，TDD）：驗證 + clamp（minutes 0–120、phases ≤8、materials ≤12、字數截斷）；壞 JSON throw。
- 採用：建 `LessonPlan`（title=課題或 AI 標題、date、objectives、activities、topicId、classId）+ `PlanMeta`（phases、materials map text→item、status 'draft'）→ 開 PlanEditor。
- `complete({ source: 'lessons' })` 計 AI 額度。

## B. 逐科手寫範本
**檔案**：`lessonPlanner/subjectTemplates.ts`（內建常數）+ test（validator）
- `BuiltinLessonTemplate = { id, subjectId, name, style, objectives, phases:[{label,minutes,detail}], materials:string[] }`
- `SUBJECT_LESSON_TEMPLATES: Record<subjectId, BuiltinLessonTemplate[]>`：16 科各 ~3 個，反映該科課堂形態（例 BAFS：概念講授+個案 / 操卷應試 / 概念探究；化學：實驗探究 / 概念講授 / 操卷；中文：範文精讀 / 寫作工作坊 / 說話卷）。
- `templatesForSubject(subjectId)`：回該科內建範本；未知/custom → 通用風格組（講授/探究/活動/操卷/討論）。
- 選區（GenerateModal 內 + 「由範本開始」）：內建範本（按 style 標籤）+ 現有用戶範本（`planTemplatesCol` 保留）。每個可「直接用」（建空白教案）或「畀 AI 做骨架」。

## C. UIUX 對齊
- LessonPlanner shell 採 WorkDashboard 卡片語言（`rounded-2xl border border-slate-200/80 bg-white`、accent section header、間距）。
- **AI 生成入口**做成顯眼 accent CTA 卡（似 dashboard 虛線 accent 卡）。
- 範圍：planner 主視圖（清單/週/卡）外框 + GenerateModal + 範本選區；**唔重寫** PlanEditor 內部（輕掃）。

## 錯誤處理
- AI 失敗 / 壞 JSON → toast、唔建紀錄。
- minutes/數量 clamp。
- 未設任教科目 → 範本顯示通用風格組 + 提示去設定。

## 測試
- TDD 純函數：`parseLessonGen`（好/壞 JSON、clamp、fallback）、`subjectTemplates` validator（每個範本欄位齊、phases minutes 合理、materials 非空）。
- UI/AI 手測（preview）。

## 落地次序
1. AI 核心（lessonAi prompt+parser TDD）。
2. 逐科範本資料（subagent 分科起草、validator TDD）。
3. GenerateModal + 範本選區 + LessonPlanner 接線。
4. UIUX 對齊。
5. gates（tsc/vitest/build）+ ff-merge main + push。
