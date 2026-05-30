# NTK Platform

個人**學習與工作**平台 —— 一個可以隨時切換模式嘅個人入口，目標係提升個人知識增長同工作效能。

> 初步框架版本 `v0.1`。兩個模式（📚 學習 / 💼 工作）都已經有基本示範功能，方便你睇到切換效果同擴充方式。

## ✨ 核心概念

- **雙模式切換**：左上角一撳，喺「📚 學習模式」同「💼 工作模式」之間切換。切換時主題色、側邊欄功能會跟住變。
- **記住你嘅選擇**：模式同示範資料（筆記、待辦…）都會存喺瀏覽器，refresh / 下次開返都仲喺度。
- **功能註冊表**：所有功能集中喺一個檔案登記，加新功能好簡單。

## 🧩 目前功能

| 模式 | 功能 | 狀態 |
| --- | --- | --- |
| 📚 學習 | 學習筆記 📝 | ✅ 可用 |
| 📚 學習 | 學習目標 + 進度 🎯 | ✅ 可用 |
| 📚 學習 | 閱讀清單 📖 | 🚧 即將推出 |
| 📚 學習 | 知識卡片 🧠 | 🚧 即將推出 |
| 💼 工作 | 待辦 / 批改 ✅ | ✅ 可用 |
| 💼 工作 | 班別管理 🏫 | ✅ 可用 |
| 💼 工作 | 備課 / 教案 📋 | 🚧 即將推出 |
| 💼 工作 | 教學資源 🗂️ | 🚧 即將推出 |
| 兩者共用 | 行事曆 📅 | 🚧 即將推出 |

## 🚀 點樣行起

需要 Node.js 18 以上。

```bash
npm install      # 安裝套件（第一次）
npm run dev      # 開發模式，瀏覽器開 http://localhost:5173
npm run build    # 打包做正式版本（輸出到 dist/）
npm run preview  # 預覽打包後嘅版本
```

## 🛠️ 點樣加新功能

1. 喺 `src/features/learning/` 或 `src/features/work/` 整一個 React 元件。
2. 喺 `src/features/registry.ts` 嘅 `FEATURES` 陣列加多一個項目（填 `name`、`icon`、`modes`、`component`、`status`）。
3. 搞掂！側邊欄同首頁概覽會自動顯示新功能。

想加多一個模式（例如「研究模式」）？喺 `src/modes/modes.ts` 嘅 `MODES` 加多一個就得。

## 📁 專案結構

```
src/
├── modes/modes.ts            # 模式定義（學習 / 工作、主題色）
├── context/ModeContext.tsx   # 模式狀態 + 切換 + 記憶
├── hooks/useLocalStorage.ts  # 資料持久化小工具
├── features/
│   ├── types.ts              # Feature 型別
│   ├── registry.ts           # ★ 功能註冊表（擴充中心）
│   ├── learning/             # 學習模式功能
│   └── work/                 # 工作模式功能
├── components/               # 側邊欄、模式切換掣、功能卡…
├── pages/Home.tsx            # 首頁概覽
└── App.tsx                   # 主框架
```
