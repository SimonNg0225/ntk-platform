import i18n from '../../../i18n'

// ============================================================
//  Work Dashboard — English bundle (namespace: wdash)
//  ------------------------------------------------------------
//  Decoupled, side-effect import. zh-HK stays the source of
//  truth via defaultValue at each call site; this only adds the
//  'en' bundle. deepMerge + overwrite so re-import is idempotent.
// ============================================================

i18n.addResourceBundle(
  'en',
  'translation',
  {
    wdash: {
      // ── KPI tile / StatTile labels ──
      openTasks: 'Open tasks',
      todayClasses: 'Classes today',
      attendanceRate: 'Attendance',
      followUpParents: 'Parents to follow up',
      doneThisWeek: 'Done this week',
      curriculumProgress: 'Curriculum progress',
      weekLoad: 'This week’s load',
      nearestCountdown: 'Nearest countdown',
      recentAverage: 'Recent average',
      keyMetrics: 'Key metrics',

      // ── Units ──
      unitItems: 'items',
      unitPeriods: 'periods',
      unitClasses: 'classes',
      unitPeople: 'people',
      unitDays: 'days',

      // ── KPI deltas / hints ──
      overdueN: '{{n}} overdue',
      overdueCountN: '{{n}} overdue',
      upcoming7N: '{{n}} events in next 7 days',
      last7Tasks: 'Tasks in last 7 days',
      allCleared: 'All cleared 🎉',
      stayClear: 'Keeping it light',
      remindParents: 'Remember to reply to parents',
      allFollowedUp: 'All followed up',
      classes30N: 'Last 30 days · {{n}} records',
      noAttendanceYet: 'No attendance yet',
      donePeriodsN: '{{n}} done',
      noClassToday: 'No class today',
      totalPeriodsMonToSat: 'Total periods Mon–Sat',
      noCountdown: 'No countdown',
      gradedPeopleN: '{{n}} graded',
      noGradesYet: 'Not graded yet',
      overallCompletion: 'Overall completion',
      noClasses: 'No classes',
      classesN: '{{n}} classes',

      // ── Hero ──
      defaultName: 'Teacher',
      streakDaysN: '{{n}}-day to-do streak',
      todayClassProgress: 'Today’s class progress',
      ofNClasses: '/ {{n}} classes',
      heroIdle: 'No classes scheduled today — use the time to prep or take a break.',
      heroOverdue: 'You have {{n}} overdue to-dos. Clear them first.',
      heroClassAndTask: '{{c}} classes and {{t}} to-dos due today — tackle them one by one.',
      heroClassOnly: 'You have {{c}} classes today. Remember to prepare materials.',
      heroTaskOnly: 'You have {{t}} to-dos due today. Finish them early.',

      // ── Top action bar ──
      days7: '7 days',
      days14: '14 days',
      days30: '30 days',
      customizeLayoutE: 'Customize layout (E)',
      done: 'Done',
      customize: 'Customize',

      // ── Quick capture ──
      capturePlaceholder: 'Jot down a thought / to-do quickly… (Enter to drop into inbox)',
      capture: 'Capture',
      capturedToast: 'Dropped into quick capture',

      // ── Toasts ──
      taskDoneToast: 'To-do completed',

      // ── Empty state (no widgets) ──
      noWidgetsTitle: 'No sections shown',
      noWidgetsHint: 'Turn sections back on in the “Customize” panel.',
      openCustomize: 'Open customize',

      // ── Shortcuts ──
      shortcuts: 'Shortcuts',
      scTasks: 'To-dos',
      scTimetable: 'Timetable',
      scAttendance: 'Take attendance',
      scGradebook: 'Grades',
      scCalendar: 'Calendar',
      scAi: 'AI',
      customizeLayout: 'Customize layout',

      // ── WIDGET_META labels ──
      metaKpi: 'Key metrics',
      metaFocus: 'Today’s focus',
      metaAgenda: 'Today’s agenda',
      metaTaskTrend: 'To-do completion trend',
      metaCurriculum: 'Curriculum progress by class',
      metaAttendance: 'Attendance',
      metaGrades: 'Grade distribution',
      metaParentFollowUp: 'Parents to follow up',
      metaCountdown: 'Important date countdown',
      metaClassLoad: 'This week’s teaching load',
      metaQuickActions: 'Quick actions',

      // ── Agenda (bento + widget) ──
      agendaTitle: 'Today’s agenda',
      calendar: 'Calendar',
      agendaQuietBento: 'A quiet day — no classes, due to-dos or events.',
      allDay: 'All day',
      moreItemsN: '{{n}} more…',
      sundayRestTitle: 'Sunday rest',
      sundayRestHint: 'No classes or due items today — take a good break.',
      quietTitle: 'A quiet day',
      quietHint: 'No classes, due to-dos or events.',
      kindClass: 'Class',
      kindEvent: 'Event',
      kindTask: 'To-do',
      kindCountdown: 'Date',
      completeTask: 'Complete to-do',
      complete: 'Done',

      // ── Today’s to-dos (bento) ──
      todayTodos: 'Today’s to-dos',
      itemsN: '{{n}} items',
      noTodayTodos: 'No to-dos due today',
      goPlanTodos: 'Go to to-do planning →',
      moreTasksN: '{{n}} more…',

      // ── AI CTA ──
      askTeachingAi: 'Ask the teaching AI',
      aiSubtitle: 'Prep · Generate questions · Grade',

      // ── Layout editor ──
      customizeDashboard: 'Customize dashboard',
      customizeDashboardHint: 'Toggle sections, reorder them, or set the name you want to be greeted by.',
      reset: 'Reset',
      nickname: 'Name',
      nicknamePlaceholder: 'e.g. Mr. Chan / Miss Wong',
      moveUp: 'Move up',
      moveDown: 'Move down',
      show: 'Show',
      hide: 'Hide',
      sectionSettings: '{{label}} section settings',

      // ── Focus widget ──
      focusTitle: 'Today’s focus',
      focusIdle: 'Nothing special today — use the time to prep or take a break.',
      focusOverdue: 'You have {{n}} overdue to-dos. Clear them first.',
      focusClassAndTask: '{{c}} classes and {{t}} to-dos due today — tackle them one by one.',
      focusClassOnly: 'You have {{c}} classes today. Remember to prepare materials.',
      focusTaskOnly: 'You have {{t}} to-dos due today. Finish them early.',
      focusEventOnly: 'You have {{e}} events today. Mind the timing.',
      chipClass: 'Classes',
      chipDueTask: 'Due to-dos',
      chipEvent: 'Events',

      // ── Task trend widget ──
      streakNDays: '{{n}}-day streak',
      taskTrendTitle: 'To-do completion trend',
      doneInPeriod: 'Completed',
      newInPeriod: 'Added',
      unfinished: 'Open',
      heatLastNDays: 'Completion heat (last {{n}} days)',

      // ── Curriculum widget ──
      curriculumTitle: 'Curriculum progress by class',
      details: 'Details',
      noClassesTitle: 'No class data',
      noClassesHint: 'Add classes to start tracking progress.',
      overallCompletionLabel: 'Overall completion',
      inProgressN: '{{n}} in progress',

      // ── Attendance widget ──
      takeAttendance: 'Take attendance',
      last30Overall: 'Last 30 days overall',
      attendanceTitle: 'Attendance',
      noAttendanceTitle: 'No attendance records',
      noAttendanceHint: 'Take attendance to record student presence.',
      attPresent: 'Present',
      attLate: 'Late',
      attAbsent: 'Absent',
      attRecordsN: '{{n}} records total',

      // ── Grades widget ──
      gradebook: 'Gradebook',
      gradesTitle: 'Grade distribution',
      noGradesTitle: 'No grades yet',
      noGradesHint: 'Distribution appears once you enter scores in the gradebook.',
      recentAssessment: 'Recent assessment',
      gradedMaxN: '{{graded}} students · max {{max}}',
      averageLabel: 'Average',

      // ── Follow-up widget ──
      parentComms: 'Parent communication',
      followUpTitle: 'Parents to follow up',
      noFollowUpTitle: 'Nothing to follow up',
      noFollowUpHint: 'All parent contacts have been followed up.',
      followUpBadge: 'Follow up',

      // ── Countdown widget ──
      all: 'All',
      countdownTitle: 'Important date countdown',
      noCountdownTitle: 'No countdowns',
      noCountdownHint: 'Add exams, deadlines, assessments and other key dates.',
      cdToday: 'Today',
      cdDaysLeft: 'days left',

      // ── Class load widget ──
      dailyPeriods: 'Periods per day',
      classLoadTitle: 'This week’s teaching load',

      // ── Quick actions ──
      quickActionsTitle: 'Quick actions',
      qaTasks: 'To-dos',
      qaAttendance: 'Attendance',
      qaGradebook: 'Grade management',
      qaLessonPlan: 'Lesson planning',
      qaTimetable: 'Timetable',
      qaCalendar: 'Calendar',
      qaAi: 'Teaching AI',
      qaParentComms: 'Parent communication',
    },
  },
  true,
  true,
)
