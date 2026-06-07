import type { LucideIcon } from 'lucide-react'
import {
  BarChart3, Bot, Sparkles, NotebookPen, Brain, BookOpen, Target, Flame, Timer,
  BookText, Compass, ClipboardList, CalendarDays, Puzzle, FolderOpen, School,
  TrendingUp, Hand, Phone, CheckSquare, StickyNote, Wallet, Calendar, Search,
  Inbox, Hourglass, GraduationCap, Briefcase, Home, Settings, User, Construction,
  PartyPopper, Trophy, TrendingDown, Users, Palmtree, AlarmClock, Pin, Ban, Mail,
  Handshake, MessageSquare, FileText, Link, Clapperboard, BookMarked, Bookmark,
  Dumbbell, Zap, RotateCcw, Printer, Download, Lock, HelpCircle, Sprout, Star,
  Receipt, Tag, HeartPulse,
} from 'lucide-react'

// ============================================================
//  emoji → lucide 線性圖示對應（由設計系統規格落實）
//  - 用喺導航 / 功能卡 / 標題等「介面」位置，令外觀專業統一。
//  - 用戶自選 emoji（記帳分類 / 習慣 / 心情）刻意唔放呢度，保留 emoji。
//  - 解析唔到就回 null，呼叫方 fallback 顯示返原 emoji（向後相容）。
// ============================================================

const EMOJI_TO_ICON: Record<string, LucideIcon> = {
  '📊': BarChart3,
  '🤖': Bot,
  '✨': Sparkles,
  '📝': NotebookPen,
  '🧠': Brain,
  '📖': BookOpen,
  '🎯': Target,
  '🔥': Flame,
  '⏱️': Timer,
  '⏱': Timer,
  '🍅': Timer,
  '📓': BookText,
  '📔': BookText,
  '🧭': Compass,
  '📋': ClipboardList,
  '🗓️': CalendarDays,
  '🗓': CalendarDays,
  '🧩': Puzzle,
  '🗂️': FolderOpen,
  '🗂': FolderOpen,
  '🏫': School,
  '📈': TrendingUp,
  '🙋': Hand,
  '👋': Hand,
  '📞': Phone,
  '✅': CheckSquare,
  '🗒️': StickyNote,
  '🗒': StickyNote,
  '💰': Wallet,
  '📅': Calendar,
  '🔍': Search,
  '📥': Inbox,
  '⏳': Hourglass,
  '📘': GraduationCap,
  '🧑‍🎓': GraduationCap,
  '💼': Briefcase,
  '🏠': Home,
  '⚙️': Settings,
  '⚙': Settings,
  '👤': User,
  '🚧': Construction,
  '🎉': PartyPopper,
  '🏆': Trophy,
  '📉': TrendingDown,
  '👥': Users,
  '🌴': Palmtree,
  '⏰': AlarmClock,
  '📌': Pin,
  '🚫': Ban,
  '✉️': Mail,
  '✉': Mail,
  '🤝': Handshake,
  '💬': MessageSquare,
  '🗨️': MessageSquare,
  '📄': FileText,
  '🔗': Link,
  '🎬': Clapperboard,
  '📚': BookMarked,
  '🔖': Bookmark,
  '💪': Dumbbell,
  '🏋️': Dumbbell,
  '🫀': HeartPulse,
  '⚡': Zap,
  '🔄': RotateCcw,
  '🖨': Printer,
  '🖨️': Printer,
  '⬇': Download,
  '⬇️': Download,
  '🔒': Lock,
  '🤔': HelpCircle,
  '🌱': Sprout,
  '⭐': Star,
  '🧾': Receipt,
  '🏷️': Tag,
  '🏷': Tag,
}

/** emoji → lucide 圖示元件；冇對應就回 null（呼叫方 fallback 顯示 emoji）。 */
export function iconForFeature(emoji: string): LucideIcon | null {
  return EMOJI_TO_ICON[emoji] ?? null
}

/**
 * 統一渲染功能 / 介面圖示：有 lucide 對應就用線性圖示，
 * 否則 fallback 顯示原 emoji（例如用戶自選嗰啲）。
 */
export function FeatureIcon({
  icon,
  size = 18,
  className,
  strokeWidth = 1.75, // 機構級：幼線（lucide 預設 2 偏粗），全 app 統一精煉外觀
}: {
  icon: string
  size?: number
  className?: string
  strokeWidth?: number
}) {
  const Cmp = iconForFeature(icon)
  if (Cmp)
    return (
      <Cmp size={size} strokeWidth={strokeWidth} className={className} aria-hidden />
    )
  return (
    <span className={className} aria-hidden>
      {icon}
    </span>
  )
}
