# NTK iOS 主畫面小組件（Scriptable）

兩個 [Scriptable](https://scriptable.app/)（免費 iOS app）腳本，喺 iPhone 主畫面顯示你嘅 NTK 數據：

### 1. `ntk-widget.js` — 概覽
- 🔥 **連續寫日誌天數**（journal streak）
- ✅ **未完成待辦數**（work tasks）
- ⏳ **下個重要日子倒數**（countdowns）

### 2. `ntk-timetable-widget.js` — 今日課堂
- 📚 計返今日係 **Day 幾**（6 日循環，由校曆 `cycle_calendar` 決定；或星期模式）
- 列出**當日課堂**（時間 · 科目 · 課室），**高亮緊上嗰節**（● 上緊）
- 建議用**中 / 大型** widget；冇堂 / 休息日會顯示提示

> 兩個 script 嘅 `CONFIG` 一模一樣（同一個 Supabase + USER_ID）。

## 點解用 Scriptable？

NTK 係網頁 / PWA。iOS 主畫面 widget **一定要原生 WidgetKit**，網頁攞唔到。
最快、唔使上架、唔使 Mac/Xcode 嘅個人方案就係 Scriptable：用 JS 寫 widget，
直接由你嘅 **Supabase** 攞數據（全部集合都喺 `app_rows` 表）。

## 安裝

1. App Store 下載 **Scriptable**。
2. Scriptable → ＋ → 改名 `NTK` → 將 [`ntk-widget.js`](./ntk-widget.js) 全文貼入去。
3. 填好檔頂 `CONFIG`：
   - `SUPABASE_URL`：同 `.env.local` 嘅 `VITE_SUPABASE_URL` 一樣。
   - `SUPABASE_KEY`：用 **service_role** key（Supabase Dashboard → Project Settings
     → API）。因為 app 用 Google OAuth，widget 冇得行登入，所以要用 service_role
     直接讀。⚠️ 此 key 權限好大、可繞過 RLS —— **淨係放你自己部機，切勿外洩**。
   - `USER_ID`：你嘅 Supabase 用戶 UID（Dashboard → Authentication → Users）。
4. 主畫面長按 → ＋ → Scriptable → 中型 widget → 編輯 → Script 揀 `NTK`。

**今日課堂 widget**：重覆步驟 2–4，但貼 [`ntk-timetable-widget.js`](./ntk-timetable-widget.js)、改名 `NTK 課堂`、揀**中 / 大型** widget。
> ⚠️ `USER_ID` 一定要係 Supabase **User UID（UUID）**，唔係你個登入名 / GitHub 名 —— 填錯會見「Supabase 回應格式唔啱」。

> 純個人用途方案。如果將來要做正式、可分發嘅原生 widget，需要 Capacitor 包殼 +
> 原生 WidgetKit extension（Swift）+ Apple 開發者帳號。
