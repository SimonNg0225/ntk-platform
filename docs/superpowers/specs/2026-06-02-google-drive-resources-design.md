# 教學資源庫 × Google Drive 整合 — 設計 spec

> 日期：2026-06-02 · 狀態：待 user review
> 流程：brainstorm（已透過問答收集需求）→ 本 spec → writing-plans → 實作

## 目標

喺「教學資源庫」加一個 **Google Drive 模式**：直接連去你 Drive 一個教材資料夾，
**live 列檔、用檔名搜尋、一撳即開**——個 Drive 資料夾就係 single source of truth。

## 已拍板需求（由問答得出）

1. **跨裝置**（電腦 + 手機睇同一份）→ 必須雲端 → Google Drive。
2. **唔怕「不同步」**：app 直接讀 Drive，唔做 copy、唔使人手維護清單；Drive 改名／搬檔即時反映。
3. 體驗似 Finder：**入資料夾、搜尋、開檔**。
4. 唔需要喺 app 改 Drive（睇 + 開就夠）→ **唯讀**。

## 技術方案

- **前端直連，零後端**：用 Google Identity Services（GIS）`initTokenClient` 攞 access token
  （token / implicit flow，**冇 client secret、唔使 server**），再用 **Drive REST API v3**（`fetch`）。
- **Scope**：`https://www.googleapis.com/auth/drive.readonly`（可列檔 / 搜尋 / 開 / 日後預覽）。
- **Safari / iOS 都得**：GIS + Drive REST 純粹係 OAuth 彈窗 + HTTPS fetch，Safari、iPhone/iPad 都行
  （唔似 File System Access API 咁淨係 Chrome 桌面）→ 真正跨裝置 ✅。
- **OAuth client ID** 由 env `VITE_GOOGLE_CLIENT_ID` 提供（你喺 Vercel 設；本機放 .env.local）。
  client ID 係可公開嘅；唔涉及任何 secret。

## 設定（你喺 Google Cloud 要撳乜 — 我會逐步陪你）

1. console.cloud.google.com → 建（或揀）一個 project。
2. 「API 和服務 → 已啟用的 API → 啟用」**Google Drive API**。
3. 「OAuth 同意畫面」→ 類型 **外部**、填 app 名 / 你 email；**發布狀態保持「測試中」**。
   - 「測試使用者」加你自己（同想用嘅同事 email，上限 100 個）。測試中 = 唔使 Google 審核敏感 scope。
4. 「憑證 → 建立憑證 → OAuth 用戶端 ID → 網頁應用程式」：
   - 已授權的 JavaScript 來源：`https://<你 Vercel 網域>` + `http://localhost:5173`
   - 抄低 **用戶端 ID**。
5. 將用戶端 ID 放：
   - Vercel → Project Settings → Environment Variables → `VITE_GOOGLE_CLIENT_ID`
   - 本機（可選）→ `.env.local` 加 `VITE_GOOGLE_CLIENT_ID=...`
6. （重要）我**永遠唔會攞你個人 Google 登入**；你係喺個 app 自己撳「連接 Google Drive」授權。

## UI / UX（教學資源庫內）

- 資源庫加一個檢視切換：**「我的庫」**（現有 link 收藏）＋ **「Google Drive」**（新）。
- Drive 分頁：
  - 未設定 client ID → 友善提示 + 設定步驟連結（`docs/SETUP.md`）。
  - 已設定、未連接 → 「連接 Google Drive」掣（GIS 授權彈窗）。
  - 已連接 → 麵包屑式資料夾導航（入 folder / 返上層）＋ 頂部**檔名搜尋**（Drive `files.list` q=name contains）＋ 檔案列：icon（按 mimeType）、名、改動時間、size；撳 → `webViewLink` 新分頁開（或 Drive 預覽）。
  - 「設定根資料夾」：用 `files.list` 揀／貼一個 folder 做起點（store `driveRootFolderId`）。
- 沿用教學資源庫嘅 bespoke 視覺（典藏目錄 / 借閱卡語言），Drive 檔案卡同樣風格。

## 資料模型 / 儲存

- **唔存任何檔案內容 / 唔做 copy**（live 讀 Drive）。
- 新 collection（feature 內，會跟帳戶 sync）：`drive_config`：`{ id:'config', rootFolderId?, rootFolderName? }`。
  → folder 設定跨裝置一致；各裝置各自做 Google 授權（token 唔 sync，唔存落雲，安全）。
- token 只留喺 memory / session；過期（~1 小時）→ 重新 `requestAccessToken`（靜默或一撳）。

## 硬性規範

1. 新功能模組獨立（`src/features/work/resourceLibrary/drive/*` + 一個 `lib/googleDrive.ts`）；
   只接觸 ResourceLibrary feature + 新檔；唔郁其他 feature。
2. **client-side only**：唔加 server、唔放任何 secret 落前端（token flow 本身免 secret）。
3. 保留教學資源庫現有「link 收藏」功能（Drive 係新增模式，唔取代）。
4. mode 色 / 深色 / 375px / 唔加重型 dependency（GIS 用 Google 官方 script tag；Drive 用 fetch，免 SDK）。
5. tsc 0 error；未設定 `VITE_GOOGLE_CLIENT_ID` 時功能靜靜降級（顯示設定提示），唔影響其餘 app。

## 範圍 / 限制（老實講）

- **唯讀**：唔支援喺 app 上載 / 改名 / 刪 Drive 檔（將來可加，要 `drive.file` 或更闊 scope）。
- **OAuth 測試模式**：你 + 你加嘅測試使用者（≤100）用得；如要公開畀任何人用，`drive.readonly`
  屬敏感 scope，要 Google 審核（功夫大）。個人 / 小團隊用測試模式已足夠。
- token ~1 小時；過期要重新授權（會做到一撳 / 盡量靜默）。
- 離線：冇網就連唔到 Drive（可選：cache 最近一次列表純顯示，但開檔仍要網）。

## 風險與緩解

| 風險 | 緩解 |
|---|---|
| 用戶未設定 client ID | 功能降級 + 清晰設定指引，唔 crash |
| OAuth 來源未加 localhost/Vercel | SETUP 步驟明列；錯會即時 console 報 origin |
| 敏感 scope 審核 | 用「測試中」模式（你 + 測試使用者），唔需審核 |
| token 過期 | 自動 / 一撳重新攞 token |
| Safari 第三方 cookie / popup | GIS token flow 用 popup；如被擋有 fallback 提示 |
