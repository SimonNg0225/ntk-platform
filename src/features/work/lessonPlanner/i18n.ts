import i18n from '../../../i18n'

// 教案 LessonPlanner — 功能級 i18n bundle（decoupled side-effect）：只加 'en' 嘅 `lesson` namespace。
i18n.addResourceBundle(
  'en',
  'translation',
  {
    lesson: {
      // masthead
      teacherDesk: 'Teacher Workspace',
      lessonPlannerTitle: 'Lesson Planner',
      totalPlansCount: '{{count}} lesson plan(s)',
      thisWeekCount: 'This week: {{count}} lesson(s)',
      templatesBtn: 'Templates',
      newPlanBtn: 'New Plan',

      // almanac stats
      statTotalLabel: 'Total Plans',
      statTotalHintSome: 'Growing steadily',
      statTotalHintEmpty: 'Start with the first one',
      statWeekLabel: 'This Week',
      statWeekHint: 'Mon – Fri',
      statTaughtLabel: 'Taught',
      statTaughtHint: 'Completed lessons',
      statTaughtHintReady: '{{count}} ready',
      statCoverageLabel: 'Coverage',
      statCoverageHint: '{{planned}}/{{total}} topics covered',

      // view segmented control
      viewList: 'List',
      viewWeek: 'Week',
      viewCoverage: 'Coverage',
      sortLabel: 'Sort',
      sortDate: 'Lesson Date',
      sortCreated: 'Newest',
      sortTitle: 'Title',
      sortStatus: 'Status',

      // filter row
      searchPlaceholder: 'Search title / objective / topic…',
      filterAllClasses: 'All Classes',
      filterAllAreas: 'All Areas',
      filterAllTopics: 'All Topics',
      filterAll: 'All',
      clearFilters: 'Clear Filters',

      // empty states
      emptyFilterTitle: 'No plans match the filters',
      emptyFilterHint: 'Try relaxing the filters or search term.',
      emptyFirstTitle: 'Start your first lesson plan',
      emptyFirstHint: 'Planning starts with one lesson — write down phases and materials, or apply a template.',

      // toasts
      toastAdded: 'Lesson plan added',
      toastSaved: 'Lesson plan saved',
      toastDuplicated: 'Lesson plan duplicated',
      toastDupToDate: 'Copied to {{date}}',
      toastTemplateAdded: 'Saved as template',
      toastTemplateDeleted: 'Template deleted',
      toastPlanDeleted: 'Lesson plan deleted',
      toastStatusChanged: 'Status: {{label}}',
      toastPresetApplied: 'Three-phase template applied',
      toastPrintBlocked: 'Pop-up blocked by browser — please allow and try again',
      toastTemplateApplied: 'Template "{{name}}" applied',

      // confirm dialogs
      confirmDeletePlanTitle: 'Delete plan?',
      confirmDeletePlanMessage: '"{{title}}" will be permanently deleted and cannot be undone.',
      confirmDeleteTemplateTitle: 'Delete template?',
      confirmDeleteTemplateMessage: '"{{name}}" will be deleted.',
      confirmDeleteText: 'Delete',

      // plan card
      cardStatusAriaLabel: 'Status: {{label}}, click to cycle',
      cardStatusTooltip: 'Click to cycle status',
      cardTopicLabel: 'Topic',
      cardPhaseCount: '{{count}} phase(s)',
      cardDuration: '{{min}} min',
      cardMaterials: 'Materials',
      cardMenuMore: '{{title}} more actions',
      cardMenuEdit: 'Edit',
      cardMenuDuplicate: 'Duplicate',
      cardMenuDupToDate: 'Copy to date…',
      cardMenuPrint: 'Print',
      cardMenuCycleStatus: 'Cycle status ({{label}})',
      cardMenuDelete: 'Delete',
      cardEditTooltip: 'Edit',
      cardPrintTooltip: 'Print',
      cardEditAriaLabel: 'Edit plan',
      cardPrintAriaLabel: 'Print plan',
      cardPeriodLabel: 'Period {{n}}',
      cardDurationMin: '{{min}} min',

      // week view
      weekPrevLabel: 'Previous week',
      weekNextLabel: 'Next week',
      weekLessonsCount: '{{count}} lesson(s)',
      weekTodayBtn: 'Today',
      weekTodayBadge: 'Today',
      weekDayAdd: 'Add',
      weekDayLabel: '{{day}}',
      weekPeriodLabel: 'P{{n}}',
      weekDurationMin: '{{min}}min',

      // coverage view
      coverageTitle: 'BAFS Curriculum Coverage',
      coverageSubtitle: 'By topic area: taught / planned / all topics',
      coveragePctBadge: '{{pct}}% planned',
      coverageMissingTitle: 'Topics not yet planned',
      coverageAllDoneMsg: 'All topics have lesson plans — great work!',
      coverageAllDoneHint: 'The entire BAFS curriculum has a corresponding lesson plan.',
      coverageMissingHint: 'Click a topic to create a plan for it.',
      coverageLegendTaught: 'Taught',
      coverageLegendPlanned: 'Planned',
      coverageLegendAll: 'All topics',
      coverageLegendNumbers: 'Numbers: taught / planned / total',
      coveragePartRequired: 'Compulsory',
      coveragePartElective: 'Elective',

      // templates modal
      templatesModalTitle: 'Lesson Plan Templates',
      templatesHint: 'Templates contain phase and material scaffolds. Press "Save as Template" when editing to add more.',
      templatesEmptyTitle: 'No templates yet',
      templatesEmptyHint: 'When editing a plan, press "Save as Template" at the bottom to create one.',
      templatePhases: '{{count}} phase(s)',
      templateDuration: '{{min}} min',
      templateMaterials: '{{count}} material(s)',
      templateUseBtn: 'Use This',
      templateDeleteAriaLabel: 'Delete template',

      // duplicate-to-date modal
      dupModalTitle: 'Copy to a Specific Date',
      dupModalBody: 'Copy "{{title}}" and set a new lesson date (the copy will be in draft status).',
      dupModalDateLabel: 'Lesson Date',
      dupModalCancelBtn: 'Cancel',
      dupModalConfirmBtn: 'Copy',

      // plan editor – masthead
      editorKickerEdit: 'Revise Plan',
      editorKickerCreate: 'Lesson Plan',
      editorTitlePlaceholderEdit: 'Edit Plan',
      editorTitlePlaceholderCreate: 'New Plan',
      editorCloseAriaLabel: 'Close',

      // plan editor – tabs
      editorTablistAriaLabel: 'Plan editor sections',
      tabBasic: 'Overview',
      tabBasicHint: 'Title · Class · Objectives',
      tabFlow: 'Lesson Flow',
      tabFlowHint: 'Teaching phase timeline',
      tabMaterials: 'Prep List',
      tabMaterialsHint: 'Materials · Reflection',

      // plan editor – basic tab
      fieldTitle: 'Plan Title',
      fieldTitlePlaceholder: 'e.g. Introduction to HK Business Environment',
      fieldTemplateLabel: 'Start from template (optional)',
      fieldTemplateHint: 'Can be modified after applying; won\'t overwrite existing title',
      fieldTemplateNone: 'No template',
      sectionFilingKicker: 'Filing',
      sectionFilingTitle: 'Filing & Schedule',
      fieldClass: 'Class',
      fieldClassUnset: 'Not specified',
      fieldTopic: 'Topic',
      fieldTopicUnset: 'Not specified',
      fieldDate: 'Lesson Date',
      fieldStatus: 'Status',
      fieldPeriod: 'Period (timetable)',
      fieldPeriodPlaceholder: 'e.g. 3',
      fieldTaughtDate: 'Actual Taught Date',
      sectionObjectivesKicker: 'Objectives',
      sectionObjectivesTitle: 'Learning Objectives',
      fieldObjectivesHint: 'One per line; line breaks preserved when printing',
      fieldObjectivesPlaceholder: '1. Students will be able to…\n2. Students will be able to…',

      // plan editor – flow tab
      sectionFlowKicker: 'Lesson flow',
      sectionFlowTitle: 'Lesson Flow',
      phaseEmptyTitle: 'Plan the lesson rhythm',
      phaseEmptyHint: 'Press "Apply 3-phase" for an intro / instruction / activity framework, or add phases manually.',
      phasePresetBtn: 'Apply 3-phase',
      phaseLabelPlaceholder: 'Phase name (e.g. Hook)',
      phaseDetailPlaceholder: 'Activities, questions, grouping…',
      phaseMoveUpLabel: 'Move phase up',
      phaseDeleteLabel: 'Delete phase',
      phaseMinSuffix: 'min',
      addPhaseBtn: 'Add Phase',

      // plan editor – materials tab
      sectionPrepKicker: 'Prep checklist',
      sectionPrepTitle: 'Prep Checklist',
      matDoneCount: '{{done}}/{{total}} ready',
      matEmptyTitle: 'List what you need for class',
      matEmptyHint: 'Add slides, worksheets, video links; tick when ready — track progress at a glance.',
      matItemPlaceholder: 'e.g. Chapter 3 worksheet',
      matDeleteLabel: 'Delete material',
      addMaterialBtn: 'Add Material',
      sectionReflectionKicker: 'Reflection',
      sectionReflectionTitle: 'Post-lesson Reflection',
      fieldReflectionHint: 'After class, note effectiveness, student responses, improvements (optional)',
      fieldReflectionPlaceholder: 'Today\'s lesson…',

      // plan editor – footer
      editorSaveAsTemplateTooltip: 'Save phases / materials as a reusable template',
      editorSaveAsTemplateBtn: 'Save as Template',
      editorCancelBtn: 'Cancel',
      editorSaveBtn: 'Save',
      editorAddBtn: 'Add',

      // template – unnamed fallback
      templateUnnamed: 'Unnamed Template',

      // clone suffix
      cloneSuffix: ' (Copy)',
    },
  },
  true,
  true,
)
