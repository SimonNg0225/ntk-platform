import i18n from '../../../i18n'

// 課程進度 CurriculumProgress — 功能級 i18n bundle（decoupled side-effect）：只加 'en' 嘅 `curr` namespace。
i18n.addResourceBundle(
  'en',
  'translation',
  {
    curr: {
      // VIEW_TABS
      tabList: 'Progress list',
      tabSchedule: 'Scheme of work',
      tabMatrix: 'School-wide comparison',
      tabAnalysis: 'Analysis',

      // Masthead / header
      routeLabel: 'Teaching roadmap',
      pageTitle: 'Curriculum progress',
      pageDesc: 'Lay out a teaching track along the BAFS syllabus, mark milestones at each stop, and see at a glance how far {{className}} has travelled.',
      arrivedCount: 'Arrived {{done}} / {{total}} stops',
      routePickerLabel: 'Route',

      // EmptyState – no classes
      noClassTitle: 'No track laid yet',
      noClassHint: 'Go to "Class management" to create a class first, then come back here to map out your teaching route along the BAFS syllabus.',

      // LedgerStat labels
      statTotalStops: 'Total stops',
      statArrived: 'Arrived',
      statInTransit: 'In transit',
      statBehind: 'Behind schedule',
      statUnit: 'stops',
      hintCompletionPct: 'Completion {{pct}}%',
      hintPastTarget: 'Past target date',
      hintOnTime: 'All on time',

      // Overall progress card
      journeyLabel: '{{className}} teaching journey',
      journeyMilestones: 'Arrived {{done}} / {{total}} milestones',

      // Toolbar
      searchPlaceholder: 'Search topic or area…',
      exportCsv: 'Export CSV',
      print: 'Print',
      filterStatusLabel: 'Status',
      filterAll: 'All',
      filterNotStarted: 'Not started',
      filterInProgress: 'In progress',
      filterDone: 'Done',
      filterAllParts: 'All parts',
      collapseAll: 'Collapse all',
      expandAll: 'Expand all',

      // EmptyState – list
      emptyFilterTitle: 'No matching stops on this stretch',
      emptyFilterHint: 'Clear the search or filters to see the full route.',
      emptyListTitle: 'Track not laid yet',
      emptyListHint: 'Once topic data is loaded, the BAFS route will unfold stop by stop.',

      // Part / area badges
      partBadge: '{{done}}/{{total}} stops',

      // Area row
      tooltipMarkAllDone: 'Mark whole stretch as arrived',
      labelMarkAllDone: 'Mark whole stretch as arrived',

      // TopicRow
      plannedWeek: 'Week {{week}}',
      periods: '{{n}} periods',
      ariaEditPlan: 'Schedule / plan',
      ariaSetStatus: 'Set to {{label}}',
      ariaCycleStatus: 'Cycle status: {{label}}',

      // Toasts / confirms
      toastAllDone: '{{className}} — all topics completed 🎉',
      toastAreaDone: 'All topics in "{{area}}" marked complete',
      toastAreaReset: '"{{area}}" progress reset',
      confirmResetTitle: 'Reset area progress?',
      confirmResetMsg: 'Set all {{count}} topics in "{{area}}" to not started.',
      confirmResetBtn: 'Reset',

      // CSV – list view
      csvColPart: 'Part',
      csvColArea: 'Area',
      csvColTopic: 'Topic',
      csvColStatus: 'Status',
      csvColDateDone: 'Date completed',
      csvColTargetDate: 'Target date',
      csvColPace: 'Pacing',
      csvFilenameCurr: '{{className}}_curriculum_progress.csv',
      toastExportCurr: '{{className}} curriculum progress CSV exported',

      // PlanEditor modal
      planModalTitle: 'Teaching plan',
      planClearBtn: 'Clear',
      planCancelBtn: 'Cancel',
      planSaveBtn: 'Save',
      planFieldWeek: 'Teaching week',
      planFieldWeekHint: 'Which week to teach',
      planFieldPeriods: 'Planned periods',
      planFieldTargetDate: 'Target completion date',
      planFieldTargetHint: 'Used to judge whether progress is behind / on track',
      planFieldNote: 'Note (optional)',
      planPlaceholderWeek: 'e.g. 3',
      planPlaceholderPeriods: 'e.g. 4',
      planPlaceholderNote: 'e.g. before mid-term exam',
      toastPlanSaved: 'Teaching plan saved',
      toastPlanCleared: 'Schedule cleared',

      // ScheduleView
      statScheduled: 'On timetable',
      statTotalPeriods: 'Total periods',
      statBehindStops: 'Behind-schedule stops',
      paceFilterLabel: 'Pacing status',
      paceBehind: 'Behind',
      paceDueSoon: 'Due soon',
      paceAhead: 'Ahead',
      paceNone: 'Not scheduled',
      csvColWeek: 'Teaching week',
      csvFilenameSchedule: '{{className}}_scheme_of_work.csv',
      toastExportSchedule: 'Scheme of work CSV exported',
      emptyScheduleTitle: 'Timetable not built yet',
      emptyScheduleHint: 'Once topic data is loaded, the timetable for the whole route will appear here.',
      emptyPaceTitle: 'No stops in this class',
      emptyPaceHint: 'Try switching the pacing status filter above.',
      thWeek: 'Wk',
      thStop: 'Stop (topic)',
      thPeriods: 'Periods',
      thTargetDate: 'Target',
      thPace: 'Pace',
      scheduleFootnote: 'Want to add to the timetable? In "Progress list", tap {{icon}} on each stop to set teaching week, periods and target date.',
      scheduleFootnoteA: 'Want to add to the timetable? In "Progress list", tap',
      scheduleFootnoteB: 'on each stop to set teaching week, periods and target date.',
      statusDone: 'Done',

      // MatrixView
      legendDone: 'Done',
      legendInProgress: 'In progress',
      legendNotStarted: 'Not started',
      csvFilenameMatrix: 'school_wide_curriculum_comparison.csv',
      toastExportMatrix: 'School-wide comparison CSV exported',
      emptyMatrixTitle: 'No topics yet',
      emptyMatrixHint: 'Topics will appear here once data is loaded.',
      matrixThTopic: 'Topic',
      matrixTfootCompletion: 'Completion',
      matrixFootnote: 'See coverage gaps across all classes at a glance — which class is behind, which topic hasn\'t started.',
      cellDone: 'Done',
      cellInProgress: 'In progress',
      cellNotStarted: 'Not started',

      // AnalysisView
      sectionDonut: 'Overall arrival rate',
      sectionAreaBars: 'Progress by stretch (slowest first)',
      noAreaData: 'No data yet.',
      sectionPacing: '{{className}} journey pacing (cumulative arrivals)',
      legendSchedule: 'Schedule',
      legendActual: 'Actual',
      emptyPacingNote: 'Set a target completion date for each stop in "Progress list" and a schedule vs actual travel line will appear here.',
      sectionAttention: 'Stops needing attention (behind / due soon)',
      allOnTime: 'All on time — no stops are behind or approaching a deadline.',
      centerSub: '{{done}}/{{total}} stops',
      emptyAnalysisTitle: 'No topics yet',
      emptyAnalysisHint: 'Topics will appear here once data is loaded.',

      // Charts
      ariaDonut: 'Completion rate {{label}}',
      ariaPacing: 'Schedule vs actual progress line chart',
      monthLabel: 'Month {{n}}',
    },
  },
  true,
  true,
)
