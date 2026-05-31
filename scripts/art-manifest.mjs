// ============================================================
//  插圖清單（art manifest）—— generate-art.mjs 會逐個生成。
//  ------------------------------------------------------------
//  每個 slot 對住一個真實 UI 位（空狀態 / 分類 header / hero /
//  健身分區），唔係隨機塞圖。動作庫每個動作嘅示意圖由 script
//  讀 fitness/library/data.ts 自動補上（唔使喺度逐個寫）。
//  風格統一：半扁平向量、海軍藍、克制專業、留白、白底、無字。
// ============================================================

export const STYLE =
  'Modern semi-flat vector illustration, clean and professional, ' +
  'navy blue (#2f6cb3) and slate-grey palette with subtle soft shading, ' +
  'generous negative space, flat white background, centered, ' +
  'no text, no words, no watermark, no logo, minimal and elegant.'

export const SLOTS = [
  // ── Hero / onboarding ──
  { name: 'hero-personal', prompt: 'a calm desk scene with a journal, plant and warm light, symbolising personal growth and daily life' },
  { name: 'hero-work', prompt: 'a tidy teacher workspace with books, a laptop and a coffee cup, symbolising productivity' },
  { name: 'onboarding-welcome', prompt: 'a friendly abstract scene of a person stepping onto an upward path with checkpoints' },

  // ── 空狀態插畫（各功能）──
  { name: 'empty-notes', prompt: 'an open blank notebook with a pen and a few floating sticky notes' },
  { name: 'empty-tasks', prompt: 'an empty checklist clipboard with a single unchecked box' },
  { name: 'empty-goals', prompt: 'a target with an arrow and a small mountain summit flag' },
  { name: 'empty-habits', prompt: 'a calendar grid with a small flame icon, symbolising a streak' },
  { name: 'empty-journal', prompt: 'a closed diary book with a bookmark and a small quill' },
  { name: 'empty-reading', prompt: 'a small stack of books with a bookmark, cosy reading theme' },
  { name: 'empty-flashcards', prompt: 'a stack of study flash cards with a brain icon' },
  { name: 'empty-calendar', prompt: 'a clean monthly calendar page with one highlighted day' },
  { name: 'empty-countdown', prompt: 'an hourglass beside a small calendar, symbolising counting down to a day' },
  { name: 'empty-budget', prompt: 'a wallet with coins and a small upward chart, personal finance theme' },
  { name: 'empty-gradebook', prompt: 'a report card with a bar chart and a pencil' },
  { name: 'empty-attendance', prompt: 'a class roster sheet with checkmarks' },
  { name: 'empty-classes', prompt: 'a small classroom with desks and a board' },
  { name: 'empty-quiz', prompt: 'a quiz paper with multiple-choice bubbles and a pencil' },
  { name: 'empty-search', prompt: 'a magnifying glass over scattered abstract cards' },
  { name: 'empty-meeting', prompt: 'a notepad with bullet points beside a small clock' },
  { name: 'empty-resources', prompt: 'an organised file folder with documents and a link icon' },
  { name: 'empty-health', prompt: 'a heart with a gentle pulse line and a water drop, wellness theme' },
  { name: 'empty-fitness', prompt: 'a dumbbell and a water bottle with a small progress chart' },
  { name: 'empty-ai', prompt: 'a friendly chat bubble with a small sparkle, AI assistant theme' },

  // ── 分類 / 分區 header ──
  { name: 'header-personal', prompt: 'a wide banner scene of books, a plant and a journal, personal life theme' },
  { name: 'header-work', prompt: 'a wide banner of a teacher desk with laptop, papers and chart' },
  { name: 'header-health', prompt: 'a wide banner with a heart pulse, water and sleep moon icons' },

  // ── 健身分區 tab 視覺 ──
  { name: 'fitness-body', prompt: 'a body composition scale with a small trend chart, body metrics theme' },
  { name: 'fitness-training', prompt: 'a barbell with a rising volume bar chart, strength training theme' },
  { name: 'fitness-nutrition', prompt: 'a balanced plate with protein, carbs and greens, and small macro rings' },
  { name: 'fitness-coach', prompt: 'a friendly AI coach figure beside a clipboard workout plan' },
  { name: 'fitness-library', prompt: 'an anatomical muscle chart of a human figure, exercise library theme' },

  // ── 成就 / 徽章 ──
  { name: 'badge-streak', prompt: 'a glowing flame medal badge, achievement theme' },
  { name: 'badge-pr', prompt: 'a trophy badge with a small barbell, personal record theme' },
  { name: 'badge-goal', prompt: 'a rosette ribbon badge with a checkmark, goal completed theme' },
]
