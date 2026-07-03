import { test, expect } from '@playwright/test'

// 進入產品（訪客模式）：App 外殼直接進入 AI-first 主界面
test.describe('產品外殼', () => {
  test('/app 載入後直接顯示 AI composer', async ({ page }) => {
    await page.goto('/app')
    await expect(page.getByRole('heading', { name: '想準備哪一堂課？' })).toBeVisible()
    await expect(page.getByLabel('輸入課題或教學任務')).toBeVisible()
    await expect(page.getByRole('button', { name: '按內容開始處理' })).toBeVisible()
    await expect(page.getByText(/歡迎使用/)).toHaveCount(0)
  })

  test('範例 prompt 可帶入 composer；rail 可展開完整側欄', async ({ page }) => {
    await page.goto('/app')
    const composer = page.getByLabel('輸入課題或教學任務')
    await page.getByRole('button', { name: /生成一份 DSE 風格工作紙/ }).click()
    await expect(composer).toHaveValue('生成一份 DSE 風格工作紙')

    await page.getByRole('button', { name: '展開側欄' }).first().click()
    await expect(page.getByText('EziTeach AI').first()).toBeVisible()
  })

  test('composer 會按內容打開對應工具，而不是一律進教學 AI', async ({ page }) => {
    await page.goto('/app')
    const prompt = '生成一份 DSE 風格工作紙'
    await page.getByLabel('輸入課題或教學任務').fill(prompt)
    await page.getByRole('button', { name: '按內容開始處理' }).click()

    await expect(page.getByRole('heading', { name: '教材生成' })).toBeVisible()
    await expect(page.getByRole('dialog', { name: '生成教學練習' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '教學 AI' })).toHaveCount(0)
  })
})
