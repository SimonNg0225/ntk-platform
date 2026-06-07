import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import "./parentComms/i18n";
import { createCollection, uid, useCollection } from "../../lib/store";
import {
  parentCommsCol,
  classesCol,
  studentsCol,
} from "../../data/collections";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  Menu,
  SectionTitle,
  SegmentedControl,
  Select,
  Table,
  Tabs,
  Tbody,
  Td,
  Th,
  Thead,
  Tooltip,
  Tr,
  cx,
} from "../../ui";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Bell,
  BookText,
  CalendarClock,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Clock,
  Contact,
  Download,
  FileText,
  Filter,
  Handshake,
  Hourglass,
  Inbox,
  LayoutList,
  Mail,
  MailCheck,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  Search,
  Send,
  Smartphone,
  Trash2,
  TrendingUp,
  Users,
  UserX,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import CommEditor, { type SaveResult } from "./parentComms/CommEditor";
import TemplateManager from "./parentComms/TemplateManager";
import {
  ChannelDonut,
  CategoryBars,
  MonthlyTrendChart,
  OutcomeBars,
  TopStudentsBars,
} from "./parentComms/Charts";
import {
  BUCKET_LABEL,
  BUCKET_TONE,
  BUILTIN_TEMPLATES,
  CATEGORY_LABEL,
  CATEGORY_STYLE,
  DEFAULT_CONTACT_GAP_DAYS,
  DIRECTION_LABEL,
  OUTCOME_LABEL,
  OUTCOME_STYLE,
  buildOverview,
  contactGaps,
  countByCategory,
  countByChannel,
  countByOutcome,
  downloadCsv,
  followUpBucket,
  longDateLabel,
  monthlyTrend,
  planFollowUpReschedule,
  relativeDayLabel,
  shiftKey,
  shortDateLabel,
  sortRows,
  summarizeByStudent,
  todayKey,
  type Category,
  type CommMeta,
  type CommRow,
  type CommTemplate,
  type ContactGap,
  type ContactGapStatus,
  type FollowUpBucket,
  type SortDir,
  type SortKey,
} from "./parentComms/util";

// ============================================================
//  家長 / 學生溝通記錄 — 老師專用「溝通 CRM」
//  ------------------------------------------------------------
//  參考真實 CRM 嘅活動時間線 + 跟進管道（HubSpot / Salesforce），
//  改造成老師對家長 / 學生嘅情境：
//   · 多視圖：時間線 / 表格（批量）/ 學生名冊 / 統計分析
//   · 跟進管道：到期日、逾期偵測、今日 / 本週 / 逾期分桶、一鍵完成
//   · 訊息範本、進階篩選 + 全文搜尋、自製 SVG 圖表、CSV 匯出
//
//  共用 parentCommsCol 維持原欄位（向後相容）；進階 metadata 同範本
//  放喺本功能自己嘅本地集合，完全唔改 data/collections.ts。
// ============================================================

// 本功能專屬本地集合（一對一掛鈎 ParentComm + 範本）
const metaCol = createCollection<CommMeta>("parent_comm_meta", []);
const templatesCol = createCollection<CommTemplate>(
  "parent_comm_templates",
  BUILTIN_TEMPLATES.map((t) => ({
    ...t,
    id: uid(),
    createdAt: new Date().toISOString(),
  })),
);

const CHANNEL_ICON: Record<string, LucideIcon> = {
  電話: Phone,
  電郵: Mail,
  面談: Handshake,
  手冊: BookText,
  訊息: Smartphone,
};

type ViewTab = "timeline" | "table" | "students" | "analytics";
const TABS_DEF: { id: ViewTab; key: string; zh: string }[] = [
  { id: "timeline", key: "parent.tabTimeline", zh: "往來書信" },
  { id: "table", key: "parent.tabTable", zh: "通訊錄" },
  { id: "students", key: "parent.tabStudents", zh: "聯絡人" },
  { id: "analytics", key: "parent.tabAnalytics", zh: "統計" },
];
const TAB_ICONS: Record<ViewTab, LucideIcon> = {
  timeline: Mail,
  table: LayoutList,
  students: Contact,
  analytics: BarChart3,
};

type FollowFilter = "all" | "open" | "overdue" | "done";

// 小幫手：以 enum key 翻譯顯示 label，zh-HK 用原文做 defaultValue（byte-identical）
function useParentLabels() {
  const { t } = useTranslation();
  return {
    t,
    category: (c: Category) =>
      t(`parent.category.${c}`, { defaultValue: CATEGORY_LABEL[c] }),
    outcome: (o: keyof typeof OUTCOME_LABEL) =>
      t(`parent.outcome.${o}`, { defaultValue: OUTCOME_LABEL[o] }),
    bucket: (b: FollowUpBucket) =>
      t(`parent.bucket.${b}`, { defaultValue: BUCKET_LABEL[b] }),
  };
}

// ============================================================
//  通訊錄概念語言（書信 / 往來信箋）
//  ------------------------------------------------------------
//  將「溝通記錄」重塑成老師同家長嘅往來書信：發函（主動）/ 來函
//  （家長來訊），時間線似一疊有日子印戳嘅信件，統計帶似信封背面
//  嘅摘要。純表現層 —— 全部資料 / handler / export 不變。
// ============================================================

// 區段小帽（uppercase kicker + icon）—— 統一頁內節奏（對齊 bespoke 參考）
function SectionLabel({
  icon: I,
  children,
  right,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-0.5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
        <I size={13} className="shrink-0" />
        {children}
      </p>
      {right}
    </div>
  );
}

// 信摘格（hairline grid · serif 大數字；要點達標時 hot 高亮）
function LedgerStat({
  label,
  value,
  unit,
  hint,
  icon: I,
  hot,
}: {
  label: string;
  value: number | string;
  unit?: string;
  hint?: string;
  icon: LucideIcon;
  hot?: boolean;
}) {
  return (
    <div
      className={cx(
        "px-3.5 py-3.5 transition-colors sm:px-4",
        hot ? "bg-accent-soft dark:bg-accent/15" : "bg-white dark:bg-slate-800",
      )}
    >
      <p
        className={cx(
          "flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide",
          hot
            ? "text-accent-strong/80 dark:text-accent/80"
            : "text-slate-400 dark:text-slate-500",
        )}
      >
        <I size={12} className="shrink-0" />
        <span className="truncate">{label}</span>
      </p>
      <p
        className={cx(
          "mt-1 font-serif text-[26px] font-semibold leading-none tabular-nums slashed-zero",
          hot
            ? "text-accent-strong dark:text-accent"
            : "text-slate-800 dark:text-slate-100",
        )}
      >
        {value}
        {unit && (
          <span className="ml-1 font-sans text-sm font-normal text-slate-400">
            {unit}
          </span>
        )}
      </p>
      {hint && (
        <p className="mt-1 truncate text-[11px] text-slate-400 dark:text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}

export default function ParentComms() {
  const comms = useCollection(parentCommsCol);
  const metas = useCollection(metaCol);
  const templates = useCollection(templatesCol);
  const classes = useCollection(classesCol);
  const students = useCollection(studentsCol);
  const toast = useToast();
  const confirm = useConfirm();
  const { t } = useTranslation();

  const [tab, setTab] = useState<ViewTab>("timeline");

  // 編輯器
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CommRow | null>(null);
  // 由「需聯絡」名單一鍵起草時，預填班別 / 學生
  const [preset, setPreset] = useState<{
    classId: string;
    studentId: string;
  } | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  // 篩選 / 搜尋
  const [query, setQuery] = useState("");
  const [filterClassId, setFilterClassId] = useState("");
  const [filterStudentId, setFilterStudentId] = useState("");
  const [filterChannel, setFilterChannel] = useState("");
  const [filterCategory, setFilterCategory] = useState<Category | "">("");
  const [followFilter, setFollowFilter] = useState<FollowFilter>("all");
  const [showFilters, setShowFilters] = useState(false);

  // 表格排序 + 批量
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const today = todayKey();

  const classMap = useMemo(
    () => new Map(classes.map((c) => [c.id, c])),
    [classes],
  );
  const studentMap = useMemo(
    () => new Map(students.map((s) => [s.id, s])),
    [students],
  );
  const metaByComm = useMemo(() => {
    const m = new Map<string, CommMeta>();
    for (const meta of metas) m.set(meta.commId, meta);
    return m;
  }, [metas]);

  // 全部 row（comm + meta）
  const allRows: CommRow[] = useMemo(
    () => comms.map((comm) => ({ comm, meta: metaByComm.get(comm.id) })),
    [comms, metaByComm],
  );

  const nameOf = (r: CommRow) => {
    const cls = classMap.get(r.comm.classId)?.name ?? "未知班別";
    const stu = r.comm.studentId
      ? studentMap.get(r.comm.studentId)?.name
      : undefined;
    return stu ? `${cls}・${stu}` : cls;
  };

  const filterStudents = useMemo(
    () =>
      filterClassId ? students.filter((s) => s.classId === filterClassId) : [],
    [students, filterClassId],
  );

  // 套用搜尋 + 篩選
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allRows.filter(({ comm, meta }) => {
      if (filterClassId && comm.classId !== filterClassId) return false;
      if (filterStudentId && comm.studentId !== filterStudentId) return false;
      if (filterChannel && comm.channel !== filterChannel) return false;
      if (filterCategory && meta?.category !== filterCategory) return false;
      if (followFilter === "open" && !comm.followUp) return false;
      if (followFilter === "done" && comm.followUp) return false;
      if (followFilter === "overdue") {
        if (
          !comm.followUp ||
          followUpBucket(meta?.followUpDate, today) !== "overdue"
        )
          return false;
      }
      if (q) {
        const hay = [
          comm.summary,
          comm.channel,
          meta?.contactName ?? "",
          meta?.followUpNote ?? "",
          classMap.get(comm.classId)?.name ?? "",
          comm.studentId ? (studentMap.get(comm.studentId)?.name ?? "") : "",
          meta?.category ? CATEGORY_LABEL[meta.category] : "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    allRows,
    query,
    filterClassId,
    filterStudentId,
    filterChannel,
    filterCategory,
    followFilter,
    today,
    classMap,
    studentMap,
  ]);

  const overview = useMemo(
    () => buildOverview(allRows, today),
    [allRows, today],
  );

  // 跟進管道（未完成）分桶
  const followUps = useMemo(() => {
    const open = allRows.filter((r) => r.comm.followUp);
    const buckets: Record<FollowUpBucket, CommRow[]> = {
      overdue: [],
      today: [],
      soon: [],
      later: [],
      nodate: [],
    };
    for (const r of open)
      buckets[followUpBucket(r.meta?.followUpDate, today)].push(r);
    const byDate = (a: CommRow, b: CommRow) =>
      (a.meta?.followUpDate ?? "zzzz").localeCompare(
        b.meta?.followUpDate ?? "zzzz",
      );
    for (const k of Object.keys(buckets) as FollowUpBucket[])
      buckets[k].sort(byDate);
    return buckets;
  }, [allRows, today]);

  const activeFilterCount =
    (filterClassId ? 1 : 0) +
    (filterStudentId ? 1 : 0) +
    (filterChannel ? 1 : 0) +
    (filterCategory ? 1 : 0) +
    (followFilter !== "all" ? 1 : 0);

  // ───────── 寫入：新增 / 更新 ─────────
  const handleSave = (result: SaveResult, editingId: string | null) => {
    if (editingId) {
      parentCommsCol.update(editingId, result.comm);
      writeMeta(editingId, result.meta);
      toast.success(t("parent.toastUpdated", { defaultValue: "已更新信件" }));
    } else {
      const created = parentCommsCol.add(result.comm);
      writeMeta(created.id, result.meta);
      toast.success(t("parent.toastSaved", { defaultValue: "已記低呢封信件" }));
    }
    setEditorOpen(false);
    setEditing(null);
  };

  const writeMeta = (
    commId: string,
    patch: Omit<CommMeta, "id" | "commId" | "updatedAt">,
  ) => {
    const existing = metaCol.get().find((m) => m.commId === commId);
    const updatedAt = new Date().toISOString();
    if (existing) metaCol.update(existing.id, { ...patch, updatedAt });
    else metaCol.add({ commId, ...patch, updatedAt });
  };

  const openNew = () => {
    setEditing(null);
    setPreset(null);
    setEditorOpen(true);
  };
  const openEdit = (r: CommRow) => {
    setEditing(r);
    setEditorOpen(true);
  };

  const removeComm = async (r: CommRow) => {
    const ok = await confirm({
      title: t("parent.confirmDeleteTitle", { defaultValue: "刪除呢封信件？" }),
      message: t("parent.confirmDeleteMsg", {
        name: nameOf(r),
        date: r.comm.date,
        defaultValue: `${nameOf(r)}（${r.comm.date}）嘅往來記錄將會永久刪除，無法復原。`,
      }),
      confirmText: t("parent.confirmDelete", { defaultValue: "刪除" }),
      tone: "danger",
    });
    if (!ok) return;
    parentCommsCol.remove(r.comm.id);
    if (r.meta) metaCol.remove(r.meta.id);
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(r.comm.id);
      return next;
    });
    toast.success(t("parent.toastDeleted", { defaultValue: "已刪除信件" }));
  };

  const toggleFollowUp = (r: CommRow) => {
    const next = !r.comm.followUp;
    parentCommsCol.update(r.comm.id, { followUp: next });
    if (next)
      toast.info(
        t("parent.toastReopened", { defaultValue: "已重新標記為待回覆" }),
      );
    else
      toast.success(
        t("parent.toastMarkedReplied", { defaultValue: "已標記為已回覆" }),
      );
  };

  // ───────── 範本 ─────────
  const addTemplate = (
    draft: Omit<CommTemplate, "id" | "createdAt" | "builtIn">,
  ) => {
    templatesCol.add({ ...draft, createdAt: new Date().toISOString() });
    toast.success(
      t("parent.toastTemplateAdded", { defaultValue: "已新增範本" }),
    );
  };
  const updateTemplate = (
    id: string,
    draft: Omit<CommTemplate, "id" | "createdAt" | "builtIn">,
  ) => {
    templatesCol.update(id, draft);
    toast.success(
      t("parent.toastTemplateUpdated", { defaultValue: "已更新範本" }),
    );
  };
  const removeTemplate = async (tpl: CommTemplate) => {
    const ok = await confirm({
      title: t("parent.confirmDeleteTemplateTitle", {
        defaultValue: "刪除範本？",
      }),
      message: t("parent.confirmDeleteTemplateMsg", {
        title: tpl.title,
        defaultValue: `「${tpl.title}」會被刪除。`,
      }),
      confirmText: t("parent.confirmDelete", { defaultValue: "刪除" }),
      tone: "danger",
    });
    if (!ok) return;
    templatesCol.remove(tpl.id);
    toast.success(
      t("parent.toastTemplateDeleted", { defaultValue: "已刪除範本" }),
    );
  };

  // ───────── 批量（表格） ─────────
  const visibleIds = filteredRows.map((r) => r.comm.id);
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const toggleSelectAll = () => {
    setSelected((prev) => {
      if (allSelected) {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      }
      return new Set([...prev, ...visibleIds]);
    });
  };
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectedRows = filteredRows.filter((r) => selected.has(r.comm.id));

  const batchMarkDone = () => {
    let n = 0;
    for (const r of selectedRows)
      if (r.comm.followUp) {
        parentCommsCol.update(r.comm.id, { followUp: false });
        n += 1;
      }
    setSelected(new Set());
    toast.success(
      n > 0
        ? t("parent.toastBatchDone", {
            count: n,
            defaultValue: `已標記 ${n} 封為已回覆`,
          })
        : t("parent.toastBatchNoneOpen", { defaultValue: "所選信件冇待回覆" }),
    );
  };
  const batchReschedule = (targetDate: string | undefined) => {
    const plan = planFollowUpReschedule(selectedRows, targetDate);
    if (plan.changes.length === 0) {
      toast.info(
        t("parent.toastRescheduleSame", {
          defaultValue: "所選信件已經係呢個回覆狀態",
        }),
      );
      return;
    }
    const updatedAt = new Date().toISOString();
    for (const ch of plan.changes) {
      if (ch.setFollowUp) parentCommsCol.update(ch.commId, { followUp: true });
      // 只改 followUpDate，保留其餘 meta 欄位；冇 meta 先建立
      if (ch.metaId)
        metaCol.update(ch.metaId, { followUpDate: ch.followUpDate, updatedAt });
      else
        metaCol.add({
          commId: ch.commId,
          followUpDate: ch.followUpDate,
          updatedAt,
        });
    }
    setSelected(new Set());
    if (targetDate === undefined)
      toast.success(
        t("parent.toastClearedDue", {
          count: plan.changes.length,
          defaultValue: `已清除 ${plan.changes.length} 封嘅回覆到期日`,
        }),
      );
    else {
      const parts: string[] = [];
      if (plan.scheduled > 0)
        parts.push(
          t("parent.rescheduleScheduled", {
            count: plan.scheduled,
            defaultValue: `排期 ${plan.scheduled} 封`,
          }),
        );
      if (plan.reopened > 0)
        parts.push(
          t("parent.rescheduleReopened", {
            count: plan.reopened,
            defaultValue: `重開 ${plan.reopened} 封`,
          }),
        );
      const joined =
        parts.join("、") ||
        t("parent.rescheduleUpdated", { defaultValue: "已更新" });
      toast.success(
        t("parent.toastReschedulePart", {
          date: shortDateLabel(targetDate),
          parts: joined,
          defaultValue: `回覆到期日 ${shortDateLabel(targetDate)}：${joined}`,
        }),
      );
    }
  };
  const batchDelete = async () => {
    const ok = await confirm({
      title: t("parent.confirmBatchDeleteTitle", {
        count: selectedRows.length,
        defaultValue: `刪除 ${selectedRows.length} 封信件？`,
      }),
      message: t("parent.confirmBatchDeleteMsg", {
        defaultValue: "呢個動作無法復原。",
      }),
      confirmText: t("parent.confirmDelete", { defaultValue: "刪除" }),
      tone: "danger",
    });
    if (!ok) return;
    for (const r of selectedRows) {
      parentCommsCol.remove(r.comm.id);
      if (r.meta) metaCol.remove(r.meta.id);
    }
    setSelected(new Set());
    toast.success(
      t("parent.toastBatchDeleted", { defaultValue: "已刪除所選信件" }),
    );
  };

  // ───────── CSV 匯出 ─────────
  const exportCsv = (rows: CommRow[]) => {
    if (rows.length === 0) {
      toast.error(
        t("parent.toastNoExport", { defaultValue: "冇可匯出嘅信件" }),
      );
      return;
    }
    const header = [
      t("parent.csvDate", { defaultValue: "日期" }),
      t("parent.csvClass", { defaultValue: "班別" }),
      t("parent.csvStudent", { defaultValue: "學生" }),
      t("parent.csvDirection", { defaultValue: "方向" }),
      t("parent.csvChannel", { defaultValue: "聯絡方式" }),
      t("parent.csvTopic", { defaultValue: "主題" }),
      t("parent.csvOutcome", { defaultValue: "觀感" }),
      t("parent.csvContact", { defaultValue: "聯絡人" }),
      t("parent.csvSummary", { defaultValue: "內容摘要" }),
      t("parent.csvNeedFollow", { defaultValue: "需跟進" }),
      t("parent.csvFollowDue", { defaultValue: "跟進到期" }),
      t("parent.csvFollowTodo", { defaultValue: "跟進待辦" }),
    ];
    const body = sortRows(rows, "date", "desc", nameOf).map(
      ({ comm, meta }) => [
        comm.date,
        classMap.get(comm.classId)?.name ?? "",
        comm.studentId ? (studentMap.get(comm.studentId)?.name ?? "") : "",
        meta?.direction ? DIRECTION_LABEL[meta.direction] : "主動聯絡",
        comm.channel,
        meta?.category ? CATEGORY_LABEL[meta.category] : "",
        meta?.outcome ? OUTCOME_LABEL[meta.outcome] : "",
        meta?.contactName ?? "",
        comm.summary,
        comm.followUp ? "是" : "否",
        meta?.followUpDate ?? "",
        meta?.followUpNote ?? "",
      ],
    );
    downloadCsv(`家長溝通記錄_${today}.csv`, [header, ...body]);
    toast.success(
      t("parent.toastExported", {
        count: rows.length,
        defaultValue: `已匯出 ${rows.length} 封信件`,
      }),
    );
  };

  const clearFilters = () => {
    setFilterClassId("");
    setFilterStudentId("");
    setFilterChannel("");
    setFilterCategory("");
    setFollowFilter("all");
    setQuery("");
  };

  const monthTrendUp =
    overview.lastMonth === 0
      ? overview.thisMonth > 0
      : overview.thisMonth >= overview.lastMonth;

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      {/* ───────── 通訊錄 masthead：信箋封面感（kicker + serif 標題 + 郵戳裝飾）───────── */}
      <header className="relative animate-fade-in-up overflow-hidden rounded-3xl border border-slate-200/80 bg-white px-5 py-5 shadow-xs dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none sm:px-7 sm:py-6">
        {/* 右上「郵戳」裝飾（純裝飾，唔搶主次） */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-7 top-4 hidden -rotate-[8deg] select-none flex-col items-center rounded-full border-2 border-dashed border-accent/20 px-5 py-3 font-serif text-[10px] font-semibold uppercase tracking-[0.3em] text-accent/25 dark:border-accent/25 dark:text-accent/25 sm:flex"
        >
          <Send size={16} className="mb-0.5" />
          {t("parent.mastheadStamp", { defaultValue: "家校通訊" })}
        </span>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
              <Mail size={13} />
              {t("parent.kicker", { defaultValue: "通訊錄" })} · Correspondence
            </p>
            <h1 className="mt-1.5 font-serif text-[28px] font-semibold leading-none tracking-tight text-slate-800 dark:text-slate-100 sm:text-[34px]">
              {t("parent.title", { defaultValue: "家長溝通" })}
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="tabular-nums">
                {t("parent.summaryLine", {
                  total: overview.total,
                  contacted: overview.contactedStudents,
                  defaultValue: `往來 ${overview.total} 封 · 已聯絡 ${overview.contactedStudents} 位家長`,
                })}
              </span>
              {overview.openFollowUps > 0 && (
                <>
                  <span
                    aria-hidden
                    className="text-slate-300 dark:text-slate-600"
                  >
                    ·
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium text-accent-strong dark:text-accent">
                    <Hourglass size={12} />{" "}
                    {t("parent.openFollowUps", {
                      count: overview.openFollowUps,
                      defaultValue: `${overview.openFollowUps} 封待回覆`,
                    })}
                  </span>
                </>
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Menu
              align="end"
              trigger={
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                  {t("parent.menuMore", { defaultValue: "更多" })}
                  <ChevronDown size={15} />
                </span>
              }
              items={[
                {
                  id: "templates",
                  label: t("parent.menuTemplates", {
                    defaultValue: "信件範本",
                  }),
                  icon: FileText,
                  onSelect: () => setTemplatesOpen(true),
                },
                {
                  id: "export-filtered",
                  label: t("parent.menuExportFiltered", {
                    defaultValue: "匯出目前列表（CSV）",
                  }),
                  icon: Download,
                  onSelect: () => exportCsv(filteredRows),
                },
                {
                  id: "export-all",
                  label: t("parent.menuExportAll", {
                    defaultValue: "匯出全部（CSV）",
                  }),
                  icon: Download,
                  onSelect: () => exportCsv(allRows),
                },
              ]}
            />
            <Button onClick={openNew} icon={Plus}>
              {t("parent.compose", { defaultValue: "寫一封" })}
            </Button>
          </div>
        </div>
        {/* 信箋雙線（封面分隔感） */}
        <div className="mt-5 space-y-1" aria-hidden>
          <span className="block h-px bg-slate-200/90 dark:bg-slate-700/70" />
          <span className="block h-px bg-slate-200/60 dark:bg-slate-700/40" />
        </div>
      </header>

      {/* ───────── 通訊摘要：hairline grid · serif 大數字 ───────── */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-slate-200/70 ring-1 ring-slate-200/80 dark:bg-slate-700/50 dark:ring-slate-700/60 lg:grid-cols-4">
        <LedgerStat
          label={t("parent.statTotalLabel", { defaultValue: "往來總數" })}
          value={overview.total}
          unit={t("parent.unitLetters", { defaultValue: "封" })}
          icon={Mail}
          hint={t("parent.statTotalHint", { defaultValue: "累積溝通信件" })}
        />
        <LedgerStat
          label={t("parent.statMonthLabel", { defaultValue: "本月往來" })}
          value={overview.thisMonth}
          unit={t("parent.unitLetters", { defaultValue: "封" })}
          icon={TrendingUp}
          hint={
            monthTrendUp
              ? t("parent.statMonthHintUp", {
                  last: overview.lastMonth,
                  defaultValue: `較上月 ${overview.lastMonth} 封持平／上升`,
                })
              : t("parent.statMonthHintDown", {
                  last: overview.lastMonth,
                  defaultValue: `上月 ${overview.lastMonth} 封`,
                })
          }
        />
        <LedgerStat
          label={t("parent.statOpenLabel", { defaultValue: "待回覆" })}
          value={overview.openFollowUps}
          unit={t("parent.unitLetters", { defaultValue: "封" })}
          icon={Hourglass}
          hint={
            overview.overdue > 0
              ? t("parent.statOpenHintOverdue", {
                  count: overview.overdue,
                  defaultValue: `${overview.overdue} 封逾期未覆`,
                })
              : t("parent.statOpenHintNone", { defaultValue: "暫無逾期" })
          }
          hot={overview.openFollowUps > 0}
        />
        <LedgerStat
          label={t("parent.statPositiveLabel", { defaultValue: "正面回響" })}
          value={
            overview.positiveRate == null ? "—" : `${overview.positiveRate}%`
          }
          unit={overview.positiveRate == null ? undefined : ""}
          icon={CheckCheck}
          hint={
            overview.positiveRate == null
              ? t("parent.statPositiveHintNone", {
                  defaultValue: "仲未標記觀感",
                })
              : t("parent.statPositiveHintSome", {
                  defaultValue: "佔有觀感記錄",
                })
          }
        />
      </section>

      {/* 跟進管道（有未完成先顯示） */}
      {overview.openFollowUps > 0 && (
        <FollowUpPanel
          buckets={followUps}
          nameOf={nameOf}
          today={today}
          onToggle={toggleFollowUp}
          onEdit={openEdit}
        />
      )}

      {/* 視圖切換 */}
      <Tabs
        tabs={TABS_DEF.map((tb) => ({
          id: tb.id,
          label: t(tb.key, { defaultValue: tb.zh }),
        }))}
        active={tab}
        onChange={setTab}
        icons={TAB_ICONS}
      />

      {/* 搜尋 + 篩選列（時間線 / 表格 / 學生 共用） */}
      {tab !== "analytics" && (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex-1">
              <Input
                icon={Search}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("parent.searchPlaceholder", {
                  defaultValue: "搜尋信件內容、學生、聯絡人…",
                })}
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              aria-controls="parent-comms-filters"
              className={cx(
                "inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                showFilters || activeFilterCount > 0
                  ? "border-accent/40 bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700",
              )}
            >
              <Filter size={15} />
              {t("parent.filters", { defaultValue: "篩選" })}
              {activeFilterCount > 0 && (
                <span className="ml-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold tabular-nums text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {showFilters && (
            <Card className="space-y-3 p-3 sm:p-4">
              <div
                id="parent-comms-filters"
                className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
              >
                <LabeledSelect
                  label={t("parent.filterClass", { defaultValue: "班別" })}
                  value={filterClassId}
                  onChange={(v) => {
                    setFilterClassId(v);
                    setFilterStudentId("");
                  }}
                >
                  <option value="">
                    {t("parent.filterAllClasses", { defaultValue: "全部班別" })}
                  </option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </LabeledSelect>
                <LabeledSelect
                  label={t("parent.filterStudent", { defaultValue: "學生" })}
                  value={filterStudentId}
                  disabled={!filterClassId}
                  onChange={setFilterStudentId}
                >
                  <option value="">
                    {filterClassId
                      ? t("parent.filterAllStudents", {
                          defaultValue: "全部學生",
                        })
                      : t("parent.filterPickClassFirst", {
                          defaultValue: "先揀班別",
                        })}
                  </option>
                  {filterStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </LabeledSelect>
                <LabeledSelect
                  label={t("parent.filterChannel", {
                    defaultValue: "聯絡方式",
                  })}
                  value={filterChannel}
                  onChange={setFilterChannel}
                >
                  <option value="">
                    {t("parent.filterAllChannels", {
                      defaultValue: "全部方式",
                    })}
                  </option>
                  {Object.keys(CHANNEL_ICON).map((ch) => (
                    <option key={ch} value={ch}>
                      {ch}
                    </option>
                  ))}
                </LabeledSelect>
                <LabeledSelect
                  label={t("parent.filterCategory", { defaultValue: "主題" })}
                  value={filterCategory}
                  onChange={(v) => setFilterCategory(v as Category | "")}
                >
                  <option value="">
                    {t("parent.filterAllCategories", {
                      defaultValue: "全部主題",
                    })}
                  </option>
                  {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
                    <option key={c} value={c}>
                      {t(`parent.category.${c}`, {
                        defaultValue: CATEGORY_LABEL[c],
                      })}
                    </option>
                  ))}
                </LabeledSelect>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {t("parent.replyLabel", { defaultValue: "回覆" })}
                  </span>
                  <SegmentedControl<FollowFilter>
                    size="sm"
                    value={followFilter}
                    onChange={setFollowFilter}
                    options={[
                      {
                        id: "all",
                        label: t("parent.replyAll", { defaultValue: "全部" }),
                      },
                      {
                        id: "open",
                        label: t("parent.replyOpen", {
                          defaultValue: "待回覆",
                        }),
                      },
                      {
                        id: "overdue",
                        label: t("parent.replyOverdue", {
                          defaultValue: "逾期",
                        }),
                      },
                      {
                        id: "done",
                        label: t("parent.replyDone", {
                          defaultValue: "已回覆",
                        }),
                      },
                    ]}
                  />
                </div>
                {(activeFilterCount > 0 || query) && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex items-center gap-1 self-start text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    <X size={13} />
                    {t("parent.clearFilters", { defaultValue: "清除全部篩選" })}
                  </button>
                )}
              </div>
            </Card>
          )}

          <p
            className="text-xs text-slate-400 dark:text-slate-500"
            aria-live="polite"
          >
            {t("parent.showingCount", {
              shown: filteredRows.length,
              total: allRows.length,
              defaultValue: `顯示 ${filteredRows.length} / ${allRows.length} 封信件`,
            })}
          </p>
        </div>
      )}

      {/* ───────── 視圖內容 ───────── */}
      {tab === "timeline" && (
        <TimelineView
          rows={filteredRows}
          totalAll={allRows.length}
          nameOf={nameOf}
          today={today}
          onEdit={openEdit}
          onRemove={removeComm}
          onToggle={toggleFollowUp}
          onNew={openNew}
        />
      )}

      {tab === "table" && (
        <TableView
          rows={sortRows(filteredRows, sortKey, sortDir, nameOf)}
          nameOf={nameOf}
          today={today}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={(k) => {
            if (k === sortKey)
              setSortDir((d) => (d === "asc" ? "desc" : "asc"));
            else {
              setSortKey(k);
              setSortDir(k === "date" ? "desc" : "asc");
            }
          }}
          selected={selected}
          allSelected={allSelected}
          onToggleAll={toggleSelectAll}
          onToggleOne={toggleSelect}
          selectedCount={selectedRows.length}
          onBatchDone={batchMarkDone}
          onBatchReschedule={batchReschedule}
          onBatchDelete={batchDelete}
          onBatchExport={() => exportCsv(selectedRows)}
          onClearSelection={() => setSelected(new Set())}
          onEdit={openEdit}
        />
      )}

      {tab === "students" && (
        <StudentsView
          rows={filteredRows}
          roster={filterClassId ? filterStudents : students}
          classMap={classMap}
          studentMap={studentMap}
          today={today}
          onFilterStudent={(classId, studentId) => {
            setFilterClassId(classId);
            setFilterStudentId(studentId);
            setShowFilters(true);
            setTab("timeline");
          }}
          onDraft={(classId, studentId) => {
            setEditing(null);
            setPreset({ classId, studentId });
            setEditorOpen(true);
          }}
        />
      )}

      {tab === "analytics" && (
        <AnalyticsView rows={allRows} studentMap={studentMap} />
      )}

      {/* 編輯器 + 範本管理 */}
      <CommEditor
        open={editorOpen}
        editing={editing}
        preset={preset ?? undefined}
        classes={classes}
        students={students}
        templates={templates}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
          setPreset(null);
        }}
        onSave={handleSave}
      />
      <TemplateManager
        open={templatesOpen}
        templates={templates}
        onClose={() => setTemplatesOpen(false)}
        onAdd={addTemplate}
        onUpdate={updateTemplate}
        onRemove={removeTemplate}
      />
    </div>
  );
}

// ============================================================
//  小工具 / 共用片段
// ============================================================

function LabeledSelect({
  label,
  value,
  onChange,
  disabled,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <Select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </Select>
    </label>
  );
}

function DirectionIcon({ meta }: { meta?: CommMeta }) {
  const { t } = useTranslation();
  if (meta?.direction === "incoming")
    return (
      <Tooltip
        label={t("parent.directionTooltip.incoming", {
          defaultValue: "家長來訊",
        })}
      >
        <ArrowDownLeft size={14} className="text-blue-500 dark:text-blue-400" />
      </Tooltip>
    );
  return (
    <Tooltip
      label={t("parent.directionTooltip.outgoing", {
        defaultValue: "主動聯絡",
      })}
    >
      <ArrowUpRight size={14} className="text-accent" />
    </Tooltip>
  );
}

function MetaBadges({ meta }: { meta?: CommMeta }) {
  const lab = useParentLabels();
  if (!meta) return null;
  return (
    <>
      {meta.category && (
        <Badge tone={CATEGORY_STYLE[meta.category].badge}>
          {lab.category(meta.category)}
        </Badge>
      )}
      {meta.outcome && (
        <Badge tone={OUTCOME_STYLE[meta.outcome].badge} dot>
          {lab.outcome(meta.outcome)}
        </Badge>
      )}
    </>
  );
}

function FollowUpChip({ meta, today }: { meta?: CommMeta; today: string }) {
  const lab = useParentLabels();
  const bucket = followUpBucket(meta?.followUpDate, today);
  const tone = BUCKET_TONE[bucket];
  return (
    <Badge tone={tone} icon={bucket === "overdue" ? AlertTriangle : Hourglass}>
      {meta?.followUpDate
        ? `${lab.bucket(bucket)}・${shortDateLabel(meta.followUpDate)}`
        : lab.t("parent.followChipReply", { defaultValue: "待回覆" })}
    </Badge>
  );
}

// ============================================================
//  批量重排跟進到期日（表格多選工具列）
// ============================================================
function RescheduleControl({
  today,
  onApply,
}: {
  today: string;
  onApply: (targetDate: string | undefined) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");

  const apply = (date: string | undefined) => {
    onApply(date);
    setOpen(false);
    setCustom("");
  };

  const presets: { label: string; days: number }[] = [
    { label: t("parent.presetTomorrow", { defaultValue: "明日" }), days: 1 },
    { label: t("parent.preset3days", { defaultValue: "3 日後" }), days: 3 },
    { label: t("parent.preset1week", { defaultValue: "1 週後" }), days: 7 },
    { label: t("parent.preset2weeks", { defaultValue: "2 週後" }), days: 14 },
  ];

  return (
    <div className="relative">
      <Button
        size="sm"
        variant="secondary"
        icon={CalendarClock}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {t("parent.rescheduleButton", { defaultValue: "排回覆期" })}
      </Button>
      {open && (
        <>
          {/* 點外面收起（透明遮罩） */}
          <button
            type="button"
            aria-label={t("parent.rescheduleCloseAria", {
              defaultValue: "關閉回覆排期",
            })}
            className="fixed inset-0 z-20 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-label={t("parent.rescheduleDialogAria", {
              defaultValue: "設定所選信件嘅回覆到期日",
            })}
            className="absolute right-0 z-30 mt-2 w-60 space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-800"
          >
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t("parent.rescheduleHint", {
                defaultValue: "將所選信件設為待回覆，到期日：",
              })}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button
                  key={p.days}
                  type="button"
                  onClick={() => apply(shiftKey(today, p.days))}
                  className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                aria-label={t("parent.customDueAria", {
                  defaultValue: "自訂跟進到期日",
                })}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
              />
              <IconButton
                label={t("parent.applyCustom", {
                  defaultValue: "套用自訂日期",
                })}
                size="sm"
                disabled={!custom}
                onClick={() => custom && apply(custom)}
              >
                <Check size={15} />
              </IconButton>
            </div>
            <button
              type="button"
              onClick={() => apply(undefined)}
              className="flex w-full items-center justify-center gap-1 rounded-md border border-slate-200 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700/50 dark:hover:text-slate-200"
            >
              <X size={13} />
              {t("parent.clearDueKeepOpen", {
                defaultValue: "清除到期日（保留待回覆）",
              })}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
//  跟進管道 panel
// ============================================================
function FollowUpPanel({
  buckets,
  nameOf,
  today,
  onToggle,
  onEdit,
}: {
  buckets: Record<FollowUpBucket, CommRow[]>;
  nameOf: (r: CommRow) => string;
  today: string;
  onToggle: (r: CommRow) => void;
  onEdit: (r: CommRow) => void;
}) {
  const lab = useParentLabels();
  const t = lab.t;
  const [collapsed, setCollapsed] = useState(false);
  const order: FollowUpBucket[] = [
    "overdue",
    "today",
    "soon",
    "later",
    "nodate",
  ];
  const total = order.reduce((s, k) => s + buckets[k].length, 0);

  return (
    <Card clip>
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
      >
        <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
            <Inbox size={15} />
          </span>
          {t("parent.followPanelTitle", { defaultValue: "待回覆信件" })}
          <span className="tabular-nums text-slate-400">
            {t("parent.followPanelCount", {
              count: total,
              defaultValue: `（${total}）`,
            })}
          </span>
          {buckets.overdue.length > 0 && (
            <Badge tone="rose" icon={AlertTriangle}>
              {t("parent.followOverdueBadge", {
                count: buckets.overdue.length,
                defaultValue: `${buckets.overdue.length} 逾期未覆`,
              })}
            </Badge>
          )}
        </span>
        {collapsed ? (
          <ChevronDown size={18} className="text-slate-400" />
        ) : (
          <ChevronUp size={18} className="text-slate-400" />
        )}
      </button>
      {!collapsed && (
        <div className="space-y-3 border-t border-slate-100 px-4 py-3 dark:border-slate-700/60">
          {order
            .filter((k) => buckets[k].length > 0)
            .map((k) => (
              <div key={k}>
                <div className="mb-1.5 flex items-center gap-2">
                  <Badge tone={BUCKET_TONE[k]} dot>
                    {lab.bucket(k)}
                  </Badge>
                  <span className="text-xs tabular-nums text-slate-400">
                    {buckets[k].length}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {buckets[k].map((r) => (
                    <li
                      key={r.comm.id}
                      className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-2.5 py-1.5 dark:border-slate-700/50 dark:bg-slate-800/40"
                    >
                      <Tooltip
                        label={t("parent.markReplied", {
                          defaultValue: "標記為已回覆",
                        })}
                      >
                        <IconButton
                          label={t("parent.markRepliedShort", {
                            defaultValue: "標記已回覆",
                          })}
                          size="sm"
                          onClick={() => onToggle(r)}
                        >
                          <MailCheck size={15} />
                        </IconButton>
                      </Tooltip>
                      <button
                        type="button"
                        onClick={() => onEdit(r)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="block truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                          {nameOf(r)}
                        </span>
                        <span className="block truncate text-xs text-slate-400 dark:text-slate-500">
                          {r.meta?.followUpNote || r.comm.summary}
                        </span>
                      </button>
                      {r.meta?.remindMinutes != null && (
                        <Tooltip
                          label={t("parent.remindSet", {
                            defaultValue: "已設提醒",
                          })}
                        >
                          <Bell size={13} className="shrink-0 text-amber-500" />
                        </Tooltip>
                      )}
                      <span className="shrink-0 text-right text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                        {r.meta?.followUpDate
                          ? relativeDayLabel(r.meta.followUpDate, today)
                          : t("parent.noDate", { defaultValue: "無日期" })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      )}
    </Card>
  );
}

// ============================================================
//  視圖 1：時間線（按日期分組）
// ============================================================
function TimelineView({
  rows,
  totalAll,
  nameOf,
  today,
  onEdit,
  onRemove,
  onToggle,
  onNew,
}: {
  rows: CommRow[];
  totalAll: number;
  nameOf: (r: CommRow) => string;
  today: string;
  onEdit: (r: CommRow) => void;
  onRemove: (r: CommRow) => void;
  onToggle: (r: CommRow) => void;
  onNew: () => void;
}) {
  const { t } = useTranslation();
  const groups = useMemo(() => {
    const sorted = sortRows(rows, "date", "desc", nameOf);
    const map = new Map<string, CommRow[]>();
    for (const r of sorted) {
      const list = map.get(r.comm.date);
      if (list) list.push(r);
      else map.set(r.comm.date, [r]);
    }
    return [...map.entries()];
  }, [rows, nameOf]);

  if (rows.length === 0) {
    return totalAll === 0 ? (
      <EmptyState
        icon={Send}
        title={t("parent.emptyFirstTitle", { defaultValue: "仲未寄出第一封" })}
        hint={t("parent.emptyFirstHint", {
          defaultValue:
            "撳「寫一封」開始記低同家長或學生嘅每次往來，慢慢儲成一本通訊錄。",
        })}
        action={
          <Button icon={Plus} onClick={onNew}>
            {t("parent.compose", { defaultValue: "寫一封" })}
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={Search}
        title={t("parent.emptyNoMatchTitle", {
          defaultValue: "揀唔到相符嘅信件",
        })}
        hint={t("parent.emptyNoMatchHint", {
          defaultValue: "試吓放寬搜尋或篩選條件，再睇返其他往來。",
        })}
      />
    );
  }

  return (
    <div className="space-y-6">
      {groups.map(([date, list]) => (
        <section key={date}>
          {/* 日子分隔：serif 日期 + 郵戳點 + 信數（往來書信封面分隔感） */}
          <div className="mb-3 flex items-baseline gap-3">
            <span
              aria-hidden
              className={cx(
                "translate-y-[-2px] h-2 w-2 shrink-0 rounded-full",
                date === today
                  ? "bg-accent ring-4 ring-accent/15"
                  : "bg-slate-300 dark:bg-slate-600",
              )}
            />
            <h3 className="font-serif text-base font-semibold tracking-tight text-slate-700 dark:text-slate-200">
              {longDateLabel(date)}
            </h3>
            {date === today && (
              <Badge tone="accent">
                {t("parent.todayBadge", { defaultValue: "今日" })}
              </Badge>
            )}
            <span className="h-px flex-1 translate-y-[-3px] bg-gradient-to-r from-slate-200 to-transparent dark:from-slate-700/70" />
            <span className="translate-y-[-3px] font-serif text-xs italic tabular-nums text-slate-400">
              {t("parent.groupCount", {
                count: list.length,
                defaultValue: `${list.length} 封`,
              })}
            </span>
          </div>
          {/* 信件束：逐封信，方向色封邊 + 火漆封印 */}
          <div className="space-y-2.5">
            {list.map((r) => (
              <TimelineCard
                key={r.comm.id}
                row={r}
                name={nameOf(r)}
                today={today}
                onEdit={() => onEdit(r)}
                onRemove={() => onRemove(r)}
                onToggle={() => onToggle(r)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TimelineCard({
  row,
  name,
  today,
  onEdit,
  onRemove,
  onToggle,
}: {
  row: CommRow;
  name: string;
  today: string;
  onEdit: () => void;
  onRemove: () => void;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const { comm, meta } = row;
  const ChannelIco = CHANNEL_ICON[comm.channel] ?? MessageSquare;
  const incoming = meta?.direction === "incoming";
  return (
    <Card
      hover
      className="group/letter overflow-hidden p-0 transition duration-200 hover:border-slate-300 hover:shadow-md dark:hover:border-slate-600"
    >
      <div className="flex items-stretch">
        {/* 方向色封邊 —— 一眼分到發函（teal）/ 來函（blue） */}
        <span
          aria-hidden
          className={cx(
            "w-1 shrink-0",
            incoming ? "bg-blue-400 dark:bg-blue-500" : "bg-accent",
          )}
        />
        <div className="min-w-0 flex-1 p-4">
          <div className="flex items-start gap-3">
            {/* 火漆封印：聯絡方式做封口 */}
            <span
              className={cx(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ring-inset",
                incoming
                  ? "bg-blue-50 text-blue-600 ring-blue-200/70 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/25"
                  : "bg-accent-soft text-accent-strong ring-accent/20 dark:bg-accent/15 dark:text-accent dark:ring-accent/25",
              )}
            >
              <ChannelIco size={16} />
            </span>
            <div className="min-w-0 flex-1">
              {/* 發函 / 來函 信頭 */}
              <span
                className={cx(
                  "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.15em]",
                  incoming ? "text-blue-500 dark:text-blue-400" : "text-accent",
                )}
              >
                {incoming ? <ArrowDownLeft size={11} /> : <Send size={11} />}
                {incoming
                  ? t("parent.letterIncoming", { defaultValue: "來函" })
                  : t("parent.letterOutgoing", { defaultValue: "發函" })}
                <span className="font-sans font-normal normal-case tracking-normal text-slate-400 dark:text-slate-500">
                  · {comm.channel}
                </span>
              </span>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {name}
                </span>
                {meta?.contactName && (
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    · {meta.contactName}
                  </span>
                )}
                <MetaBadges meta={meta} />
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition sm:opacity-60 sm:group-hover/letter:opacity-100">
              <Tooltip
                label={
                  comm.followUp
                    ? t("parent.toggleReplyTooltipDone", {
                        defaultValue: "標記為已回覆",
                      })
                    : t("parent.toggleReplyTooltipReopen", {
                        defaultValue: "重新標記待回覆",
                      })
                }
              >
                <IconButton
                  label={t("parent.toggleReplyAria", {
                    defaultValue: "切換回覆狀態",
                  })}
                  className="min-h-[36px] min-w-[36px]"
                  active={comm.followUp}
                  onClick={onToggle}
                >
                  {comm.followUp ? (
                    <MailCheck size={15} />
                  ) : (
                    <Hourglass size={15} />
                  )}
                </IconButton>
              </Tooltip>
              <IconButton
                label={t("parent.editLetter", { defaultValue: "編輯信件" })}
                className="min-h-[36px] min-w-[36px]"
                onClick={onEdit}
              >
                <Pencil size={15} />
              </IconButton>
              <IconButton
                label={t("parent.deleteLetter", { defaultValue: "刪除信件" })}
                className="min-h-[36px] min-w-[36px]"
                tone="danger"
                onClick={onRemove}
              >
                <Trash2 size={15} />
              </IconButton>
            </div>
          </div>
          {/* 信文 */}
          <p className="mt-2 whitespace-pre-wrap pl-12 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            {comm.summary}
          </p>
          {comm.followUp && (
            <div className="ml-12 mt-2.5 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2 dark:border-amber-500/20 dark:bg-amber-500/10">
              <FollowUpChip meta={meta} today={today} />
              {meta?.followUpNote && (
                <span className="text-xs text-amber-700 dark:text-amber-300">
                  {meta.followUpNote}
                </span>
              )}
              {meta?.remindMinutes != null && (
                <Bell size={13} className="text-amber-500" />
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ============================================================
//  視圖 2：表格（排序 + 批量）
// ============================================================
function TableView({
  rows,
  nameOf,
  today,
  sortKey,
  sortDir,
  onSort,
  selected,
  allSelected,
  onToggleAll,
  onToggleOne,
  selectedCount,
  onBatchDone,
  onBatchReschedule,
  onBatchDelete,
  onBatchExport,
  onClearSelection,
  onEdit,
}: {
  rows: CommRow[];
  nameOf: (r: CommRow) => string;
  today: string;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  selected: Set<string>;
  allSelected: boolean;
  onToggleAll: () => void;
  onToggleOne: (id: string) => void;
  selectedCount: number;
  onBatchDone: () => void;
  onBatchReschedule: (targetDate: string | undefined) => void;
  onBatchDelete: () => void;
  onBatchExport: () => void;
  onClearSelection: () => void;
  onEdit: (r: CommRow) => void;
}) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Search}
        title={t("parent.tableEmptyTitle", { defaultValue: "通訊錄暫時係空" })}
        hint={t("parent.tableEmptyHint", {
          defaultValue: "調整篩選條件，或者寫一封新信件補上往來。",
        })}
      />
    );
  }

  const SortHead = ({
    k,
    label,
    align,
  }: {
    k: SortKey;
    label: string;
    align?: "left" | "center";
  }) => {
    const activeSort = sortKey === k;
    return (
      <Th align={align}>
        <button
          type="button"
          onClick={() => onSort(k)}
          aria-label={
            activeSort
              ? t("parent.sortToggleAria", {
                  label,
                  dir:
                    sortDir === "asc"
                      ? t("parent.sortAsc", { defaultValue: "升序" })
                      : t("parent.sortDesc", { defaultValue: "降序" }),
                  defaultValue: `${label}（目前${sortDir === "asc" ? "升序" : "降序"}排序，按一下切換）`,
                })
              : t("parent.sortAria", { label, defaultValue: `按${label}排序` })
          }
          className={cx(
            "inline-flex items-center gap-1 transition hover:text-slate-700 dark:hover:text-slate-200",
            activeSort && "text-accent-strong dark:text-accent",
          )}
        >
          {label}
          {activeSort &&
            (sortDir === "asc" ? (
              <ChevronUp size={13} />
            ) : (
              <ChevronDown size={13} />
            ))}
        </button>
      </Th>
    );
  };

  return (
    <div className="space-y-3">
      <SectionLabel
        icon={LayoutList}
        right={
          <span className="text-xs tabular-nums text-slate-400 dark:text-slate-500">
            {t("parent.ledgerCount", {
              count: rows.length,
              defaultValue: `共 ${rows.length} 封`,
            })}
          </span>
        }
      >
        {t("parent.tabTable", { defaultValue: "通訊錄" })} · Ledger
      </SectionLabel>
      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-sm dark:border-accent/40 dark:bg-accent/15">
          <span className="font-medium text-accent-strong dark:text-accent">
            {t("parent.selectedCount", {
              count: selectedCount,
              defaultValue: `已選 ${selectedCount} 封`,
            })}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon={MailCheck}
              onClick={onBatchDone}
            >
              {t("parent.batchMarkReplied", { defaultValue: "標記已回覆" })}
            </Button>
            <RescheduleControl today={today} onApply={onBatchReschedule} />
            <Button
              size="sm"
              variant="secondary"
              icon={Download}
              onClick={onBatchExport}
            >
              {t("parent.batchExport", { defaultValue: "匯出" })}
            </Button>
            <Button
              size="sm"
              variant="danger"
              icon={Trash2}
              onClick={onBatchDelete}
            >
              {t("parent.batchDelete", { defaultValue: "刪除" })}
            </Button>
            <Button size="sm" variant="ghost" onClick={onClearSelection}>
              {t("parent.batchCancel", { defaultValue: "取消" })}
            </Button>
          </div>
        </div>
      )}

      <Table>
        <Thead>
          <Tr>
            <Th>
              <input
                type="checkbox"
                aria-label={t("parent.selectAll", { defaultValue: "全選" })}
                className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent/30 dark:border-slate-700"
                checked={allSelected}
                onChange={onToggleAll}
              />
            </Th>
            <SortHead
              k="date"
              label={t("parent.colDate", { defaultValue: "日期" })}
            />
            <Th>{t("parent.colRecipient", { defaultValue: "往來對象" })}</Th>
            <SortHead
              k="channel"
              label={t("parent.colMethod", { defaultValue: "方式" })}
              align="center"
            />
            <SortHead
              k="category"
              label={t("parent.colTopic", { defaultValue: "主題" })}
              align="center"
            />
            <Th>{t("parent.colSummary", { defaultValue: "信件摘要" })}</Th>
            <SortHead
              k="followUp"
              label={t("parent.colReply", { defaultValue: "回覆" })}
              align="center"
            />
            <Th align="center">
              {t("parent.colActions", { defaultValue: "操作" })}
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          {rows.map((r) => {
            const { comm, meta } = r;
            const ChannelIco = CHANNEL_ICON[comm.channel] ?? MessageSquare;
            return (
              <Tr key={comm.id}>
                <Td>
                  <input
                    type="checkbox"
                    aria-label={t("parent.selectRow", { defaultValue: "選取" })}
                    className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent/30 dark:border-slate-700"
                    checked={selected.has(comm.id)}
                    onChange={() => onToggleOne(comm.id)}
                  />
                </Td>
                <Td numeric className="whitespace-nowrap">
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {shortDateLabel(comm.date)}
                  </span>
                </Td>
                <Td>
                  <span className="flex items-center gap-1.5">
                    <DirectionIcon meta={meta} />
                    <span className="truncate text-slate-700 dark:text-slate-200">
                      {nameOf(r)}
                    </span>
                  </span>
                </Td>
                <Td align="center">
                  <Tooltip label={comm.channel}>
                    <span className="inline-flex text-slate-500 dark:text-slate-400">
                      <ChannelIco size={16} />
                    </span>
                  </Tooltip>
                </Td>
                <Td align="center">
                  {meta?.category ? (
                    <Badge tone={CATEGORY_STYLE[meta.category].badge}>
                      {t(`parent.category.${meta.category}`, {
                        defaultValue: CATEGORY_LABEL[meta.category],
                      })}
                    </Badge>
                  ) : (
                    <span className="text-slate-300 dark:text-slate-600">
                      —
                    </span>
                  )}
                </Td>
                <Td>
                  <span className="line-clamp-1 max-w-xs text-slate-600 dark:text-slate-300">
                    {comm.summary}
                  </span>
                </Td>
                <Td align="center">
                  {comm.followUp ? (
                    <FollowUpChip meta={meta} today={today} />
                  ) : (
                    <Badge tone="green" icon={MailCheck}>
                      {t("parent.repliedShort", { defaultValue: "已覆" })}
                    </Badge>
                  )}
                </Td>
                <Td align="center">
                  <IconButton
                    label={t("parent.editLetter", { defaultValue: "編輯信件" })}
                    size="sm"
                    onClick={() => onEdit(r)}
                  >
                    <Pencil size={15} />
                  </IconButton>
                </Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
    </div>
  );
}

// ============================================================
//  需聯絡名單（contact-gap watchlist）
//  ------------------------------------------------------------
//  對齊班別名冊 + 溝通記錄，列出「從未聯絡」同「太耐冇聯絡（≥30 日）」
//  嘅學生，畀老師一眼睇邊個家長係時候 reach out。純衍生（contactGaps），
//  唔加任何欄位 / collection。
// ============================================================
function ContactGapPanel({
  gaps,
  studentMap,
  classMap,
  today,
  onFilterStudent,
  onDraft,
}: {
  gaps: ContactGap[];
  studentMap: Map<string, { id: string; name: string; classId: string }>;
  classMap: Map<string, { id: string; name: string }>;
  today: string;
  onFilterStudent: (classId: string, studentId: string) => void;
  onDraft: (classId: string, studentId: string) => void;
}) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  // 名冊乾淨（全部最近都聯絡過）→ 唔顯示空 panel
  if (gaps.length === 0) return null;

  const never = gaps.filter((g) => g.status === "never");
  const stale = gaps.filter((g) => g.status === "stale");

  const sections: {
    status: ContactGapStatus;
    label: string;
    tone: "rose" | "amber";
    items: ContactGap[];
  }[] = [
    {
      status: "never",
      label: t("parent.sectionNever", { defaultValue: "從未聯絡" }),
      tone: "rose",
      items: never,
    },
    {
      status: "stale",
      label: t("parent.sectionStale", {
        days: DEFAULT_CONTACT_GAP_DAYS,
        defaultValue: `太耐冇聯絡（≥ ${DEFAULT_CONTACT_GAP_DAYS} 日）`,
      }),
      tone: "amber",
      items: stale,
    },
  ];

  return (
    <Card clip className="border-amber-200/70 dark:border-amber-500/25">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition hover:bg-amber-50/50 dark:hover:bg-amber-500/5"
      >
        <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
            <UserX size={15} />
          </span>
          {t("parent.contactGapTitle", { defaultValue: "需聯絡名單" })}
          <span className="tabular-nums text-slate-400">
            {t("parent.followPanelCount", {
              count: gaps.length,
              defaultValue: `（${gaps.length}）`,
            })}
          </span>
          {never.length > 0 && (
            <Badge tone="rose" dot>
              {t("parent.contactGapNeverBadge", {
                count: never.length,
                defaultValue: `${never.length} 從未聯絡`,
              })}
            </Badge>
          )}
          {stale.length > 0 && (
            <Badge tone="amber" dot>
              {t("parent.contactGapStaleBadge", {
                count: stale.length,
                defaultValue: `${stale.length} 太耐`,
              })}
            </Badge>
          )}
        </span>
        {collapsed ? (
          <ChevronDown size={18} className="text-slate-400" />
        ) : (
          <ChevronUp size={18} className="text-slate-400" />
        )}
      </button>
      {!collapsed && (
        <div className="space-y-3 border-t border-amber-100 px-4 py-3 dark:border-amber-500/15">
          {sections
            .filter((sec) => sec.items.length > 0)
            .map((sec) => (
              <div key={sec.status}>
                <div className="mb-1.5 flex items-center gap-2">
                  <Badge tone={sec.tone} dot>
                    {sec.label}
                  </Badge>
                  <span className="text-xs tabular-nums text-slate-400">
                    {sec.items.length}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {sec.items.map((g) => {
                    const stu = studentMap.get(g.studentId);
                    const name =
                      stu?.name ??
                      t("parent.removedStudent", {
                        defaultValue: "（已移除學生）",
                      });
                    const classId = stu?.classId ?? "";
                    const className = classId
                      ? (classMap.get(classId)?.name ?? "—")
                      : "—";
                    return (
                      <li
                        key={g.studentId}
                        className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-2.5 py-1.5 dark:border-slate-700/50 dark:bg-slate-800/40"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            stu && onFilterStudent(classId, g.studentId)
                          }
                          disabled={!stu}
                          className="min-w-0 flex-1 text-left disabled:cursor-default"
                        >
                          <span className="block truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                            {name}
                          </span>
                          <span className="block truncate text-xs text-slate-400 dark:text-slate-500">
                            {className}
                          </span>
                        </button>
                        <span className="shrink-0 text-right text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                          {g.status === "never"
                            ? t("parent.notContacted", {
                                defaultValue: "未聯絡",
                              })
                            : g.lastDate
                              ? relativeDayLabel(g.lastDate, today)
                              : "—"}
                        </span>
                        {stu && (
                          <Tooltip
                            label={t("parent.writeTo", {
                              name,
                              defaultValue: `寫信畀 ${name}`,
                            })}
                          >
                            <IconButton
                              label={t("parent.writeLetterShort", {
                                defaultValue: "寫信",
                              })}
                              size="sm"
                              onClick={() => onDraft(classId, g.studentId)}
                            >
                              <Send size={15} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
        </div>
      )}
    </Card>
  );
}

// ============================================================
//  視圖 3：學生名冊（CRM 聯絡卡）
// ============================================================
function StudentsView({
  rows,
  roster,
  classMap,
  studentMap,
  today,
  onFilterStudent,
  onDraft,
}: {
  rows: CommRow[];
  roster: { id: string; name: string; classId: string }[];
  classMap: Map<string, { id: string; name: string }>;
  studentMap: Map<string, { id: string; name: string; classId: string }>;
  today: string;
  onFilterStudent: (classId: string, studentId: string) => void;
  onDraft: (classId: string, studentId: string) => void;
}) {
  const { t } = useTranslation();
  const removedLabel = t("parent.removedStudent", {
    defaultValue: "（已移除學生）",
  });
  const gaps = useMemo(
    () => contactGaps(roster, rows, undefined, today),
    [roster, rows, today],
  );
  const summaries = useMemo(() => summarizeByStudent(rows), [rows]);
  const list = useMemo(() => {
    return [...summaries.values()]
      .map((s) => {
        const stu = studentMap.get(s.studentId);
        return {
          ...s,
          name: stu?.name ?? removedLabel,
          classId: stu?.classId ?? "",
        };
      })
      .sort((a, b) => {
        // 有逾期 / 待跟進排先；然後按最近溝通
        if (a.openFollowUps !== b.openFollowUps)
          return b.openFollowUps - a.openFollowUps;
        return (b.lastDate ?? "").localeCompare(a.lastDate ?? "");
      });
  }, [summaries, studentMap, removedLabel]);

  return (
    <div className="space-y-4">
      {/* 待聯絡名單（從未聯絡 / 太耐冇聯絡） */}
      <ContactGapPanel
        gaps={gaps}
        studentMap={studentMap}
        classMap={classMap}
        today={today}
        onFilterStudent={onFilterStudent}
        onDraft={onDraft}
      />

      {list.length === 0 ? (
        <EmptyState
          icon={Contact}
          title={t("parent.studentsEmptyTitle", {
            defaultValue: "仲未有指定學生嘅信件",
          })}
          hint={t("parent.studentsEmptyHint", {
            defaultValue:
              "寫信時揀埋學生，呢度就會逐位列出佢哋嘅往來脈絡，似一本通訊錄。",
          })}
        />
      ) : (
        <>
          <SectionLabel
            icon={Contact}
            right={
              <span className="text-xs tabular-nums text-slate-400 dark:text-slate-500">
                {t("parent.contactsCount", {
                  count: list.length,
                  defaultValue: `${list.length} 位`,
                })}
              </span>
            }
          >
            {t("parent.contactsKicker", { defaultValue: "聯絡人" })} · Contacts
          </SectionLabel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {list.map((s) => {
              const sentimentTotal = s.positive + s.neutral + s.concern;
              const clickable = !!s.classId;
              return (
                <Card
                  key={s.studentId}
                  hover={clickable}
                  className="relative p-4"
                >
                  {clickable && (
                    <button
                      type="button"
                      onClick={() => onFilterStudent(s.classId, s.studentId)}
                      aria-label={t("parent.viewLettersAria", {
                        name: s.name,
                        defaultValue: `查看 ${s.name} 嘅往來信件`,
                      })}
                      className="absolute inset-0 z-10 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
                    />
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 font-serif text-sm font-semibold text-slate-500 dark:bg-slate-700/60 dark:text-slate-300">
                        {s.name.trim().charAt(0) || "?"}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {s.name}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          {classMap.get(s.classId)?.name ?? "—"} ·{" "}
                          {t("parent.cardExchanges", {
                            count: s.count,
                            defaultValue: `${s.count} 封往來`,
                          })}
                        </p>
                      </div>
                    </div>
                    {s.openFollowUps > 0 ? (
                      <Badge
                        tone={
                          s.nextFollowUp &&
                          followUpBucket(s.nextFollowUp, today) === "overdue"
                            ? "rose"
                            : "amber"
                        }
                        icon={Hourglass}
                      >
                        {t("parent.cardAwaiting", {
                          count: s.openFollowUps,
                          defaultValue: `${s.openFollowUps} 待回覆`,
                        })}
                      </Badge>
                    ) : (
                      <Badge tone="green" icon={MailCheck}>
                        {t("parent.cardReplied", { defaultValue: "已回覆" })}
                      </Badge>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">
                      {t("parent.lastExchange", { defaultValue: "最近往來：" })}
                      <span className="ml-1 font-medium text-slate-700 dark:text-slate-200">
                        {s.lastDate ? relativeDayLabel(s.lastDate, today) : "—"}
                      </span>
                    </span>
                    {s.nextFollowUp && (
                      <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                        <Clock size={12} />
                        {t("parent.replyOn", {
                          date: shortDateLabel(s.nextFollowUp),
                          defaultValue: `回覆 ${shortDateLabel(s.nextFollowUp)}`,
                        })}
                      </span>
                    )}
                  </div>

                  {/* 觀感迷你條 */}
                  {sentimentTotal > 0 && (
                    <div className="mt-2.5">
                      <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        {s.positive > 0 && (
                          <div
                            className="bg-emerald-500"
                            style={{
                              width: `${(s.positive / sentimentTotal) * 100}%`,
                            }}
                          />
                        )}
                        {s.neutral > 0 && (
                          <div
                            className="bg-slate-400"
                            style={{
                              width: `${(s.neutral / sentimentTotal) * 100}%`,
                            }}
                          />
                        )}
                        {s.concern > 0 && (
                          <div
                            className="bg-rose-500"
                            style={{
                              width: `${(s.concern / sentimentTotal) * 100}%`,
                            }}
                          />
                        )}
                      </div>
                      <div className="mt-1 flex gap-3 text-[10px] text-slate-400 dark:text-slate-500">
                        {s.positive > 0 && (
                          <span className="tabular-nums">
                            {t("parent.sentimentPositive", {
                              count: s.positive,
                              defaultValue: `正面 ${s.positive}`,
                            })}
                          </span>
                        )}
                        {s.neutral > 0 && (
                          <span className="tabular-nums">
                            {t("parent.sentimentNeutral", {
                              count: s.neutral,
                              defaultValue: `中性 ${s.neutral}`,
                            })}
                          </span>
                        )}
                        {s.concern > 0 && (
                          <span className="tabular-nums text-rose-500 dark:text-rose-400">
                            {t("parent.sentimentConcern", {
                              count: s.concern,
                              defaultValue: `需關注 ${s.concern}`,
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
//  視圖 4：統計分析（自製 SVG / div 圖表）
// ============================================================
function AnalyticsView({
  rows,
  studentMap,
}: {
  rows: CommRow[];
  studentMap: Map<string, { id: string; name: string }>;
}) {
  const { t } = useTranslation();
  const removedShort = t("parent.removedShort", { defaultValue: "（已移除）" });
  const [months, setMonths] = useState(6);

  const channels = useMemo(() => countByChannel(rows), [rows]);
  const categories = useMemo(() => countByCategory(rows), [rows]);
  const outcomes = useMemo(() => countByOutcome(rows), [rows]);
  const trend = useMemo(() => monthlyTrend(rows, months), [rows, months]);

  const topStudents = useMemo(() => {
    const map = new Map<string, number>();
    for (const { comm } of rows)
      if (comm.studentId)
        map.set(comm.studentId, (map.get(comm.studentId) ?? 0) + 1);
    return [...map.entries()]
      .map(([id, count]) => ({
        id,
        name: studentMap.get(id)?.name ?? removedShort,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [rows, studentMap, removedShort]);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title={t("parent.analyticsEmptyTitle", {
          defaultValue: "仲未有信件可分析",
        })}
        hint={t("parent.analyticsEmptyHint", {
          defaultValue:
            "開始往來通訊之後，呢度會自動整理出每月信量、聯絡方式同觀感分佈。",
        })}
      />
    );
  }

  return (
    <div className="space-y-4">
      <SectionLabel icon={BarChart3}>
        {t("parent.insightsTitle", { defaultValue: "信件分析" })} · Insights
      </SectionLabel>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4 lg:col-span-2">
          <SectionTitle
            icon={TrendingUp}
            right={
              <SegmentedControl<string>
                size="sm"
                value={String(months)}
                onChange={(v) => setMonths(Number(v))}
                options={[
                  {
                    id: "6",
                    label: t("parent.months6", { defaultValue: "6 個月" }),
                  },
                  {
                    id: "12",
                    label: t("parent.months12", { defaultValue: "12 個月" }),
                  },
                ]}
              />
            }
          >
            {t("parent.chartMonthlyVolume", { defaultValue: "每月往來信量" })}
          </SectionTitle>
          <MonthlyTrendChart points={trend} />
        </Card>

        <Card className="p-4">
          <SectionTitle icon={MessageSquare}>
            {t("parent.chartChannelShare", { defaultValue: "聯絡方式占比" })}
          </SectionTitle>
          <ChannelDonut slices={channels} />
        </Card>

        <Card className="p-4">
          <SectionTitle icon={FileText}>
            {t("parent.chartCategoryDist", { defaultValue: "信件主題分佈" })}
          </SectionTitle>
          <CategoryBars data={categories} />
        </Card>

        <Card className="p-4">
          <SectionTitle icon={CheckCheck}>
            {t("parent.chartOutcome", { defaultValue: "往來觀感" })}
          </SectionTitle>
          <OutcomeBars data={outcomes} />
        </Card>

        <Card className="p-4">
          <SectionTitle icon={Users}>
            {t("parent.chartTopStudents", { defaultValue: "最常往來學生" })}
          </SectionTitle>
          <TopStudentsBars data={topStudents} />
        </Card>
      </div>
    </div>
  );
}
