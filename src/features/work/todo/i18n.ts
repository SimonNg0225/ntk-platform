import i18n from '../../../i18n'

// ============================================================
//  待辦 / 批改（To-do / Marking）— 功能層 i18n bundle
//  ------------------------------------------------------------
//  解耦模式：本檔只「補」英文資源到既有 'en' / 'translation'
//  namespace（deepMerge + overwrite），唔掂 i18n 核心。
//  zh-HK 維持 byte-identical → 各組件用 t('todo.<key>', {
//  defaultValue: '<原文廣東話>' })，缺 en（或仲喺 zh-HK）時直接
//  fallback 返原文，無需 zh-HK bundle。
//
//  範圍：待辦 / 批改 內部 UI 可見字串（篩選 / 分頁 / 優先級顯示 /
//  按鈕 / 任務編輯欄位 / 空狀態 / 分組標題 / toast / 圖表）。
//  風險字串（test-asserted dueLabel、seed 資料）保留廣東話。
// ============================================================

i18n.addResourceBundle(
  'en',
  'translation',
  {
    todo: {
      // ── masthead / 頁眉 ──
      kicker: 'Marking Desk',
      title: 'To-do / Marking',
      summary: '{{active}} open · {{todayDue}} due today',
      markingPending: '{{count}} to mark',
      templates: 'Templates',
      more: 'More',
      menuSelect: 'Bulk select',
      menuProjects: 'Manage projects',
      menuClear: 'Clear completed',

      // ── 清點帶 / tally ──
      tallyOverdue: 'Overdue',
      tallyTodayDue: 'Due today',
      tallyActive: 'Open',
      tallyDone: 'Done',
      unitItems: '',
      hintOverdueHot: 'Needs follow-up',
      hintOverdueCalm: 'All clear',
      hintTodayHot: 'Get it done today',
      hintTodayCalm: 'Light day today',
      hintActiveMarking: 'incl. {{count}} marking',
      hintActiveCalm: 'Still things to do',
      hintDone: 'Total ticked',

      // ── 快速輸入 / quick add ──
      quickPlaceholder: 'Jot one down… try “mark 5A worksheet !! #teaching @marking +2”',
      quickAdd: 'Add',
      synPriority: 'priority',
      synProject: 'project',
      synTag: 'tag',
      synDueLabel: 'due',
      synDueKeys: 'today / tmr / +N',

      // ── 視圖分頁 / tabs ──
      tabToday: 'Today',
      tabUpcoming: 'Upcoming',
      tabAll: 'All',
      tabStats: 'Stats',

      // ── 搜尋 / 排序 ──
      searchPlaceholder: 'Search tasks, subtasks, notes…',
      searchResult: 'Found {{count}} for “{{kw}}”',
      sortSmart: 'Smart',
      sortPriority: 'Priority',
      sortDue: 'Due',
      sortCreated: 'Created',

      // ── 標籤列 ──
      clear: 'Clear',

      // ── 優先級顯示 / priority (display only) ──
      prio1: 'Highest',
      prio2: 'High',
      prio3: 'Medium',
      prio4: 'None',

      // ── 分組標題 / group headers ──
      groupOverdue: 'Overdue',
      groupToday: 'Today',
      groupTodayDone: 'Ticked today',
      groupTomorrow: 'Tomorrow',
      groupSoon: 'Next 7 days',
      groupLater: 'Later',
      groupNoDue: 'No due date',

      // ── 空狀態 / empty states ──
      emptyTodayTitle: 'Today is clear ☀️',
      emptyTodayHint:
        'Nothing overdue or due today. Add one with quick add above, or check “Upcoming” for what’s ahead.',
      emptyUpcomingTitle: 'Your schedule is empty',
      emptyUpcomingHint: 'Everything’s done, or try adding one above.',
      emptyInboxTitle: 'Your inbox is empty',
      emptyProjectTitle: 'No tasks in this project yet',
      emptyAllHint: 'Add one with quick add above, or pick another project.',
      emptyStatsTitle: 'Stats are still a blank page',
      emptyStatsHint:
        'Add a few to-dos and tick them off — your productivity trend and heatmap will grow here.',

      // ── All view 側欄 ──
      scopeAll: 'All',
      scopeInbox: 'Inbox',
      manageProjects: 'Manage projects',
      taskBook: 'Task book',
      hideDone: 'Hide ticked',
      doneCount: 'Done {{count}}',

      // ── TaskRow aria ──
      ariaUnselect: 'Deselect',
      ariaSelect: 'Select',
      ariaMarkUndone: 'Mark as not done',
      ariaTickMarked: 'Tick (marked)',
      ariaTickDone: 'Tick (done)',
      edit: 'Edit',
      delete: 'Delete',

      // ── 批量操作條 / bulk bar ──
      bulkSelected: 'Selected',
      bulkComplete: 'Complete',
      bulkDue: 'Due',
      bulkPriority: 'Priority',
      bulkMoveTo: 'Move to',
      bulkDelete: 'Delete',
      bulkToday: 'Today',
      bulkTomorrow: 'Tomorrow',
      bulkInAWeek: 'In a week',
      bulkCancel: 'Cancel bulk',

      // ── 確認對話框 / confirm ──
      confirmDeleteTitle: 'Delete to-do?',
      confirmDeleteMsg: '“{{text}}” will be deleted. This cannot be undone.',
      confirmBulkDeleteTitle: 'Delete {{count}} to-dos?',
      confirmBulkDeleteMsg: 'This cannot be undone.',
      confirmClearTitle: 'Clear {{count}} completed?',
      confirmClearMsg: 'All completed to-dos will be deleted. This cannot be undone.',
      confirmText: 'Delete',
      clearText: 'Clear',

      // ── toasts ──
      toastNeedText: 'Please enter task content',
      toastAdded: 'To-do added',
      toastDeleted: 'To-do deleted',
      toastCompletedN: 'Completed {{count}}',
      toastDueSet: 'Due set: {{label}}',
      toastPrioSet: 'Priority set P{{p}}',
      toastMoved: 'Moved',
      toastBulkDeleted: 'Deleted {{count}}',
      toastCleared: 'Cleared completed items',
      toastFromTemplate: 'Created {{count}} to-dos from template',
      toastProjectAdded: 'Project added',
      toastProjectDeleted: 'Project deleted',
      toastSaved: 'Saved',

      // ── 統計視圖 / stats ──
      statStreak: 'Streak',
      unitDays: 'days',
      hintStreakHot: 'Keep it up!',
      hintStreakCalm: 'Finish one today to start',
      statCompletionRate: 'Completion rate',
      hintCompletedInRange: '{{count}} done in {{range}} days',
      statInProgress: 'In progress',
      statTotalDone: 'Total done',
      range14: '14 days',
      range30: '30 days',
      range90: '90 days',
      sectionTrend: 'Completed / added trend',
      sectionByPriority: 'Open · by priority',
      sectionByProject: 'Open · by project',
      centerOpen: 'Open',
      noOpen: 'No open tasks 🎉',
      sectionHeatmap: 'Completion heatmap (last 17 weeks)',

      // ── 專案管理 / ProjectManager ──
      projManagerTitle: 'Manage projects',
      projEmpty: 'No projects yet — add one below.',
      ariaDeleteProject: 'Delete project',
      fieldEmoji: 'Icon',
      fieldName: 'Name',
      fieldColor: 'Colour',
      projNamePlaceholder: 'e.g. Exam prep',
      addProject: 'Add project',
      confirmDeleteProjectTitle: 'Delete project “{{name}}”?',
      confirmDeleteProjectMsgWithTasks:
        '{{count}} tasks in this project won’t be deleted — they’ll move back to the inbox.',
      confirmDeleteProjectMsgEmpty: 'This cannot be undone.',

      // ── 範本 / TemplatePicker ──
      tmplPickerTitle: 'Quick-create from template',
      tmplPickerIntro:
        'Pick a common flow to lay out a set of tasks in one tap (with priority, relative due dates and subtasks) — e.g. the full steps to mark a worksheet.',
      tmplItemCount: '{{count}} items',

      // ── TaskEditor ──
      headerMarking: 'Marking File · Marking',
      headerTask: 'Task Card · Task Card',
      taskDetail: 'Task details',
      stateDone: 'Ticked · done',
      stateMarking: 'To mark',
      stateDue: 'Due {{label}}',
      stateUnticked: 'Not ticked',
      close: 'Close',
      markStamp: 'Mark',
      taskTitlePlaceholder: 'Task title',
      fieldPriority: 'Priority',
      fieldProject: 'Project',
      fieldDue: 'Due',
      optionInbox: 'Inbox',
      quickToday: 'Today',
      quickTomorrow: 'Tomorrow',
      quick3Days: 'In 3 days',
      clearDue: 'Clear due',
      sectionSubtasks: 'Subtasks',
      subtaskPlaceholder: 'Break into smaller steps…',
      subtaskAdd: 'Add',
      ariaDeleteSubtask: 'Delete subtask',
      ariaSubDone: 'Done',
      ariaSubUndone: 'Undo',
      sectionTags: 'Tags',
      tagPlaceholder: 'Type a tag and press Enter…',
      ariaRemoveTag: 'Remove tag {{tag}}',
      sectionNote: 'Note',
      notePlaceholderMarking: 'Marking focus, common mistakes, follow-up…',
      notePlaceholderDefault: 'Extra info, links, context…',
      deleteTask: 'Delete task',
      done: 'Done',
      confirmDeleteTaskTitle: 'Delete this to-do?',
      confirmDeleteTaskMsg:
        '“{{text}}” and its {{count}} subtasks will be deleted, with no way to undo.',

      // ── charts ──
      legendCompleted: 'Done {{count}}',
      legendAdded: 'Added {{count}}',
      heatSummary: 'Last {{days}} days · done',
      heatSummaryItems: 'items · active {{active}} days',
      heatCellTip: 'done {{count}}',
      heatLess: 'less',
      heatMore: 'more',
      hbarsAllClear: 'Every project is cleared 🎉',
    },
  },
  true,
  true,
)
