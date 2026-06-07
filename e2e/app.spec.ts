import { test, expect } from '@playwright/test'

// 進入產品（訪客模式）：App 外殼載入 + 首次導覽
test.describe('產品外殼', () => {
  test('/app 載入並顯示首次使用導覽', async ({ page }) => {
    await page.goto('/app')
    // 首次使用：歡迎導覽彈窗（品牌：教學易 EziTeach）
    await expect(page.getByText(/歡迎使用/)).toBeVisible()
  })

  test('關閉導覽後見到側欄品牌', async ({ page }) => {
    await page.goto('/app')
    await page.getByRole('button', { name: '我自己由零開始' }).click()
    await expect(page.getByText('教學易').first()).toBeVisible()
  })
})
