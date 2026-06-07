// ============================================================
//  點名 / 出席（Attendance）— 功能級 i18n bundle（decoupled side-effect）
//  ------------------------------------------------------------
//  只加 'en' 嘅 `attend` namespace；zh-HK 維持原文（用 t() 嘅 defaultValue）。
//  deepMerge + overwrite = true，避免覆蓋其他 bundle。
//  import 一次（side-effect）即註冊；唔改 shared i18n 檔案。
// ============================================================
import i18n from '../../../i18n'

i18n.addResourceBundle(
  'en',
  'translation',
  {
    attend: {
      // ── 頁面身份 / masthead ──
      registerKicker: 'Attendance Register',
      title: 'Attendance',
      tagline: 'Flip through day by day, stamp each name; monthly register and attendance-rate trends at a glance.',
      stampPresent: 'Present',

      // ── 分頁 ──
      tabRollcall: "Today's roll call",
      tabRegister: 'Register',
      tabAnalytics: 'Analytics',

      // ── 班別揀選 ──
      classLabel: 'Class',

      // ── 狀態（display only；stored values 不變）──
      statusPresent: 'Present',
      statusLate: 'Late',
      statusAbsent: 'Absent',
      unmarked: 'Not marked',

      // ── 空狀態 ──
      emptyNoClassTitle: 'Start with your first class',
      emptyNoClassHint: 'Set up classes in "Class management" first, then you can flip the register day by day and stamp attendance here.',
      emptyNoRosterTitle: 'This register has no roster yet',
      emptyNoRosterHintRoll: 'Add students in "Class management / Gradebook", then come back to stamp attendance one by one.',
      emptyNoRosterHintRegister: 'Add students in "Class management / Gradebook" and the monthly register will fill in.',
      emptyNoRosterHintAnalytics: 'Add students in "Class management / Gradebook" and stats and trends will appear.',
      emptyNoDataTitle: 'This register is still a blank page',
      emptyNoDataHint: 'Go to the "Today\'s roll call" tab and start stamping; the attendance-rate trend, alerts and ranking will draw themselves here.',

      // ── 今日結算戳印帶（封面短碼：到 / 遲 / 缺）──
      tallyShortPresent: 'In',
      tallyShortLate: 'Late',
      tallyShortAbsent: 'Out',
      tallyRate: 'Attendance rate',
      unitPeople: '',
      tallyMarkedHint: 'Marked {{marked}}/{{total}}',

      // ── 點名進度 ──
      progressLabel: 'Roll-call progress',
      progressStamped: 'Stamped {{marked}}/{{total}}',

      // ── 快手操作 ──
      markAllPresent: 'Stamp all "In"',
      fillUnmarked: 'Fill unmarked as "In"',
      copyPrevious: 'Copy last time',
      clearDay: 'Clear this page',

      // ── 點名簿頁 ──
      registerPage: 'Register page',
      classCount: 'Class of {{count}}',
      studentNo: 'No. {{no}}',
      noStudentNo: 'No student number',
      lateMinutesBadge: 'Late {{minutes}} min',
      earlyLeave: 'Early leave',
      attendanceStatusOf: '{{name}} attendance status',
      stampStatusFor: 'Stamp "{{status}}" for {{name}}',
      attendanceDetail: 'Attendance details',

      // ── 日期導航 ──
      prevDay: 'Flip to previous day',
      nextDay: 'Flip to next day',
      monthYear: '{{month}}/{{year}}',
      // 星期清單（index 0 = 日）；DateNav 以星期幾 index split 取用
      weekday: 'Sun_Mon_Tue_Wed_Thu_Fri_Sat',
      weekdayDisplay: '{{wdEn}}',
      todaySuffix: ' · Today',
      jumpToDate: 'Jump to a specific date',
      backToToday: 'Back to today',

      // ── 細項 modal ──
      cancel: 'Cancel',
      saveToRegister: 'Save to register',
      entryKicker: 'Entry card',
      detailFallbackTitle: 'Attendance details',
      close: 'Close',
      todayStamp: 'Today',
      absenceSection: 'Absence entry',
      absenceKindLabel: 'Absence type',
      absenceKindHint: 'Sick / personal / official leave count as excused, not as unexcused absence',
      uncategorised: '— Uncategorised —',
      kindSick: 'Sick leave',
      kindPersonal: 'Personal leave',
      kindOfficial: 'Official leave (official)',
      kindUnexcused: 'Unexcused absence',
      lateSection: 'Late entry',
      lateMinutesLabel: 'Minutes late',
      lateMinutesHint: 'Optional, used to gauge how serious the lateness is',
      lateMinutesPlaceholder: 'e.g. 10',
      noteSection: 'Register notes',
      earlyLeaveCheckbox: 'Left school early today (early leave)',
      reasonLabel: 'Note / reason',
      reasonPlaceholder: 'e.g. parent already called to request leave, follow-up appointment, leave note pending…',

      // ── 月度點名冊 ──
      prevMonth: 'Flip to previous month',
      nextMonth: 'Flip to next month',
      thisMonth: 'This month',
      print: 'Print',
      exportCsv: 'Export CSV',
      cycleHint: 'Click a cell to cycle the stamp',
      colStudent: 'Student',
      colRate: 'Rate',
      cellAria: '{{name}} · {{date}}: {{status}}',

      // ── 統計分析 ──
      range14: 'Last 14 days',
      range30: 'Last 30 days',
      range90: 'Last 90 days',
      exportStats: 'Export stats',
      overallRate: 'Overall attendance rate',
      sessionDays: '{{count}} class days',
      unitTimes: '',
      trendTitle: 'Daily attendance-rate trend',
      needAttention: 'Needs attention',
      needAttentionDesc: 'Absent 2+ times in a row, or attendance rate < 80%',
      noAlerts: 'Nobody triggers the attention criteria for now — attendance is holding steady.',
      consecutiveAbsentDays: 'Absent {{count}} days in a row',
      rateBadge: 'Rate {{rate}}%',
      chronicTitle: 'Chronic absence watch',
      chronicDesc: 'Absence rate ≥ {{pct}}% in window',
      chronicNone: 'Nobody has hit the chronic-absence threshold for now.',
      absentOfMarked: 'Absent {{absent}}/{{marked}}',
      consecutiveDays: '{{count}} in a row',
      absenceRateBadge: 'Absence {{rate}}%',
      perfectTitle: 'Perfect attendance',
      perfectDesc: 'Has records in window with zero absence',
      perfectNone: 'No student with zero absence in the window yet.',
      perfectBadge: 'Perfect {{count}} sessions',
      rankingTitle: 'Student attendance ranking',
      rankingDesc: 'Sorted by attendance rate; click a row for an individual summary',
      viewSummaryOf: 'View {{name}} attendance summary',
      lateShort: 'L{{count}}',
      absentShort: 'A{{count}}',

      // ── 個別學生摘要 modal ──
      summaryKicker: 'Summary',
      summaryFallbackTitle: 'Attendance summary',
      pageStamp: 'Page',
      summaryMarkedHint: 'Last {{days}} days · marked {{marked}} sessions',
      noRecordInRange: 'This student has no roll-call records in the last {{days}} days.',
      miniPresent: 'Present',
      miniLate: 'Late',
      miniAbsent: 'Absent',
      currentStreak: 'Current absence streak',
      longestStreak: 'Longest streak in period',
      lastPresent: 'Last present',
      neverPresent: 'Never',
      daysUnit: '{{count}} days',
      detailStats: 'Detail stats',
      absenceReason: 'Absence reason',
      kindCount: '{{label}} {{count}}',
      unexcusedCount: 'Unexcused {{count}}',
      lateMinutes: 'Minutes late',
      lateMinutesTotal: '{{total}} min total ({{count}} times)',
      lateMinutesAvg: 'Avg {{avg}} min / time',
      earlyLeaveStat: 'Early leave',
      earlyLeaveTimes: '{{count}} times',
      timelineTitle: 'Attendance timeline',
      timelineDesc: 'Oldest to newest, one per roll-called day',
      timelineTooltip: '{{date}}: {{status}}',

      // ── 星期分佈 ──
      weekdayTitle: 'Weekday breakdown',
      weekdayDesc: 'See which day has the most lateness / absence',
      weekdayLabels: 'Sun_Mon_Tue_Wed_Thu_Fri_Sat',
      weekdayShort: '{{wdEn}}',
      weekdayBarTooltip: '{{weekday}}: In {{present}} / Late {{late}} / Out {{absent}}',

      // ── 趨勢圖 ──
      chartAria: 'Attendance-rate trend chart',
      refLine: 'Watch line 90%',
      avgRate: 'Average attendance rate in period',
      markedDaysCount: '{{count}} roll-called days',
      trendTooltipHead: '{{date}} · {{rate}}%',
      trendTooltipPresent: 'In {{count}}',
      trendTooltipLate: 'Late {{count}}',
      trendTooltipAbsent: 'Out {{count}}',

      // ── Toasts ──
      toastMarkedAll: 'Marked the whole class as {{status}}',
      toastFilledPresent: 'Marked {{count}} un-rolled students as present',
      toastAllMarked: 'All students are already marked',
      toastClearedDay: "Cleared today's roll call",
      toastNoCopySource: 'No roll-call records to copy in the past 30 days',
      toastCopied: 'Copied {{count}} entries from {{date}}',
      toastExportRegister: 'Exported the monthly register CSV (P=Present, L=Late, A=Absent)',
      toastExportStats: 'Exported the attendance stats CSV',

      // ── Confirm（清除當日）──
      clearConfirmTitle: 'Clear today\'s roll call?',
      clearConfirmMessage: 'This will remove all {{count}} records for the class on {{date}}.',
      clearConfirmBtn: 'Clear',

      // ── CSV 標頭 / 檔名 ──
      csvNo: 'No.',
      csvStudent: 'Student',
      csvRate: 'Rate (%)',
      csvPresent: 'Present',
      csvLate: 'Late',
      csvAbsent: 'Absent',
      csvMarkedDays: 'Marked days',
      csvStreak: 'Absence streak',
      csvRegisterFile: '{{className}}_{{month}}_Register',
      csvStatsFile: '{{className}}_Attendance_stats_last{{range}}d',
    },
  },
  true,
  true,
)
