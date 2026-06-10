import i18n from '../../../i18n'

// 題庫 QuestionBank — 功能級 i18n bundle（decoupled side-effect）：只加 'en' 嘅 `qbank` namespace。
i18n.addResourceBundle(
  'en',
  'translation',
  {
    qbank: {
      // ── MarksStamp ──
      marksUnit: 'pts',
      marksNone: 'No marks',

      // ── Masthead / header ──
      stampKicker: 'Assessment Bank · Assessment Bank',
      stampDecal: 'BAFS · 校本評核',
      kickerLabel: 'Assessment Bank · Assessment Bank',
      title: 'BAFS Question Bank',
      subtitleCount: '{{total}} questions · {{covered}}/{{topicsLen}} topics covered',
      subtitleDifficulty: 'Difficulty index {{label}}',

      // ── SegmentedControl tabs ──
      tabBank: 'Bank',
      tabAnalytics: 'Analytics',
      tabPaper: 'Paper',

      // ── TallyStat cards ──
      tallyTotal: 'Total questions',
      tallyTotalUnit: '',
      tallyTotalHint: 'Questions in the bank',
      tallyReady: 'Ready to use',
      tallyReadyUnit: '',
      tallyReadyHint: 'With answers / full options',
      tallyMarks: 'Total marks',
      tallyMarksUnit: 'pts',
      tallyMarksHint: 'Sum of all question marks',
      tallyDiff: 'Difficulty index',
      tallyDiffHint: '{{label}}',

      // ── BankView toolbar ──
      searchPlaceholder: 'Search stem / options / answer…',
      btnExitSelect: 'Exit select',
      btnSelect: 'Select',
      btnDupCheck: 'Dup. check',
      btnImport: 'Import',
      btnExport: 'Export',
      btnAI: 'AI generate',
      btnAddQuestion: 'Add question',

      // ── Filter / sort card ──
      filterAllTopics: 'All topics',
      filterTypeLbl: 'Type',
      filterDiffLbl: 'Diff.',
      filterAll: 'All',
      btnClearFilters: 'Clear filters',

      // ── Bulk action bar ──
      bulkSelectAll: 'Select all ({{count}})',
      bulkSelected: 'Selected {{count}} · {{marks}} pts',
      bulkChangeTopic: 'Change topic…',
      bulkChangeDiff: 'Change diff…',
      btnBulkDelete: 'Delete',

      // ── SectionLabel: question list ──
      sectionQuestions: 'Questions on paper',
      sectionCount: '{{count}} total',

      // ── Question card / aria ──
      ariaSelectQuestion: 'Select question',
      ariaCopyQuestion: 'Copy question',
      ariaEditQuestion: 'Edit question',
      ariaDeleteQuestion: 'Delete question',

      // ── Marking scheme panel ──
      markingSchemeLabel: 'Marking Scheme · Marking Scheme',
      ariaCorrectAnswer: 'Correct answer',
      noMarkingScheme: 'Marking scheme not yet drafted — tap edit to add.',

      // ── Empty states ──
      emptyFilterTitle: 'No matching questions',
      emptyFilterHint: 'Try relaxing the filters, or use AI generate / import CSV to add more.',
      emptyBankTitle: 'The bank is a blank paper',
      emptyBankHint: 'Start from scratch: draft manually, ask AI to help, or import a ready-made CSV.',
      btnEmptyAdd: 'Add first question',
      btnEmptyAI: 'AI generate',
      btnEmptyClear: 'Clear filters',

      // ── AnalyticsView ──
      analyticsEmptyTitle: 'No questions — charts unavailable',
      analyticsEmptyHint: 'Add a few questions and question-type share, difficulty distribution and topic coverage heatmap will appear here to help you see if your paper is balanced.',
      chartTypeTitle: 'Question type share',
      chartDiffTitle: 'Difficulty distribution',
      chartDiffIndex: 'Paper difficulty index',
      chartTopicsTitle: 'Course topics coverage matrix',
      chartTopRankTitle: 'Topics with the most questions',
      chartTopRankEmpty: 'No data yet',
      chartGapsTitle: 'Coverage gaps',
      gapsAllCovered: 'All topics have questions — full coverage!',
      gapsHint: 'The following topics have no questions yet — consider adding some:',

      // ── PaperStudio ──
      fieldPaperTitle: 'Paper title',
      fieldPaperTitlePlaceholder: 'BAFS Custom Paper',
      fieldClassName: 'Class',
      fieldClassNamePlaceholder: 'e.g. 5A',
      fieldDuration: 'Duration (min)',
      fieldDurationPlaceholder: 'e.g. 60',
      modeManual: 'Pick manually',
      modeAuto: 'Blueprint auto',
      bpHint: 'Set how many questions per difficulty level — the system will randomly draw from the pool and try to cover topics evenly.',
      bpDiffLabel: '{{diff}} (qs)',
      bpTypeLabel: 'Restrict type (optional)',
      bpTypeAll: 'Any',
      bpTopicLabel: 'Restrict topic (none = all {{count}})',
      bpTotalDraw: 'Draw {{total}} in total',
      btnAutoAssemble: 'Auto assemble',

      // ── Pool (left panel) ──
      poolTitle: 'Question pool',
      poolCount: '{{count}} available',
      poolSearchPlaceholder: 'Search stem…',
      poolFilterType: 'Type',
      poolFilterDiff: 'Diff.',
      poolFilterAllTopics: 'All topics',
      ariaAddedToPaper: 'Added',
      ariaAddToPaper: 'Add to paper',
      poolEmpty: 'No questions match the filters',

      // ── Paper preview (right panel) ──
      previewKicker: 'Paper Preview',
      previewCountMarks: '{{count}} qs · {{marks}} pts',
      paperEmptyTitle: 'Paper is still blank',
      paperEmptyHintManual: 'Pick questions from the pool on the left, or switch to "Blueprint auto" to draw in one tap.',
      paperEmptyHintAuto: 'Set how many questions per difficulty and tap "Auto assemble".',
      ariaUp: 'Move up',
      ariaDown: 'Move down',
      ariaRemove: 'Remove',
      btnPrint: 'Print paper',
      btnPrintAnswers: 'Print (with answers)',
      btnSavePaper: 'Save paper',
      btnClearPaper: 'Clear',

      // ── Saved papers ──
      savedPapersTitle: 'Saved papers',
      savedPaperMeta: '{{count}} qs · {{date}}',
      btnLoadPaper: 'Load',
      ariaDeletePaper: 'Delete paper',

      // ── QuestionFormModal ──
      formStampDecal: 'Assessment · Item',
      formTitleEdit: 'Edit question',
      formTitleAdd: 'New question',
      formDecalEdit: 'Edit',
      formDecalAdd: 'Draft',
      ariaClose: 'Close',
      sectionClassification: 'Classification · Classification',
      fieldTopic: 'Topic',
      fieldType: 'Type',
      fieldDifficulty: 'Difficulty',
      fieldStem: 'Stem · Stem',
      stemPlaceholder: 'Enter question stem…',
      fieldOptions: 'Options & correct answer · Options',
      optionsHint: 'Click the serif letter circle to set the correct answer.',
      optionPlaceholder: 'Option {{letter}}',
      correctLabel: 'Correct',
      fieldMarkingScheme: 'Marking Scheme · Marking Scheme',
      markingSchemeHint: "The model answer / marking points the examiner refers to.",
      markingSchemePlaceholder: 'Enter marking scheme…',
      fieldMarks: 'Marks · Marks',
      marksHint: 'Leave blank = this question is unscored.',
      btnCancel: 'Cancel',
      btnSaveEdit: 'Save changes',
      btnSaveAdd: 'Add to bank',

      // ── ImportModal ──
      importTitle: 'Import questions (CSV)',
      importInfoText: 'Columns: topic, type, difficulty, stem, options A–D, answer, marks. Type / difficulty can be Chinese or English; MC answer uses A/B/C/D; topic name is matched to the closest topic. First time? Download the template.',
      btnChooseCsv: 'Choose CSV file',
      btnDownloadTemplate: 'Download template',
      fieldPasteCsv: 'Or paste CSV content directly',
      badgeCanImport: 'Can import {{count}}',
      badgeSkipped: 'Skipped {{count}}',
      moreRows: '…{{count}} more',
      btnCancelImport: 'Cancel',
      btnCommitImport: 'Import ({{count}})',

      // ── DuplicatesModal ──
      dupTitle: 'Duplicate detector',
      dupNoneFound: 'No duplicates or highly similar questions found!',
      dupFoundHint: '{{count}} group(s) of possible duplicates found. Pick one to keep per group; the rest can be removed in one tap.',
      dupExact: 'Exact match',
      dupSimilar: 'Similar {{pct}}%',
      dupGroupCount: '({{count}} qs)',
      btnMerge: 'Merge',
      ariaKeepThis: 'Keep this one',
      btnCloseDup: 'Close',

      // ── toast messages ──
      toastQuestionDeleted: 'Question deleted',
      toastBulkDeleted: 'Deleted {{count}} questions',
      toastTopicMoved: 'Moved {{count}} questions to "{{topic}}"',
      toastDiffChanged: 'Changed {{count}} questions to "{{diff}}"',
      toastDuplicated: 'Question duplicated',
      toastExportNone: 'No questions to export',
      toastExported: 'Exported {{count}} questions (CSV)',
      toastAutoAssembled: 'Auto-assembled {{count}}-question paper',
      toastAutoShortfall: 'Drew {{count}} questions, but {{shortfalls}} (pool insufficient)',
      toastAutoEmpty: 'Not enough questions in the pool — try broadening the scope or adding more.',
      toastSavePaperEmpty: 'No questions — assemble a paper first',
      toastSavedPaper: 'Paper saved',
      toastLoadedPaper: 'Loaded "{{title}}"',
      toastPaperDeleted: 'Paper deleted',
      toastPrintEmpty: 'No questions to print',
      toastPrintBlocked: 'Browser blocked the pop-up — please allow it and try again.',
      toastImportNone: 'No questions to import',
      toastImported: 'Imported {{count}} questions',
      toastQuestionSaved: 'Changes saved',
      toastQuestionAdded: 'Question added',
      toastDupMerged: 'Removed {{count}} duplicate(s)',

      // ── confirm dialogs ──
      confirmDeleteQTitle: 'Delete question?',
      confirmDeleteQMsg: 'This question will be permanently removed from the bank and cannot be recovered.',
      confirmDeleteQBtn: 'Delete',
      confirmBulkDeleteTitle: 'Delete {{count}} question(s)?',
      confirmBulkDeleteMsg: 'Selected questions will be permanently removed and cannot be recovered.',
      confirmBulkDeleteBtn: 'Delete all',
      confirmDeletePaperTitle: 'Delete paper?',
      confirmDeletePaperMsg: 'Will delete "{{title}}" (the questions in the bank are unaffected).',
      confirmDeletePaperBtn: 'Delete',
      confirmMergeTitle: 'Merge duplicates?',
      confirmMergeMsg: 'Will delete {{count}} duplicate question(s), keeping only the one you selected.',
      confirmMergeBtn: 'Merge',

      // ── misc ──
      unclassified: 'Uncategorized',
      dupStemSuffix: ' (Copy)',

      // ── Charts (sub-component) ──
      chartDiffEmpty: 'Add questions and easy / medium / hard distribution will appear here.',
      chartMatrixEmpty: 'Set up topics and add questions — the coverage heatmap will appear here.',
      chartMatrixSortTopic: 'By topic order',
      chartMatrixSortTotal: 'By count',
      chartMatrixColTopic: 'Topic',
      chartMatrixColTotal: 'Total',
      chartMatrixCellTitle: '{{topic}} · {{diff}}: {{count}} qs',
      chartMatrixLegendLow: 'low',
      chartMatrixLegendHigh: 'high',
      chartMatrixZeroHint: 'Red total 0 = topic not yet covered',
    },
  },
  true,
  true,
)
