import i18n from '../../../i18n'

// ============================================================
//  AI 助手 — 介面英文資源（side-effect bundle）
//  ------------------------------------------------------------
//  解耦設計：呢個檔淨係 addResourceBundle('en', …) 注入英文，
//  唔郁共用 i18n/index.ts。namespace 用 'aiasst'，deepMerge +
//  overwrite = true。zh-HK 保持原樣（唔加 bundle）—— 元件度用
//  t('aiasst.<key>', { defaultValue: '<原文廣東話>' }) 取值，
//  廣東話介面 byte-identical。
// ============================================================

i18n.addResourceBundle(
  'en',
  'translation',
  {
    aiasst: {
      // 模式問候 / 標語（MODE_AI）
      greetingLearning: 'I am your personal assistant',
      taglineLearning: 'Explain concepts · Summarise notes · Make practice · Plan revision',
      greetingWork: 'I am your teaching assistant',
      taglineWork: 'Set questions · Write lesson plans · Draft comments · Design activities',

      // 模型標籤
      modelFlash: '⚡ Flash (fast)',
      modelPro: '🧠 Pro (powerful)',

      // 人格標籤（store PERSONAS）
      personaDefault: 'Default',
      personaConcise: 'Concise',
      personaDetailed: 'Detailed',
      personaSocratic: 'Socratic',
      personaExam: 'Exam-style',

      // 守門 / 空狀態
      gateNotEnabledTitle: 'AI Assistant not enabled',
      gateNotEnabledHint:
        'You need to set up Supabase and deploy the gemini Edge Function first. See docs/SETUP.md for steps.',
      gateTestMode: '🧪 Test mode (dev only · skip Supabase)',
      gateLoginTitle: 'Please sign in to use the AI Assistant',
      gateLoginHint: 'Sign in with Google at the bottom-left to start using it.',
      gateTestModeLogin: '🧪 Test mode (dev only · skip login)',

      // 側欄
      closeSidebar: 'Close sidebar',
      sidebarConversations: 'Conversations',
      newConversation: 'New conversation',
      searchConversations: 'Search conversations…',
      emptyArchived: 'No archived conversations',
      emptyNoMatch: 'No conversations found',
      emptyNoThreads: 'No conversations yet — start chatting',
      groupPinned: '📌 Pinned',
      // 時間分組（util TimeBucket）
      bucketToday: 'Today',
      bucketYesterday: 'Yesterday',
      bucketLast7: 'Past 7 days',
      bucketEarlier: 'Earlier',
      backToConversations: 'Back to conversations',
      archive: 'Archive',
      stats: 'Stats',
      defaultThreadTitle: 'Conversation',
      newConversationTitle: 'New conversation',

      // 工具列
      toggleSidebar: 'Toggle sidebar',
      sidebarTooltip: 'Sidebar ({{mod}}+B)',
      personaTooltip: 'Persona',
      temperatureTooltip: 'Creativity (temperature)',
      temperature: 'Temperature',
      contextTooltip: 'Link data as context',
      context: 'Context',
      moreActions: 'More actions',
      menuPalette: 'Command palette  {{mod}}K',
      menuTemplates: 'Template library  {{mod}}/',
      menuExport: 'Export conversation (.md)',
      menuStats: 'Usage stats',

      // 標題列
      filesCount: '{{count}} files',
      rename: 'Rename',
      exportMarkdown: 'Export Markdown',
      export: 'Export',

      // Welcome
      welcomeGreeting: 'Hello, {{greeting}}',
      welcomeSub: 'Where would you like to start? Pick a starting point, or just type what you want to ask.',
      welcomeTryAsking: 'Try asking me',
      welcomeSeeAllTemplates: 'See all templates',

      // 訊息泡泡
      you: 'You',
      aiAssistant: 'AI Assistant',
      aiTyping: 'AI is typing',
      copied: 'Copied',
      copy: 'Copy',
      saveToNote: 'Save to notes',
      editResend: 'Edit & resend',
      edit: 'Edit',
      regenerate: 'Regenerate',
      deleteFromHere: 'Delete from here',
      delete: 'Delete',
      cancel: 'Cancel',
      resend: 'Resend',

      // Composer
      composerPlaceholder: 'Type what you want to ask…  (Enter to send · Shift+Enter for newline · {{mod}}/ templates)',
      templateLibrary: 'Template library',
      templateLibraryTooltip: 'Template library ({{mod}}/)',
      linkContext: 'Link context',
      composerCount: '{{words}} words · ~{{tokens}} tokens',
      stop: 'Stop',
      send: 'Send',

      // Thread 列選單
      threadOptions: 'Conversation options',
      unpin: 'Unpin',
      pin: 'Pin',
      unarchive: 'Unarchive',

      // 加入筆記 Modal
      saveNote: 'Save to notes',
      saveNoteStore: 'Save to notes',
      saveNoteWhich: 'Which notebook to save to',
      saveNoteUncategorised: 'Uncategorised',
      saveNotePreviewPre: 'Content preview · the tag',
      saveNotePreviewPost: 'will be added automatically',

      // 範本庫 Modal
      tplFill: 'Fill in: {{title}}',
      tplBackToTemplates: 'Back to templates',
      tplInsert: 'Insert',
      tplPreview: 'Preview:',
      tplPreviewEmpty: '(fill in the fields above)',
      tplPromptLibrary: 'Prompt template library',
      tplTabBuiltin: 'Built-in',
      tplTabMine: 'Mine ({{count}})',
      tplSearch: 'Search templates…',
      tplNewTitle: 'Template title',
      tplNewBody: 'Template content (use {{vars}} as placeholders, e.g. Explain {{concept}})',
      tplSave: 'Save',
      tplAddCustom: 'Add custom template',
      tplEmptyMineTitle: 'No custom templates yet',
      tplEmptyMineHint: 'Save your frequently used prompts to reuse them in one click.',
      tplUsedTimes: 'Used {{count}} times',
      tplCustom: 'Custom',
      tplHasVars: 'Has variables',

      // toasts（範本）
      tplToastNeedBoth: 'Both title and content are required',
      tplToastAdded: 'Template added',
      tplToastDeleted: 'Deleted',
      tplDeleteConfirmTitle: 'Delete this template?',
      tplDeleteConfirm: 'Delete',

      // 上下文 Modal
      ctxLinkTitle: 'Link context data',
      ctxIntro: 'Pick notes / records as references; the AI will prioritise tying its answers to them. {{count}} selected.',
      ctxTabNote: 'Notes',
      ctxTabMeeting: 'Meetings',
      ctxTabJournal: 'Journal',
      ctxTabText: 'Free text',
      ctxSearch: 'Search…',
      ctxEmptyNote: 'No notes yet',
      ctxEmptyMeeting: 'No meeting records yet',
      ctxEmptyJournal: 'No journal entries yet',
      ctxJournalTitle: 'Journal {{date}}',
      ctxFreeTitlePlaceholder: 'Title (optional)',
      ctxFreeBodyPlaceholder: 'Paste the text you want the AI to reference…',
      ctxFreeDefaultTitle: 'Free text',
      ctxAddContext: 'Add context',
      ctxSelected: 'Selected:',
      ctxRemove: 'Remove: {{title}}',
      ctxRemoveChip: 'Remove context: {{title}}',
      ctxToastEmpty: 'Content cannot be empty',
      ctxToastAdded: 'Context added',

      // 統計 Modal
      statsTitle: 'Usage stats · {{mode}} mode',
      modeWork: 'Work',
      modePersonal: 'Personal',
      statThreads: 'Conversations',
      statUserMsgs: 'I asked',
      statModelMsgs: 'AI answered',
      statMessagesUnit: 'messages',
      statStreak: 'Active streak',
      statStreakUnit: 'days',
      statBusiest: 'Busiest {{label}} ({{count}})',
      statRecent14: 'Active in last 14 days',
      statRatioTitle: 'My / AI message ratio',
      statOther: 'Other',
      statTotalWords: 'Total words (approx.)',
      statAvgPerThread: 'Avg messages per conversation',
      ratioMe: 'Me {{count}}',
      ratioAi: 'AI {{count}}',

      // 重新命名 Modal
      renameTitle: 'Rename conversation',
      renamePlaceholder: 'Conversation name',
      renameSave: 'Save',

      // 命令面板
      paletteActionNew: 'New conversation',
      paletteActionTpl: 'Open template library',
      paletteActionCtx: 'Link context',
      paletteActionStats: 'Usage stats',
      paletteActionExport: 'Export conversation',
      paletteActionSidebar: 'Toggle sidebar',
      palettePlaceholder: 'Find a command or conversation…',
      paletteEmpty: 'Nothing found',
      paletteSectionCommands: 'Commands',
      paletteSectionThreads: 'Conversations',
      paletteMove: 'Move',
      paletteSelect: 'Select',

      // toasts（主畫面）
      toastError: 'AI error',
      toastCopied: 'Copied',
      toastSavedNote: 'Saved to notes',
      toastSavedNoteView: 'View',
      toastDeleteThreadTitle: 'Delete this conversation?',
      toastDeleteThreadMsg: 'The conversation and all messages will be permanently deleted.',
      toastDeleteThreadConfirm: 'Delete',
      toastThreadDeleted: 'Conversation deleted',
      toastEmptyConversation: 'This conversation has no content yet',
      toastExportedMarkdown: 'Markdown exported',

      // 圖表 / markdown
      chartBarTooltip: '{{label}}: {{count}} messages',
      codeCopied: 'Copied',
      codeCopy: 'Copy',
    },
  },
  true,
  true,
)
