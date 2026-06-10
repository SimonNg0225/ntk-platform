import i18n from '../../../i18n'

// 時間表 Timetable — 功能級 i18n bundle（decoupled side-effect）：只加 'en' 嘅 `tt` namespace。
i18n.addResourceBundle(
  'en',
  'translation',
  {
    tt: {
      // ── header / masthead ──
      cycleTagline: 'Six-day cycle · Weekly grid',
      weeklyTagline: 'Weekly timetable',
      title: 'Timetable',
      lessonCount: '{{count}} lessons/week',
      featureDesc: 'Bell times · Conflict detection · Workload analysis',

      // ── icon buttons ──
      settingsBells: 'Bell time settings',
      exportCsv: 'Export CSV',
      print: 'Print',

      // ── cycle ribbon ──
      cycleRibbonLabel: 'Six-day cycle',
      today: 'Today',

      // ── conflict banner ──
      conflictsDetected: '{{count}} conflict(s) detected',
      conflictClass: '{{day}} Period {{period}}: class {{name}} duplicated',
      conflictRoom: '{{day}} Period {{period}}: room {{name}} duplicated',

      // ── view tabs ──
      viewGrid: 'Timetable',
      viewWorkload: 'Workload',
      viewPrint: 'Print',

      // ── class filter ──
      allClasses: 'All classes',
      focusClass: 'Focus {{name}}',

      // ── today panel ──
      noSchoolToday: 'No school today',
      restToday: 'Day off',
      todayWithCycle: 'Today · Day {{letter}}',
      todayWithDay: 'Today · {{day}}',
      restMessage: 'Rest up ☕',
      todayLessons: '{{count}} lessons today',
      statusNow: 'In progress',
      statusSoon: 'In {{min}} min',
      statusNext: 'Up next',
      fallbackLesson: 'Lesson',
      doneForDay: 'All done for today!',
      noMoreLessons: 'No more lessons today',

      // ── week label (below Day token in TodayPanel) ──
      dayLabel: 'Day',
      weekdayLabel: 'Day',

      // ── toast messages ──
      appliedMultiple: 'Applied to {{count}} days',
      updated: 'Lesson updated',
      added: 'Lesson added',
      deleted: 'Lesson deleted',
      exportedCsv: 'CSV exported',
      noLessonsToExport: 'No lessons to export',
      settingsSaved: 'Time-slot settings saved',
      settingsReset: 'Defaults restored',

      // ── confirm dialog ──
      deleteTitle: 'Delete lesson?',
      deleteMessage: 'This lesson will be removed from the timetable. This action cannot be undone.',
      deleteConfirm: 'Delete',

      // ── period label in editor ──
      periodLabel: 'Period {{n}}',

      // ── print view ──
      printSubtitle: 'Weekly teaching timetable · {{count}} lessons',
      printPeriodCol: 'Period / Time',

      // ── PrintView day headers ──
      dayMon: 'Mon',
      dayTue: 'Tue',
      dayWed: 'Wed',
      dayThu: 'Thu',
      dayFri: 'Fri',
      daySat: 'Sat',

      // ── settings modal ──
      settingsTitle: 'Time-slot settings',
      resetDefaults: 'Restore defaults',
      cancel: 'Cancel',
      save: 'Save',
      cycleToggleLabel: 'Six-day cycle (Day A–F)',
      cycleOnDesc: 'Column headings use Day A–F; "Today" follows the school cycle calendar',
      cycleOffDesc: 'Column headings use Mon–Sat (fixed each week)',
      showCycleDays: 'Show cycle days',
      showWeekdays: 'Show weekdays',
      cycleDaysHint: 'Select which cycle days appear in the timetable (usually all A–F)',
      bellsTitle: 'Bell times (lessons / recess / lunch)',
      bellsSummary: '{{count}} lessons · {{duration}}',
      bellsLessonRow: 'Period {{n}}',
      bellsMinutes: '{{min}} min',
      bellsFootnote: 'Changes are reflected immediately in the timetable and print views.',

      // ── WeekGrid ──
      gridPeriodCol: 'Period / Time',
      cellTodayLabel: 'Today',
      cellDayLabel: 'Day',
      cellWeekdayLabel: 'Day',
      cellConflict: '(conflict)',
      cellEditLabel: 'Edit {{pos}}: {{title}}',
      cellAddLabel: 'Add lesson — {{pos}}',
      cellCyclePos: 'Day {{letter}} Period {{period}}',
      cellWeekPos: '{{day}} Period {{period}}',

      // ── SlotEditor modal ──
      editorAddTitle: 'Add lesson',
      editorEditTitle: 'Edit lesson',
      editorWeekdayLabel: 'Day',
      groupContentLabel: 'Lesson details',
      fieldClass: 'Class (optional)',
      fieldClassPlaceholder: 'Not selected',
      fieldSubject: 'Subject',
      fieldSubjectPlaceholder: 'e.g. BAFS (Accounting)',
      fieldRoom: 'Room (optional)',
      fieldRoomPlaceholder: 'e.g. 1A / Commerce Room',
      fieldWeek: 'Cycle week',
      weekAll: 'Every week',
      weekA: 'Week A (odd)',
      weekB: 'Week B (even)',
      weekChip: 'Wk {{w}}',
      groupNotesLabel: 'Teaching notes',
      fieldCoTeacher: 'Co-teacher (optional)',
      fieldCoTeacherPlaceholder: 'e.g. Mr Chan (split / co-teach)',
      fieldNote: 'Prep notes / topic (optional)',
      fieldNotePlaceholder: 'e.g. Cost Accounting — Job Costing',
      groupAppearanceLabel: 'Card appearance',
      colorAuto: 'Auto',
      colorAutoLabel: 'Auto · {{label}}',
      cardPreviewLabel: 'Card preview',
      editorDelete: 'Delete',
      editorCancel: 'Cancel',
      editorSave: 'Save lesson',
      groupApplyLabel: 'Apply to other days',
      applyHint: 'Also schedule period {{period}} on these days',
      applyWarning: 'Existing lessons on the selected days for this period will be replaced.',

      // ── WorkloadView ──
      emptyTitle: 'No lessons to analyse yet',
      emptyHint: 'Go to the "Timetable" tab, tap a cell to add a lesson, and this view will calculate your daily count, busiest day and free periods.',
      statTotalLabel: 'Total lessons/week',
      statTotalUnit: 'lessons',
      statHoursLabel: 'Teaching hours/week',
      statHoursUnit: 'hrs',
      statBusiestLabel: 'Busiest day',
      statBusiestUnit: 'lessons',
      statConsecLabel: 'Longest run',
      statConsecUnit: 'lessons',
      statAvgHint: 'Avg {{avg}} lessons/day',
      chartDailyTitle: 'Daily lesson count',
      chartClassTitle: 'Lessons by class',
      chartPeriodTitle: 'Period heat map',
      chartPeriodDesc: 'Which periods are busiest (across all days)',
      chartFreeBusyTitle: 'Free vs busy',
      chartFreeBusyDesc: 'Lessons vs free periods each day',
      chartFreeSegsTitle: 'Free slots',
      chartFreeSegsDesc: 'Which periods are free on which days (consecutive runs merged)',
      freeSegsCount: '{{count}} segments',
      periodRowLabel: 'P{{n}}',
      busyLabel: 'Busy',
      freeLabel: 'Free',
      busyFreeCell: '{{busy}} busy · {{free}} free',
      donutTotal: 'total',
      noFreeSlots: 'No free slots — fully packed.',
      freeSegPeriod: 'P{{start}}–{{end}}',
      freeSegSingle: 'P{{n}}',
      freeSegConsec: '{{count}} consecutive',
    },
  },
  true,
  true,
)
