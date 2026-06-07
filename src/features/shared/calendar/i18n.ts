import i18n from '../../../i18n'

// ============================================================
//  Calendar 功能嘅英文 resource bundle（namespace: cal）
//  ------------------------------------------------------------
//  zh-HK 維持原文（喺 t() 用 defaultValue 提供），只補 'en' 一份。
//  deepMerge=true, overwrite=true。
// ============================================================

i18n.addResourceBundle(
  'en',
  'translation',
  {
    cal: {
      // ── 頁面身份 / masthead ──
      kicker: 'Calendar',
      title: 'Calendar',

      // ── 視圖切換 ──
      viewDay: 'Day',
      viewWeek: 'Week',
      viewMonth: 'Month',
      viewYear: 'Year',
      eyebrowDay: 'Today',
      eyebrowWeek: 'This Week',
      eyebrowMonth: 'This Month',
      eyebrowYear: 'This Year',
      yearTitle: '{{year}}',

      // ── 導覽 / 工具列 ──
      prev: 'Previous',
      next: 'Next',
      today: 'Today',
      add: 'Add',
      manage: 'Manage',
      exportIcs: 'Export .ics',
      subscribe: 'Subscribe on phone',
      calVisibleShow: '{{name}} (showing, tap to hide)',
      calVisibleHide: '{{name}} (hidden, tap to show)',

      // ── 拖拉重複事件提示 ──
      recurringDragBlocked: 'Open the editor to adjust a repeating event (choose "This event only" or "All events")',

      // ── 月／週視圖 ──
      moreCount: '{{count}} more',
      dayAria: '{{month}}/{{day}}, {{count}} events',
      allDay: 'All day',
      monthUnit: '',
      yearDayAria: '{{month}}/{{day}}',
      yearDayAriaHas: '{{month}}/{{day}}, has events',
      weekdayLong_0: 'Sun',
      weekdayLong_1: 'Mon',
      weekdayLong_2: 'Tue',
      weekdayLong_3: 'Wed',
      weekdayLong_4: 'Thu',
      weekdayLong_5: 'Fri',
      weekdayLong_6: 'Sat',
      createAtAria: 'Add {{time}}',

      // ── EventEditor 頁眉 ──
      entryEyebrowEdit: 'Entry',
      entryEyebrowNew: 'New Entry',
      editEvent: 'Edit event',
      newEvent: 'New event',
      close: 'Close',

      // ── EventEditor 欄位 ──
      titlePlaceholder: 'What would you like to schedule?',
      location: 'Location',
      locationPlaceholder: 'Where? (optional)',
      timeSection: 'Time',
      allDayEvent: 'All-day event',
      start: 'Start',
      end: 'End',
      calendar: 'Calendar',
      noCalendars: '(no calendars)',
      repeatSection: 'Repeat',
      repeat: 'Repeat',
      every: 'Every',
      unitDay: 'day(s)',
      unitWeek: 'week(s)',
      unitMonth: 'month(s)',
      unitYear: 'year(s)',
      pickWeekdays: 'Repeat on which days (leave blank to follow start date)',
      until: 'Repeat until (optional, leave blank to repeat forever)',
      alertSection: 'Alert & link',
      alert: 'Alert',
      url: 'URL',
      urlPlaceholder: 'https:// (optional)',
      notes: 'Notes',
      notesPlaceholder: 'Anything to add? (optional)',
      onSchedule: 'On the schedule',
      untitledEvent: 'Untitled event',
      hasNotes: 'Has notes',

      // ── 重複選項 ──
      freqNone: "Doesn't repeat",
      freqDaily: 'Daily',
      freqWeekly: 'Weekly',
      freqMonthly: 'Monthly',
      freqYearly: 'Yearly',

      // ── 提醒選項 ──
      alertNone: 'No alert',
      alertAtTime: 'At time of event',
      alert5: '5 minutes before',
      alert15: '15 minutes before',
      alert30: '30 minutes before',
      alert60: '1 hour before',
      alert1440: '1 day before',

      // ── 動作按鈕 ──
      delete: 'Delete',
      cancel: 'Cancel',
      save: 'Save',
      addToCalendar: 'Add to calendar',

      // ── 刪除確認 ──
      deleteEventTitle: 'Delete event?',
      deleteEventMessage: 'Are you sure you want to delete "{{title}}"? This cannot be undone.',
      deleteConfirm: 'Delete',

      // ── Toast ──
      savedEvent: 'Event saved',
      addedEvent: 'Event added',
      updatedAllEvents: 'All events updated',
      updatedThisEvent: 'This event updated',
      deletedEvent: 'Event deleted',
      deletedThisEvent: 'This event deleted',
      deletedAllEvents: 'All events deleted',

      // ── 重複系列範圍 ──
      seriesEyebrow: 'Series',
      deleteSeriesTitle: 'Delete repeating event',
      updateSeriesTitle: 'Update repeating event',
      seriesPromptDelete: '"{{title}}" is a repeating event. Which would you like to delete?',
      seriesPromptUpdate: '"{{title}}" is a repeating event. Which would you like to update?',
      deleteThisDay: 'Delete only this day ({{date}})',
      updateThisDay: 'Update only this day ({{date}})',
      deleteWholeSeries: 'Delete the whole series',
      updateWholeSeries: 'Update the whole series',

      // ── CalendarManager ──
      managerEyebrow: 'Calendars',
      manageCalendars: 'Manage calendars',
      hide: 'Hide',
      show: 'Show',
      calendarName: 'Calendar name',
      deleteCalendar: 'Delete calendar',
      newCalendarName: 'New calendar name',
      addedCalendar: 'Calendar added',
      deletedCalendar: 'Calendar deleted',
      deleteCalendarTitle: 'Delete calendar?',
      deleteCalendarMessage: '"{{name}}" will be deleted. Existing events become uncategorised (still kept).',

      // ── IcsExportModal ──
      exportEyebrow: 'Export',
      exportCalendar: 'Export calendar',
      countSuffix: '{{count}} items',
      itemUnit: 'items',
      exportIntro: 'Download a standard iCalendar (.ics) file to import into Apple / Google / Outlook calendars. Only visible calendars are exported; repeating events are expanded into individual occurrences (covering the past 6 months to the next 2 years).',
      exportEventsTitle: 'Calendar events (visible)',
      exportCountdownsTitle: 'Countdowns (all)',
      willExport: 'Will export',
      coverage: 'Covers {{start}} → {{end}}',
      downloadIcs: 'Download .ics',
      pickTypeFirst: 'Pick which types to export first',
      exportName: 'EziTeach calendar export',
      exportedCount: 'Exported {{count}} items to .ics',
      exportedEmpty: 'Exported (nothing for now)',

      // ── CalendarSubscribe ──
      subscribeEyebrow: 'Subscribe',
      subscribeTitle: 'Subscribe on phone',
      needCloudTitle: 'Connect to the cloud to subscribe',
      needCloudBody: 'A subscription calendar relies on a cloud feed so your phone / iPad can sync regularly and show native reminders. This device is not connected to the cloud yet — you can use "Export .ics" on the calendar page to import once.',
      needLoginTitle: 'Sign in to subscribe',
      needLoginBody: 'Once signed in you get a personal link; subscribe once on your phone / iPad and your calendar and important dates sync automatically and remind you on time.',
      signInWithGoogle: 'Sign in with Google',
      linkUnavailableTitle: "Couldn't build the link",
      linkUnavailableBody: "Couldn't read the cloud URL setting (VITE_SUPABASE_URL). Please check the deployment settings and try again.",
      subscribeIntroPre: 'Tap the link below on your iPhone / iPad to subscribe. Your calendar events and important dates will then sync automatically into Apple Calendar and notify you on time with ',
      subscribeIntroNative: 'native reminders',
      subscribeIntroPost: '.',
      yourSubscribeLink: 'Your subscription link',
      copyLink: 'Copy link',
      openOnApple: 'Open on Apple device',
      subscribeOnDevice: 'Subscribe on iPhone / iPad',
      stepTapPre: 'On your iPhone / iPad, ',
      stepTapBold: 'tap the link above',
      stepTapPost: ' → "Subscribe to Calendar" appears → tap "Subscribe".',
      stepManualPre: 'Or manually: open ',
      stepManualBold: '"Settings" → "Calendar" → "Accounts" → "Add Account" → "Add Subscribed Calendar"',
      stepManualPost: ', then paste the link.',
      stepDone: 'Once subscribed, Apple Calendar will pop native reminders on time (how early follows the alert you set on each event).',
      securityNote: 'The link is read-only and only exposes your own event titles and times. If you think the link has leaked, you can regenerate it anytime — the old link stops working immediately.',
      regenerateLink: 'Regenerate link',
      copied: 'Link copied',
      copyFailed: 'Copy failed, long-press the link to copy manually',
      rotateTitle: 'Regenerate link?',
      rotateMessage: 'The old link stops working immediately. If you already subscribed on your phone / iPad, delete the old subscription and re-subscribe with the new link.',
      rotateConfirm: 'Regenerate',
      rotated: 'New link generated, old link disabled',
    },
  },
  true,
  true,
)
