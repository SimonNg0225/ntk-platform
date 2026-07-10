import { describe, expect, it } from 'vitest'
import { publicToastMessage } from './ToastContext'

describe('公開狀態訊息', () => {
  it('隱藏技術配置資料', () => {
    expect(publicToastMessage('error', 'VITE_GOOGLE_CLIENT_ID 未設定')).toBe(
      '服務暫時未能使用，請稍後再試或聯絡管理員。',
    )
    expect(publicToastMessage('error', 'Supabase Edge Function 未部署')).toBe(
      '服務暫時未能使用，請稍後再試或聯絡管理員。',
    )
  })

  it('保留普通而可行動的訊息', () => {
    expect(publicToastMessage('error', '請先登入後再試。')).toBe('請先登入後再試。')
  })
})
