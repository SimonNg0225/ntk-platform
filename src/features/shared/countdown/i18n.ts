import i18n from '../../../i18n'

// 倒數 Countdown — 功能級 i18n bundle（decoupled side-effect）：只加 'en' 嘅 `cd` namespace。
i18n.addResourceBundle(
  'en',
  'translation',
  {
    cd: {
      // URGENCY statuses
      urgencyFinal: 'Final call',
      urgencyBoarding: 'Now boarding',
      urgencyOnTime: 'On time',
      urgencyArrived: 'Arrived',

      // Category labels
      catExam: 'Exam',
      catDeadline: 'Deadline',
      catAssessment: 'Assessment',
      catEvent: 'Event',
      catOther: 'Other',

      // Urgency hint sentences
      hintToday: 'Today is the big day — go for it!',
      hintTomorrow: 'Tomorrow is the day — get to the gate',
      hint3Days: 'Boarding soon — final sprint',
      hint7Days: 'Within a week — remember to check in',
      hint14Days: 'Two weeks away — start packing',
      hint30Days: 'Within a month — time to start planning',
      hintFar: 'Flight is scheduled — relax for now',

      // Card strings
      cardCategoryFallback: 'Event',
      cardGate: 'Gate',
      cardDeleteLabel: 'Delete "{{title}}"',
      cardTodayAriaLabel: "Today's departure",
      cardDepart: 'departs today',
      cardDaysAfter: 'days to go',
      cardDaysBefore: 'days ago',
      cardDaysAfterSuffix: 'days to go',
      cardDaysBeforeSuffix: 'days ago',
      dayUnit: 'days',
      cardProgressLabel: '{{days}} days to departure',
      cardStatus: 'Status',

      // Hero section
      heroDepartures: 'Departures · Key dates',
      heroKicker: 'Departures · Schedule',
      heroTitle: 'Key Date Countdown',
      heroNoCountdowns: 'No countdowns yet',
      heroNearestLabel: '{{days}} days to next event',
      heroDaysUnit: 'days',
      heroEmptyDesc: 'Add exams, deadlines, assessments and events — register a date and see at a glance how long until departure.',
      heroTodayDesc: "Today is the big day — ready to depart!",
      heroCountDesc: '{{count}} flights boarding · {{hint}}',

      // Buttons / actions
      btnRegister: 'Add new flight',
      btnSubscribe: 'Subscribe to calendar',

      // Stats bar
      statBoarding: 'Boarding',
      statNext: 'Next',
      statDayUnit: 'd',
      statArrived: 'Arrived',

      // Tabs
      tabUpcoming: 'Boarding',
      tabPast: 'Arrived',

      // Filter pills
      filterAll: 'All',
      groupFlightUnit: 'flights',

      // Empty states
      emptyGateTitle: 'No flights at this gate',
      emptyGateHint: 'Select "All", or tap another gate above.',
      emptyGateAction: 'Show all',
      emptyBoardTitle: 'Schedule is empty — add your first flight',
      emptyBoardHint: 'Exams, assignments, birthdays, trips… add a date to your departure board and see at a glance how long until take-off.',
      emptyBoardAction: 'Add first flight',
      emptyPastTitle: 'No flights have arrived yet',
      emptyPastHint: 'Past dates will appear here as "Arrived" — a record of milestones you have flown through.',

      // Toasts
      toastAdded: 'Countdown added',
      toastDeleted: 'Countdown deleted',

      // Confirm dialog
      confirmDeleteTitle: 'Delete countdown?',
      confirmDeleteMsg: 'Delete "{{title}}"? This action cannot be undone.',
      confirmDeleteBtn: 'Delete',

      // Modal
      modalClose: 'Close',
      modalCheckinKicker: 'Check-in · Register flight',
      modalTitle: 'Add new flight',
      modalNoDraftDate: 'No date',
      modalFieldTitle: 'Flight name (what are you counting down to?)',
      modalFieldTitlePlaceholder: 'e.g. Final exam, Submit report, Trip',
      modalDepartureKicker: 'Departure · Schedule',
      modalFieldDate: 'Departure date',
      modalFieldTime: 'Time (optional)',
      modalGateKicker: 'Gate · Category (optional)',
      modalFieldNotes: 'Notes (optional)',
      modalFieldNotesPlaceholder: 'Details to remember, e.g. venue, scope…',
      modalStatusNeedDate: 'Pick a date',
      modalBtnCancel: 'Cancel',
      modalBtnSubmit: 'Add flight',
    },
  },
  true,
  true,
)
