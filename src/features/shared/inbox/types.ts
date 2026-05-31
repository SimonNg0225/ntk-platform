// ============================================================
//  Inbox（GTD 快速擷取 + triage）功能專屬型別
//  ------------------------------------------------------------
//  共用 InboxItem（data/types）只有 text / mode / createdAt。
//  呢度用一個「並行 meta」集合（key = InboxItem.id）疊加 GTD
//  欄位，唔郁共用 schema，向後相容：冇 meta 嘅舊項目一律當
//  「未分類 · 未處理」。
// ============================================================

import type { Entity } from '../../../lib/store'

/** triage 分類（決定一鍵轉去邊度）*/
export type InboxKind = 'task' | 'note' | 'event' | 'question' | 'countdown' | 'reference'

/** 整理狀態：inbox（待處理）/ archived（已處理歸檔，可還原）*/
export type InboxStatus = 'inbox' | 'archived'

/** 每個 InboxItem 嘅附加 GTD meta（id 與 InboxItem 一致）*/
export interface InboxMeta extends Entity {
  // id === InboxItem.id
  kind?: InboxKind // 人手或 AI 建議嘅分類
  tags?: string[] // #標籤（由文字 parse 或人手）
  pinned?: boolean // 置頂
  status?: InboxStatus // 預設 inbox
  archivedAt?: string // 歸檔時間（ISO）
  convertedTo?: InboxKind // 轉咗去邊類（顯示用）
  convertedAt?: string // 轉換時間（ISO）
  aiKind?: InboxKind // AI 最近一次建議（同 kind 分開，方便標示「AI」）
  aiReason?: string // AI 建議理由（hover 顯示）
}

/** 轉換目標元資料（icon / 文案 / 對應功能 id）*/
export interface KindDef {
  id: InboxKind
  label: string
  short: string // 動詞短語：「轉做待辦」
  feature: string | null // useNav 目標功能 id（null = 唔提供跳轉）
}
