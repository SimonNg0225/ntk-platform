import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// ============================================================
//  無障礙 (a11y) 自動掃描 — axe-core
//  ------------------------------------------------------------
//  喺訪客模式逐個關鍵畫面跑 axe-core，攔截 WCAG 2.0 / 2.1 A & AA 違規。
//  只 fail 喺 serious / critical（避免 minor best-practice 噪音）。
//  ⚠️ 首次跑可能揭示既有問題（最常見：色對比 color-contrast）——
//     呢個正正係佢嘅價值：當係一份 a11y worklist 去逐步收。
//  前置：npm i -D @axe-core/playwright + npx playwright install chromium
// ============================================================

const PAGES = [
  { name: '行銷首頁', path: '/' },
  { name: '定價頁', path: '/pricing' },
  { name: '私隱政策', path: '/privacy' },
  { name: 'App 主畫面（訪客）', path: '/app' },
]

test.describe('無障礙 axe-core 掃描', () => {
  for (const { name, path } of PAGES) {
    test(`${name} 無 serious/critical a11y 違規`, async ({ page }) => {
      await page.goto(path)
      await page.waitForLoadState('networkidle')

      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

      const blocking = violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      )

      // 失敗時印出可讀清單（規則 id + 受影響節點數），方便定位修
      expect(
        blocking,
        blocking
          .map((v) => `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} 處)`)
          .join('\n') || '（無違規）',
      ).toEqual([])
    })
  }
})
