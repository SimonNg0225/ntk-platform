import { test, expect } from '@playwright/test'

test.describe('首次使用', () => {
  test('選擇任務後直接進入對應工作區', async ({ page }) => {
    await page.goto('/app')
    await expect(page.getByRole('heading', { name: '先完成今晚最急的一件事' })).toBeVisible()
    await page.getByPlaceholder('例如：百分比應用').fill('百分比應用')
    await page
      .getByRole('dialog', { name: '設定你的教學工作台' })
      .getByRole('button', { name: /出工作紙/ })
      .click()
    await page.getByRole('button', { name: '開始準備' }).click()

    await expect(page).toHaveURL(/\/app\/work-generate$/)
    await expect(page.getByRole('heading', { name: '教材生成' })).toBeVisible()
  })
})

// 進入產品（訪客模式）：App 外殼直接進入 AI-first 主界面
test.describe('產品外殼', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('ntk.onboarded_v1', '1')
      localStorage.setItem('ntk.cookieConsent', 'rejected')
    })
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

    await page
      .getByRole('button', { name: '出工作紙 / 小測 題目＋答案', exact: true })
      .click()
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

  test('首頁語音入口可用文字後備執行工具指令', async ({ page }) => {
    await page.goto('/app')
    await page.getByRole('button', { name: '打開語音助手' }).click()

    await expect(page).toHaveURL(/\/app\/work-voice-assistant$/)
    await expect(page.getByRole('heading', { name: 'Ezi 智能助手' })).toBeVisible()
    await expect(page.getByLabel('辨識語言')).toHaveValue('zh-HK')
    await expect(page.getByRole('button', { name: '聯絡客服' })).toHaveCount(0)

    await page.getByLabel('語音逐字稿或文字指令').fill('幫我整一份中二百分比簡報')
    await expect(page.getByText('將開啟：簡報工作室')).toBeVisible()
    await page.getByRole('button', { name: '開啟簡報工作室' }).click()

    await expect(page).toHaveURL(/\/app\/work-slides$/)
    await expect(page.getByRole('heading', { name: '簡報工作室' })).toBeVisible()
  })

  test('智能助手會先展示多步計劃，確認後寫入並可撤回', async ({ page }) => {
    await page.goto('/app/work-voice-assistant')
    await page
      .getByLabel('語音逐字稿或文字指令')
      .fill('準備中二百分比教案、工作紙和簡報，再提醒我完成')
    await page.getByRole('button', { name: '預覽執行計劃' }).click()

    await expect(page.getByRole('heading', { name: '我會分 2 步完成' })).toBeVisible()
    await expect(page.getByText('寫入資料前由你確認')).toBeVisible()
    await page.getByRole('button', { name: '確認並執行' }).click()

    await expect(page.getByText(/已新增 1 個項目/)).toBeVisible()
    await expect(page.getByRole('button', { name: '開啟課堂套裝' })).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(() =>
          (JSON.parse(localStorage.getItem('ntk.work_tasks') ?? '[]') as Array<{ text: string }>).some(
            (task) => task.text === '完成課堂套裝',
          ),
        ),
      )
      .toBe(true)

    await page.getByRole('button', { name: '撤回新增項目' }).click()
    await expect(page.getByText('已撤回剛才新增的待辦及日程。')).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(() =>
          (JSON.parse(localStorage.getItem('ntk.work_tasks') ?? '[]') as Array<{ text: string }>).some(
            (task) => task.text === '完成課堂套裝',
          ),
        ),
      )
      .toBe(false)
  })

  test('語音辨識會顯示可修改逐字稿，再執行任務', async ({ page }) => {
    await page.addInitScript(() => {
      class FakeSpeechRecognition {
        lang = ''
        continuous = false
        interimResults = false
        maxAlternatives = 1
        onstart: ((event: Event) => void) | null = null
        onresult: ((event: unknown) => void) | null = null
        onerror: ((event: unknown) => void) | null = null
        onend: ((event: Event) => void) | null = null

        start() {
          this.onstart?.(new Event('start'))
          window.setTimeout(() => {
            this.onresult?.({
              resultIndex: 0,
              results: [{ 0: { transcript: '幫我整一份中二百分比簡報' }, isFinal: true }],
            })
          }, 20)
        }

        stop() {
          this.onend?.(new Event('end'))
        }

        abort() {
          this.onend?.(new Event('end'))
        }
      }

      Object.defineProperty(window, 'SpeechRecognition', {
        configurable: true,
        value: FakeSpeechRecognition,
      })
    })

    await page.goto('/app/work-voice-assistant')
    await page.getByRole('button', { name: '開始語音輸入' }).first().click()
    await expect(page.getByLabel('語音逐字稿或文字指令')).toHaveValue(
      '幫我整一份中二百分比簡報',
    )
    await page.getByRole('button', { name: '停止聆聽' }).first().click()
    await page.getByLabel('語音逐字稿或文字指令').fill('幫我整一份中三百分比簡報')

    await expect(page.getByText('將開啟：簡報工作室')).toBeVisible()
    await page.getByRole('button', { name: '開啟簡報工作室' }).click()
    await expect(page).toHaveURL(/\/app\/work-slides$/)
  })

  test('一個課題可直接進入課堂套裝主流程', async ({ page }) => {
    await page.goto('/app')
    await page
      .getByLabel('輸入課題或教學任務')
      .fill('為「百分比應用」建立課堂套裝，包括教案、工作紙及簡報')
    await page.getByRole('button', { name: '按內容開始處理' }).click()

    await expect(page).toHaveURL(/\/app\/work-classroom-pack$/)
    await expect(page.getByRole('heading', { name: '課堂套裝' })).toBeVisible()
    await expect(page.getByLabel('課題*')).toHaveValue('百分比應用')
    await expect(page.getByLabel('課程依據')).toBeVisible()
  })

  test('文件深連結會回到指定教案的編輯位置', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'ntk.lesson_plans',
        JSON.stringify([
          {
            id: 'lesson-deep-link',
            title: '百分比應用教案',
            objectives: '能夠運用百分比解決生活問題',
            createdAt: '2026-07-14T08:00:00.000Z',
          },
        ]),
      )
      localStorage.setItem(
        'ntk.lesson_plan_meta',
        JSON.stringify([
          {
            id: 'lesson-deep-link',
            status: 'draft',
            phases: [],
            materials: [],
            updatedAt: '2026-07-14T08:00:00.000Z',
          },
        ]),
      )
    })

    await page.goto('/app/work-lesson-plan?item=lesson-deep-link')
    await expect(page.getByRole('heading', { name: '百分比應用教案' })).toBeVisible()
    await expect(page.getByRole('button', { name: '儲存' })).toBeVisible()
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
