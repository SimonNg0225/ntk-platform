// ============================================================
//  功能旗標 (Feature Flags)
//  ------------------------------------------------------------
//  學生資料子系統已整套移除；以下兩個 helper 保留同樣簽名，
//  令舊有 caller 不會壞，永遠回傳 true（全部功能 / collection 開放）。
// ============================================================

export function isCollectionSyncable(_key: string): boolean {
  return true
}

export function isFeatureAvailable(_id: string): boolean {
  return true
}
