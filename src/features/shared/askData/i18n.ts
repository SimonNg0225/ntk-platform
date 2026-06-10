import i18n from '../../../i18n'

// 問數據 AskData — 功能級 i18n bundle（decoupled side-effect）：只加 'en' 嘅 `askd` namespace。
i18n.addResourceBundle(
  'en',
  'translation',
  {
    askd: {
      // Header
      headerLabel: 'Inquiry Desk · Inquiry Desk',
      headerTitle: 'Ask My Data AI',
      headerDesc: 'Open a case. I answer only from your ',
      headerDescStrong: 'own records',
      headerDescSuffix: ' — notes, tasks, goals and events — with evidence, no guessing.',

      // 守門 / 空狀態
      gateNotEnabledTitle: 'AI not enabled',
      gateNotEnabledHint: 'You need to set up Supabase and deploy the gemini Edge Function first. See docs/SETUP.md for steps.',
      gateLoginTitle: 'Please sign in to use AI',
      gateLoginHint: 'Sign in with Google at the bottom-left to get started.',

      // 證據在案
      evidenceSectionLabel: 'Evidence on File',
      evidenceSectionHeading: 'Evidence on File',
      evidenceFilesCount: '{{count}} files available',
      evidenceEmpty: 'The case file is still empty. Add some notes, tasks, or goals and I\'ll have something to search.',

      // Evidence tile labels
      evidenceLabelNotes: 'Notes',
      evidenceLabelTasks: 'Tasks',
      evidenceLabelGoals: 'Goals',
      evidenceLabelEvents: 'Events',

      // 建議查詢
      suggestionsLabel: 'Start a query here',
      suggestionsLabelContinue: 'Continue investigating',
      suggestion0: 'What are my important events this week?',
      suggestion1: 'Summarise key points from my recent notes',
      suggestion2: 'What tasks do I still have unfinished?',
      suggestion3: 'Based on my goals, suggest what to do next',

      // 對話氣泡
      bubbleYouLabel: 'Your query',
      bubbleAiLabelError: 'Inquiry Desk',
      bubbleAiLabelAnswer: 'Desk Review',

      // 錯誤
      errorTitle: 'Sorry, something went wrong',
      errorRetry: 'Try again',

      // 載入
      loadingText: 'Searching your records…',

      // 查詢單
      inputAriaLabel: 'Query your data',
      inputPlaceholder: 'What would you like to know? E.g. What\'s most important for me this week?',
      stopButton: 'Stop',
      sendButton: 'Query',

      // 底部提示
      keyboardHint: 'Enter to send · Shift + Enter for newline',
      dataHint: 'Only references your own data',
    },
  },
  true,
  true,
)
