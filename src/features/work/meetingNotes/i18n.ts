import i18n from '../../../i18n'

// 會議記錄 MeetingNotes — 功能級 i18n bundle（decoupled side-effect）：只加 'en' 嘅 `meet` namespace。
i18n.addResourceBundle(
  'en',
  'translation',
  {
    meet: {
      // masthead
      kicker: 'Minutes · Meeting Minute Book',
      title: 'Meeting Notes',
      subtitle_notes: '{{count}} notes · {{total}} follow-ups',
      subtitle_open: '{{count}} pending',
      subtitle_clear: 'All followed up',
      addNote: 'New note',

      // tally strip
      tally_notes_label: 'Meeting notes',
      tally_notes_unit: '',
      tally_notes_hint: 'Total meetings recorded',
      tally_open_label: 'Pending',
      tally_open_unit: '',
      tally_open_hint: '{{total}} total · {{pct}}% done',
      tally_overdue_label: 'Overdue',
      tally_overdue_unit: '',
      tally_overdue_hint_urgent: 'Needs immediate attention',
      tally_overdue_hint_ok: 'All good',
      tally_soon_label: 'Due in 7 days',
      tally_soon_unit: '',
      tally_soon_hint_action: 'Schedule time to follow up',
      tally_soon_hint_ok: 'Nothing due soon',

      // tabs
      tab_notes: 'Notes',
      tab_actions: 'Action centre',
      tab_stats: 'Statistics',

      // notes view — search / sort / filter
      search_placeholder: 'Search title, content, attendees, decisions, actions…',
      sort_date_desc: 'Date (new → old)',
      sort_date_asc: 'Date (old → new)',
      sort_title: 'Title',
      sort_updated: 'Recently updated',
      sort_actions: 'Open actions',
      filter_all: 'All',
      tag_label: 'Tags:',
      tag_filter_all: 'All',
      tag_aria: 'Filter tag {{tag}}',

      // sr-only status
      sr_filtered: '{{count}} notes match filters',
      sr_total: '{{count}} notes total',

      // empty states
      empty_new_title: 'Minute book — first page',
      empty_new_hint: 'Start with the first agenda item — click "New note" to record this meeting, or apply an agenda template first.',
      empty_new_cta: 'Record the first meeting',
      empty_search_title: 'No matching notes found',
      empty_search_hint: 'Try clearing search terms, type or tag filters and look again.',

      // section titles
      section_pinned: 'Pinned agenda',
      section_all: 'All notes',

      // note row
      row_open_aria: 'Open note: {{title}}',
      row_attendees: '{{count}} people',
      row_attendees_unit: 'people',
      badge_decisions: 'Decisions {{count}}',
      badge_open_actions: '{{count}} pending',
      badge_all_done: '{{count}} all done',
      badge_overdue: ' · {{count}} overdue',
      pin_tooltip: 'Pin',
      unpin_tooltip: 'Unpin',
      pin_aria: 'Pin',
      unpin_aria: 'Unpin',
      menu_more_aria: '{{title}} more actions',
      menu_edit: 'Edit',
      menu_duplicate: 'Duplicate as new note',
      menu_copy: 'Copy text',
      menu_print: 'Print / PDF',
      menu_delete: 'Delete',

      // due badges
      due_overdue: 'Overdue',
      due_soon: 'Due soon',

      // action row
      action_mark_done: 'Mark complete',
      action_mark_undone: 'Mark incomplete',

      // owner group
      owner_unassigned: 'Unassigned',
      owner_overdue: 'Overdue {{count}}',
      owner_pending: '{{count}} pending',

      // action centre — segments
      seg_open: 'Pending ({{count}})',
      seg_overdue: 'Overdue ({{count}})',
      seg_soon: 'Due soon ({{count}})',
      seg_done: 'Done ({{count}})',
      seg_all: 'All ({{count}})',
      actiongroup_list: 'List',
      actiongroup_owner: 'By owner',

      // action centre empty
      actions_empty_blank: 'Action list is empty',
      actions_empty_blank_hint: 'Use - [ ] in note content to add action items, or add them one by one in the editor — they will be tracked here.',
      actions_empty_done: 'All follow-ups ticked off — clean!',
      actions_empty_filter: 'No items match the filter',
      sr_owner_groups: '{{count}} owners have pending items',

      // owner group empty
      owner_empty_title: 'Everyone is done — good job!',
      owner_empty_hint: 'All actions are completed, or no follow-up items have been assigned.',

      // stats view
      stats_empty_title: 'Statistics page — not started yet',
      stats_empty_hint: 'Record a few meetings and trends and charts will appear here.',
      stats_monthly_title: 'Meetings in last 6 months',
      stats_type_title: 'Meeting type distribution',
      stats_completion_title: 'Action item completion',
      stats_attendees_title: 'Common attendees',
      stats_monthly_empty: 'No meetings recorded in this period',
      stats_monthly_bar_unit: ' meetings',
      stats_type_empty: 'No category data',
      stats_donut_label: 'meetings',
      stats_ring_done: 'Done',
      stats_ring_pending: 'Pending',
      stats_attendees_empty: 'No attendees recorded in notes',
      stats_overdue_badge: 'Overdue {{count}}',
      stats_soon_badge: '7-day {{count}}',

      // detail modal
      detail_duration: '· {{min}} min',
      detail_attendees: 'Attendees ({{count}})',
      detail_content: 'Note content',
      detail_decisions: 'Decisions ({{count}})',
      detail_actions: 'Follow-up actions ({{done}}/{{total}})',
      detail_inline_hint: '{{count}} action item(s) detected in content. Click "Extract" when editing to turn them into a checkable list and track in the action centre.',
      detail_copy: 'Copy text',
      detail_print: 'Print / PDF',
      detail_edit: 'Edit',

      // duplicate
      duplicate_title_suffix: '{{title}} (copy)',

      // date format
      weekday_sun: 'Sun',
      weekday_mon: 'Mon',
      weekday_tue: 'Tue',
      weekday_wed: 'Wed',
      weekday_thu: 'Thu',
      weekday_fri: 'Fri',
      weekday_sat: 'Sat',
      long_date_format: '{{year}}/{{month}}/{{day}} · {{weekday}}',

      // toasts
      toast_saved: 'Note saved',
      toast_added: 'Note added',
      toast_copied_note: 'Note duplicated',
      toast_deleted: 'Note deleted',
      toast_print_fail: 'Cannot open print window — please check your browser pop-up settings',
      toast_copy_ok: 'Copied to clipboard',
      toast_copy_fail: 'Copy failed',

      // confirm dialog
      confirm_delete_title: 'Delete note?',
      confirm_delete_message: '"{{title}}" and all follow-up items will be permanently deleted and cannot be recovered.',
      confirm_delete_btn: 'Delete',

      // editor
      editor_kicker_create: 'Minutes · Draft',
      editor_kicker_edit: 'Minutes · Revise',
      editor_heading_create: 'Draft new agenda',
      editor_heading_edit: 'Revise agenda',
      editor_unnamed: '· Untitled note',
      editor_close: 'Close',
      editor_cancel: 'Cancel',
      editor_save_edit: 'Save to minute book',
      editor_save_create: 'Record agenda',

      // editor — agenda name / type
      agenda_name_label: 'Agenda name',
      agenda_name_placeholder: 'e.g. Subject panel meeting — No. 2',
      meeting_type_label: 'Meeting type',

      // editor §1
      s1_kicker: 'Convening',
      s1_title: 'Meeting details',
      s1_date: 'Date',
      s1_time: 'Time',
      s1_duration: 'Duration (min)',
      s1_location: 'Location',
      s1_location_placeholder: 'Meeting room',

      // editor §2
      s2_kicker: 'Present',
      s2_title: 'Attendees',
      s2_attendees_count: '{{count}} people',
      s2_placeholder_empty: 'Enter name, press Enter to add',
      s2_placeholder_more: 'Add more…',
      s2_remove_aria: 'Remove {{name}}',

      // editor §3
      s3_kicker: 'Minutes',
      s3_title: 'Note content',
      s3_apply_template: 'Apply template',
      s3_extract_tooltip: 'Auto-extract actions and decisions from - [ ] / > in content',
      s3_extract_btn: 'Extract',
      s3_content_placeholder: 'Meeting highlights…\n\nTips:\n- [ ] Action item (add @owner !2026-06-01)\n> Decision',
      s3_hint_pre: 'Supports',
      s3_hint_action: '- [ ]',
      s3_hint_at: '@person !date',
      s3_hint_mid: 'and',
      s3_hint_decision: '>',
      s3_hint_post: 'decisions; click "Extract" to move them to the structured list below.',

      // editor §4
      s4_kicker: 'Resolutions',
      s4_title: 'Decisions',
      s4_placeholder: 'Add a decision, press Enter…',
      s4_delete_aria: 'Delete decision',

      // editor §5
      s5_kicker: 'Action items',
      s5_title: 'Follow-up actions',
      s5_add_btn: 'Add item',
      s5_empty_hint_pre: 'No follow-up items yet. Add manually, or use',
      s5_empty_hint_code: '- [ ]',
      s5_empty_hint_post: 'in the content then click "Extract".',
      s5_item_placeholder: 'Follow-up item…',
      s5_owner_placeholder: 'Owner',
      s5_mark_done_aria: 'Mark complete',
      s5_mark_undone_aria: 'Mark incomplete',
      s5_delete_item_aria: 'Delete item',

      // editor §6
      s6_kicker: 'Index tags',
      s6_title: 'Tags',
      s6_placeholder: 'Comma or space separated, e.g.: personnel finance curriculum',
    },
  },
  true,
  true,
)
