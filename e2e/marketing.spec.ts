import { test, expect } from '@playwright/test'

// 行銷 → 定價 → 付費入口（訪客模式，無 Stripe env）
test.describe('行銷與付費入口', () => {
  test('首頁 Landing 正常顯示 + 導航去定價', async ({ page }) => {
    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: /由頭到尾搞掂/ }),
    ).toBeVisible()
    // 頂欄定價連結
    await page.getByRole('link', { name: '定價' }).first().click()
    await expect(page).toHaveURL(/\/pricing$/)
  })

  test('定價頁顯示方案；未設 Stripe 時顯示「即將推出」', async ({ page }) => {
    await page.goto('/pricing')
    await expect(page.getByRole('heading', { name: '簡單透明嘅定價' })).toBeVisible()
    await expect(page.getByText('免費版').first()).toBeVisible()
    await expect(page.getByText('Pro', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('HK$48 / 月')).toBeVisible()
    // 未配置 Stripe 嘅提示
    await expect(page.getByText(/收費功能尚未啟用/)).toBeVisible()
  })

  test('付費流程入口：未設定 Stripe 撳「升級 Pro」彈出「即將推出」', async ({
    page,
  }) => {
    await page.goto('/pricing')
    await page.getByRole('button', { name: '升級 Pro' }).click()
    // billing 未配置 → toast 提示
    await expect(page.getByText(/即將推出/)).toBeVisible()
  })

  test('私隱政策 / 服務條款頁可達', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page.getByRole('heading', { name: '私隱政策' })).toBeVisible()
    await page.goto('/terms')
    await expect(page.getByRole('heading', { name: '服務條款' })).toBeVisible()
  })
})
