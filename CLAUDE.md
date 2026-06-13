# 工作守則（每個 session 自動讀，跟足）

## 語言・風格
- 用繁體中文（廣東話）。精簡、直接；做得到就做，唔好長篇解釋或列一堆唔會揀嘅選項。
- 有決定先做最合理嗰個，順帶一句講點解；唔好為問而問。

## 慳 context / 慳額度（重要）
- 唔好成個大檔讀晒：用 `grep`/`glob` 定位，只讀需要嗰範圍。
- 唔好喺對話 dump 大 output（log / XML / 檔案內容）：用 `head`/`grep` 摘要，只貼關鍵幾行。
- 機械／搜尋類工作先考慮用 subagent（佢只回結論），但唔好濫開；一兩個夠就一兩個。
- 唔好重讀已經讀過嘅檔。做完一個段落，可以提我 `/clear` 或 `/compact`。
- 例行嘢可以建議轉 Sonnet。

## 改動・驗證紀律
- 改完一定要驗證先講「做好」：`tsc` / `build` / 相關測試**實際跑過、貼結果**；跑唔到就照直講。
- 唔好聲稱「已修好 / 已通過」而冇真係 run 過。
- 只改需要嘅檔，唔好順手改其他嘢。
- 我驗證唔到嘅嘢（例如要 PowerPoint / 瀏覽器先睇到效果）要明確標出「未核實」。

## Git / PR 流程
- 喺 feature branch 開工，唔好直接推 `main`。
- `push` 用 `-u origin <branch>`；網絡失敗先重試。
- commit message 清楚；要我**先開 PR / merge** 先做，唔好擅自開（除非今次任務明確叫我開）。

## 溝通
- 唔肯定或有風險（尤其唔可逆、對外、我驗證唔到嘅嘢）先問，或明確標「未核實」。
- 每個段落完，一句講清：做咗咩、驗證結果、跟住可以做咩。

---

## 專案速覽（EziTeach 教學易）
- React + TypeScript + Vite + Tailwind；香港教師一站式工作台。
- 測試：`npx vitest run`；型別：`npx tsc --noEmit`；build：`npm run build`。
- 教學簡報引擎喺 `src/lib/export/`（pptxgenjs 純 code 出 .pptx）：
  - 34 套模板 pack（`pptxPacks.ts` 核心 6 + `pptxPacksGallery1..7`），每套有招牌版式 override + 逐版母題 deco。
  - `pptxGradients.ts`：漸層注入（出檔後 PizZip 階段換 OOXML gradFill）。
  - `pptx.ts`：dispatch + 出檔後 patch（theme 字體 / 漸層 / 修正非法負 `<a:ext>`）。
  - 鐵律：文字經 `tx()`、色 6-hex 無 `#`、tint 用 `mix()`、shadow 只 outer、`<a:ext>` 不可為負。
- 生成 prompt：`src/features/work/slides/slidePrompts.ts`（pack-aware：版式偏好 / 密度 / 雙語）。

## 逐科科目檔案（餵官方文件調教批改 / 課程等）
- 當我講要為某科餵 **syllabus / DSE 題 / marking scheme / 考生範例 / 考評報告** 嚟調教批改
  （或課程大綱、教學指引、出題等）→ 跟 `docs/subject-profiles.md` 個 playbook 做
  （一次一科：讀 → 提煉成衍生指引 → 更新該科檔案 → `tsc`/`build`/`test` → 畀我睇 diff → 微調）。
- **版權鐵律**：DSE / HKEAA 材料只可**提煉成衍生指引**入 codebase，唔可以原文照搬入 repo，
  亦**絕對唔可以**流入公開資源分享區（違《社群守則》）。
- 起點：`src/features/work/grading/markingProfiles.ts`（27 科 v0 generic 批改檔案）；
  課程大綱喺 `src/data/subjects.ts` 嘅 `SUBJECT_PACKS`。
