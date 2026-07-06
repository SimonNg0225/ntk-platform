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

  test('任務捷徑可直接分流；收起側欄可展開', async ({ page }) => {
    await page.goto('/app')

    await page.getByRole('button', { name: '展開側欄' }).first().click()
    await expect(page.getByText('EziTeach AI').first()).toBeVisible()

    await page.getByRole('button', { name: /出題與評核/ }).click()
    await expect(page.getByRole('heading', { name: '教材生成' })).toBeVisible()
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

  test('composer 可分流到成績分析系統', async ({ page }) => {
    await page.goto('/app')
    await page.getByLabel('輸入課題或教學任務').fill('分析今次測驗成績同預測等級')
    await page.getByRole('button', { name: '按內容開始處理' }).click()

    await expect(page.getByRole('heading', { name: '成績分析' })).toBeVisible()
    await expect(page.getByText('預測模型 beta')).toBeVisible()
    await page.getByRole('button', { name: /精算風險/ }).click()
    await expect(page.getByText('班級風險評級')).toBeVisible()
    await expect(page.getByText('補救 ROI 排名')).toBeVisible()
    await page.getByRole('button', { name: '成績報告' }).nth(1).click()
    await expect(page.getByText('報告設定')).toBeVisible()
    await expect(page.getByText('學生表現分析總報告')).toBeVisible()
  })
})
