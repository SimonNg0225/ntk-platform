import { createCollection, type Entity } from '../../../../lib/store'

// ============================================================
//  Google Drive 設定（教學資源庫）
//  ------------------------------------------------------------
//  只存「哪個資料夾做內容來源」（rootFolderId）—— 會跟帳戶 sync，令各裝置
//  指住同一個 Drive 資料夾。token 不存（每部裝置自己做 Google 授權）。
// ============================================================
export interface DriveConfig extends Entity {
  rootFolderId?: string
  rootFolderName?: string
}

export const driveConfigCol = createCollection<DriveConfig>('drive_config', [])
