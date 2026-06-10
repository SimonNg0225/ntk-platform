import i18n from '../../../i18n'

// 收件箱 Inbox — 功能級 i18n bundle（decoupled side-effect）：只加 'en' 嘅 `inbox` namespace。
i18n.addResourceBundle(
  'en',
  'translation',
  {
    inbox: {
      // ── filter tabs ──────────────────────────────────────────
      tabInbox: 'Inbox',
      tabArchived: 'Archived',

      // ── masthead ─────────────────────────────────────────────
      mastheadKicker: 'Inbox · Note desk',
      mastheadTitle: 'Quick capture',
      mastheadSub: 'Drop a thought',
      mastheadHint: 'Write it down in a second, sort it out later.',
      mastheadPending: '{{count}} item left to clear',
      statsLabel: 'Stats',
      statsExpand: 'Expand stats',
      statsCollapse: 'Collapse stats',

      // ── capture box ──────────────────────────────────────────
      capturePlaceholder: 'Jot down anything here…  e.g. "Remember to submit IES draft #homework"',
      capHintAdd: 'Add ',
      capHintTags: ' tags · press ',
      capHintFocus: ' to focus · ',
      capHintSearch: ' to search',
      captureKindBadge: 'Looks like {{kind}}',
      captureSubmit: 'Drop it',

      // ── stale banner ─────────────────────────────────────────
      staleBanner: '{{count}} item{{plural}} stuck for over {{days}} days — don\'t let them sink.',
      staleSortOldest: 'Sort oldest first',
      sortOldestActive: 'Sorted oldest-first — tackle the longest-waiting item first.',
      sortOldestReset: 'Reset order',

      // ── stats panel labels ───────────────────────────────────
      statPending: 'Pending',
      statPendingHintNone: 'All clear, nice work',
      statPendingHintSome: 'Take some time to clear it',
      statToday: 'Captured today',
      statTodayHint: 'Thoughts captured today',
      statWeek: 'Last 7 days',
      statWeekHint: 'Weekly capture count',
      statArchived: 'Archived',
      statArchivedHint: 'All sorted items are here',

      // ── stats chart section titles ───────────────────────────
      chartCaptureTrend: 'Capture trend',
      chartKindDistribution: 'Kind distribution',
      chartBarTooltip: '{{key}}: {{count}} captured',
      chartTrendTotal: '{{count}} captured in the last 14 days',
      chartNoPending: 'No pending items',

      // ── stats oldest warning ─────────────────────────────────
      oldestWarning: 'The oldest item has been in your inbox for {{time}} — remember to clear it.',

      // ── toolbar ──────────────────────────────────────────────
      searchPlaceholder: 'Search captures or #tags…',
      aiBusy: 'AI classifying',
      aiSuggest: 'AI suggest kinds',

      // ── filter pills ─────────────────────────────────────────
      filterAll: 'All',
      filterTagLabel: 'Tags',
      clearTagFilter: 'Clear tag filter "{{tag}}"',

      // ── AI accept-all banner ─────────────────────────────────
      aiBannerText: 'AI has suggested kinds for some items — accept one by one or apply all at once.',
      aiApplyAll: 'Apply all',

      // ── batch toolbar ────────────────────────────────────────
      batchCount_inbox: 'Inbox {{count}} item{{plural}}',
      batchCount_archived: 'Archived {{count}} item{{plural}}',
      batchSelected: '{{count}} selected',
      batchSelectAll: 'Select all',
      batchCancel: 'Cancel',
      batchSelect: 'Select',
      batchConvertPrefix: 'Convert to:',
      batchArchive: 'Archive',
      batchDelete: 'Delete',

      // ── list group ───────────────────────────────────────────
      groupItemCount: '{{count}} item{{plural}}',

      // ── empty states ─────────────────────────────────────────
      emptyDeskTitle: 'Desk is clean',
      emptyDeskBody: 'Write down anything the moment it pops up — no need to sort it yet. Come back later and turn each note into a task, note or calendar event.',
      emptyDeskExamples: 'e.g.',
      emptyDeskEx1: 'Remember to collect test paper',
      emptyDeskEx2: 'Final exam May 8',
      emptyDeskEx3: 'An app idea #idea',
      emptyDeskCta: 'Drop your first thought',
      emptyArchivedTitle: 'No archived items yet',
      emptyArchivedHint: 'Processed items are stored here and can be restored any time.',
      emptyFilteredTitle: 'No matching items',
      emptyFilteredHint: 'Try clearing your search or filters and looking again.',

      // ── keyboard hints ───────────────────────────────────────
      kbNavHint: 'navigate',
      kbKindHint: 'classify & convert',
      kbArchiveHint: 'archive',
      kbPinHint: 'pin',
      kbSelectHint: 'multi-select',

      // ── confirm dialogs ──────────────────────────────────────
      confirmDeleteTitle: 'Delete permanently?',
      confirmDeleteMessage: 'This item will be deleted and cannot be recovered. If you just want to clear your inbox, use Archive instead.',
      confirmDeleteConfirm: 'Delete',
      confirmBulkDeleteTitle: 'Delete {{count}} items permanently?',
      confirmBulkDeleteMessage: 'This action cannot be undone.',

      // ── toast messages ───────────────────────────────────────
      toastArchivedAsRef: 'Archived as reference',
      toastAddedToCalendar: 'Added to calendar',
      toastDeleted: 'Deleted',
      toastArchived: 'Archived',
      toastRestored: 'Restored',
      toastNoPending: 'No pending items to classify.',
      toastAiDone: 'AI suggested kinds for {{count}} items',
      toastAiNoResult: 'AI could not classify items — please try again.',
      toastAiError: 'AI classification failed',
      toastAiApplied: 'Applied {{count}} AI suggestions',
      toastAiNoneToApply: 'No suggestions to apply',
      toastCalendarNeedsDate: 'Calendar items need a date each — please convert one at a time.',
      toastKindShort: '{{short}}',
      toastBulkConverted: 'Converted {{count}} items',
      toastBulkArchived: 'Archived {{count}} items',
      toastBulkDeleted: 'Deleted {{count}} items',

      // ── row card ─────────────────────────────────────────────
      pinLabel: 'Pinned',
      kindGuessed: '(estimated)',
      convertedTo: 'Converted to {{kind}}',
      aiSuggestionPrefix: 'AI thinks it looks like {{kind}}',
      aiSuggestionReason: ': {{reason}}',
      aiAccept: '· Accept',
      pinTooltipOn: 'Unpin',
      pinTooltipOff: 'Pin',
      restoreTooltip: 'Restore',
      archiveTooltip: 'Archive',
      moreActions: 'More actions',
      triageLabel: 'Convert to:',
      triageKindTooltip: '{{short}} (press {{num}})',
      openFeature: 'Open {{kind}} feature',
      deletePermanent: 'Delete permanently',

      // ── event draft modal ────────────────────────────────────
      eventModalKicker: 'Inbox · To calendar',
      eventModalTitle: 'Pick a date',
      eventModalSub: 'for this note to land',
      eventModalClose: 'Close',
      eventModalTimeSection: 'When',
      eventModalDateLabel: 'Date',
      eventModalAllDay: 'All-day event',
      eventModalAllDayHint: 'No time needed',
      eventModalTimeLabel: 'Time',
      eventModalCancel: 'Keep in inbox',
      eventModalConfirm: 'Add to calendar',
    },
  },
  true,
  true,
)
