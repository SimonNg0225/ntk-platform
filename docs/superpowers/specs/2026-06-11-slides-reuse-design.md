# 教學簡報 — 同內容自動重用（慳 AI）設計

- **日期**：2026-06-11
- **狀態**：已批准，直接執行

## 目標
同一個課題／內容再生成時，唔好再行一次 AI；自動攞返之前生成嘅版本，另留「重新生成」退路。
（簡報本身已靠 `attachSync` sync 上 Supabase `app_rows`，跨裝置已保存；本功能淨係加「生成時重用」。）

## 設計
- **`sourceKey` 指紋**（`slides/sourceKey.ts`，純函數，TDD）：由「決定內容嘅輸入」砌 stable hash —
  模式、課題 id+課題文字／貼文內容（正規化空白）、版數（框架模式用分頁數）、是否框架分頁、模型。
  **唔計** pack／配相（下載先套，唔影響內容）。FNV-1a → base36。
- `DeckRecord` 加 `sourceKey?: string`（舊紀錄冇 → 唔誤中，向後相容）。
- **生成流程**（`SlideGen.run(force?)`）：
  - `force` 為假時先計 key → 喺 `slideDecksCol` 搵最新同 key 紀錄 → 有就 `setCurrent(舊份)`、
    toast「用回之前生成咗的版本（慳 AI）」、記 `reusedKey`，**唔行 AI**。
  - 冇 / `force` 為真 → 照行 AI；成功時將 `sourceKey` 一齊存落新紀錄。
- **重新生成退路**：當前顯示嘅係「同當前輸入 key 一致」嘅重用版本時，輸入卡下顯示一條
  幼提示 + 「重新生成」掣 → `run(true)` 強行再跑（清走 reusedKey）。輸入一改、key 變 → 提示消失。

## 錯誤處理
指紋只係慳 AI 嘅 fast-path；搵唔到 / 出錯都照正常行 AI。重用攞嘅係本機（已 sync）紀錄，唔需要額外網絡。

## 測試
- TDD `sourceKey.test.ts`：同輸入同 key；空白／換行差異唔影響（正規化）；count／model／框架／模式任一變 → key 變；框架模式用分頁數而非 count。
- UI 手測（preview）。
