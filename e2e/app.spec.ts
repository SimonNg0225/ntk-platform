import { test, expect } from '@playwright/test'

test.describe('首次使用', () => {
  test('選擇任務後直接進入對應工作區', async ({ page }) => {
    await page.goto('/app')
    await expect(page.getByRole('heading', { name: '先完成今晚最急的一件事' })).toBeVisible()
    await page.getByPlaceholder('例如：百分比應用').fill('百分比應用')
    await page.getByRole('button', { name: /出工作紙/ }).click()
    await page.getByRole('button', { name: '開始準備' }).click()

    await expect(page).toHaveURL(/\/app\/work-generate$/)
    await expect(page.getByRole('heading', { name: '教材生成' })).toBeVisible()
  })
})

// 進入產品（訪客模式）：App 外殼直接進入 AI-first 主界面
test.describe('產品外殼', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('ntk.onboarded_v1', '1'))
  })

  test('/app 載入後直接顯示 AI composer', async ({ page }) => {
    await page.goto('/app')
    await expect(page.getByRole('heading', { name: '今日想先完成什麼？' })).toBeVisible()
    await expect(page.getByLabel('輸入課題或教學任務')).toBeVisible()
    await expect(page.getByRole('button', { name: '按內容開始處理' })).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('任務捷徑可直接分流；收起側欄可展開', async ({ page }) => {
    await page.goto('/app')

    await page.getByRole('button', { name: '展開側欄' }).first().click()
    await expect(page.getByText('EziTeach AI').first()).toBeVisible()

    await page.getByRole('button', { name: /出工作紙/ }).click()
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

  test('功能有可分享連結，重新載入和返回仍保留導航狀態', async ({ page }) => {
    await page.goto('/app/work-grade-analytics')
    await expect(page.getByRole('heading', { name: '成績分析' })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('heading', { name: '成績分析' })).toBeVisible()

    await page.goto('/app')
    await page.getByLabel('輸入課題或教學任務').fill('我想整 ppt')
    await page.getByRole('button', { name: '按內容開始處理' }).click()
    await expect(page).toHaveURL(/\/app\/work-slides$/)
    await page.goBack()
    await expect(page).toHaveURL(/\/app$/)
    await expect(page.getByRole('heading', { name: '今日想先完成什麼？' })).toBeVisible()
  })

  test('側欄支援教師常用別名搜尋', async ({ page }) => {
    await page.goto('/app')
    await page.getByRole('button', { name: '展開側欄' }).click()
    await page.getByRole('textbox', { name: '搜尋功能…' }).fill('PPT')
    await page.getByRole('button', { name: /簡報工作室/ }).click()

    await expect(page).toHaveURL(/\/app\/work-slides$/)
  })

  test('舊團隊邀請連結會轉到真正的接受工作區', async ({ page }) => {
    await page.goto('/app?invite=legacy-token')
    await expect(page).toHaveURL('/app/work-team?invite=legacy-token')
    await expect(page.getByRole('heading', { name: '科組協作' })).toBeVisible()
  })
})
