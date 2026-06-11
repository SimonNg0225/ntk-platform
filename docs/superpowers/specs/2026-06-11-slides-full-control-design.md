# 教學簡報「全套控制」— 設計文件

- **日期**：2026-06-11
- **狀態**：已批准，直接執行
- **Feature**：`work-slides`（SlideGen）強化

---

## 1. 目標（brainstorm 結論）

| 題目 | 決定 |
|---|---|
| 介入點 | **兩樣都要**：①生成後逐版可編輯 ②貼內容時用分隔符標明分頁 |
| 編輯深度 | **全套控制**：版式互轉（7 種）＋圖表數據＋配圖關鍵詞＋文字＋加刪排序 |
| 轉版式內容搬法 | **規則預填＋手執＋AI 掏**：即時規則轉換（離線得），另有「AI 幫我轉」「AI 重寫呢版」 |
| 分隔符模式 AI 行為 | **執靚但唔改分頁**：版數／標題／次序鎖死，AI 只精煉每版內文＋揀版式 |

## 2. 檔案結構

| 檔案 | 責任 |
|---|---|
| `slides/manualPages.ts` ＋ test（新） | 純函數 `parseManualPages(text)`：`---` 或連續空行斬版、每段首行＝標題；`frameworkToDeck(pages, title)`：照搬入版（AI 失靈保險） |
| `slides/editor/convert.ts` ＋ test（新） | 純函數 `convertSlide(slide, target)`：七種版式互轉規則預填 |
| `slides/editor/SlideEditor.tsx`（新） | Modal 編輯器：按版式表單＋版式切換 chips＋圖表數據表＋配圖關鍵詞＋備註＋AI 兩掣＋一步 undo |
| `slides/editor/slideAi.ts`（新） | 單版 AI：`rewriteSlide(slide, instruction?, model)`、`aiConvertSlide(slide, target, model)`；validate 唔過 throw |
| `slidePrompts.ts`（改） | 加 `buildFrameworkSystem(pages, subjectName, pack)`（嚴格分頁）；export 單版 sanitize/validator 畀 slideAi 重用 |
| `SlideGen.tsx`（改） | 貼內容加「跟我嘅分段分版」開關（偵測到 `---`/空行段自動亮提示）；DeckView 卡加 ✏️↑↓🗑️＋；接 SlideEditor；`slideDecksCol.update(rec.id, { slides })` |
| `appEn.ts`（改） | 新字串入 `slides` namespace（舊 raw 中文字串唔郁） |

## 3. 資料流

- **框架模式**：parseManualPages → buildFrameworkSystem（鎖版數/標題/次序）→ complete → parseDeck → **驗版數**：對唔上 → `frameworkToDeck` 照搬 + toast「AI 分版對唔上，已照你嘅分段直接入版」。
- **編輯**：總覽 ✏️ → SlideEditor 深拷貝 → 儲存寫返 slides[i] → `slideDecksCol.update`。↑↓🗑️＋ 喺總覽直接做、即時 persist。
- **轉版式**：chip → `convertSlide` 即時預填；「AI 幫我轉」→ aiConvertSlide 覆蓋（有一步 undo）。

## 4. 轉換規則摘要（convert.ts）

任何版式先攤平做 `{title, lines[]}`（bullets／步驟 title+desc／卡 title+desc／stat value+label／對比兩欄／金句），再入目標結構：
- →bullets：lines 逐條
- →steps：每條 line 一步（首 12 字做 step title、其餘做 desc；上限 5 步、多出併入最後一步 desc）
- →cards：line 以「：」或「—」斬 title/desc（冇就首 8 字）；上限 6
- →stats：每條 line regex 抽第一個數字（含 %／$）做 value、剩餘做 label；抽唔到 value=`—`；上限 4、唔夠 2 項就保持原版式並由 UI 提示
- →compare：lines 前半左欄、後半右欄；欄題「甲／乙」
- →quote：首條做金句、次條做出處
- →section：淨標題

## 5. 錯誤處理

- 單版 AI 失敗／JSON 唔合規 → toast、原版唔郁
- 框架模式版數錯 → 自動照搬保險
- 圖表 value 非數字 → 紅框＋儲存 disable
- stats/steps/cards 項數唔達下限 → 唔切換並提示

## 6. 測試

- TDD：`manualPages.test.ts`（---／空行／混合／首行標題／空段／單段）、`convert.test.ts`（關鍵轉向＋數字抽取＋上限裁切）
- 單版 validator 壞輸入測試（壞 JSON／缺欄）
- UI/AI 手測（preview）

## 7. 字串

新 UI 用 `t('slides.*', { defaultValue: '廣東話' })`＋英文入 appEn；SlideGen 既有 raw 中文唔郁。
