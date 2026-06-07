import i18n from '../../../i18n'

// ============================================================
//  Gradebook 成績管理 — English bundle (decoupled side-effect)
//  ------------------------------------------------------------
//  zh-HK stays byte-identical via t() defaultValue at call sites;
//  here we only ADD the 'en' resources under the `gradebook` key.
//  deepMerge + overwrite both true so re-import is idempotent.
// ============================================================

i18n.addResourceBundle(
  'en',
  'translation',
  {
    gradebook: {
      // ── Masthead / header ──
      stampLedger: '成績冊 · Ledger',
      kicker: '分數矩陣 · Gradebook',
      title: '成績管理',
      subtitleDefault:
        'Weighted scoring, grade distribution, topic weaknesses and individual report cards — aligned with school assessment standards.',
      subtitleLead:
        'Weighted scoring, grade distribution, topic weaknesses and individual report cards.',
      booksCount: '· {{count}} class(es) in this ledger',

      // ── Tabs ──
      tabGrid: 'Grades',
      tabAnalysis: 'Analysis',
      tabStudents: 'Students',
      tabAssessments: 'Assessments',
      tabScheme: 'Grading scheme',

      // ── Class index ──
      classLabel: 'Class',

      // ── Empty states ──
      emptyNoClassTitle: 'Start with your first class',
      emptyNoClassHint:
        'Set up a class in "Class management" first, then you can record grades, view analysis and print report cards here.',
      emptyGridTitle: 'Ready to enter scores',
      emptyGridHint:
        'Add your roster and assessments in the "Students" and "Assessments" tabs first, and this grade sheet will spring to life.',
      emptyAnalysisTitle: 'Analysis is waiting for you',
      emptyAnalysisHint:
        'Add students and assessments, enter the scores, and distributions, grade shares and topic strengths will be charted here automatically.',
      emptyStudentsTitle: 'Add your first student',
      emptyStudentsHint:
        'Just type a name above, or hit "Bulk" to paste a whole class in from Excel at once.',
      emptyAssessmentsTitle: 'Create an assessment first',
      emptyAssessmentsHint:
        'Add tests, exams or homework above; link a topic too and you can run topic-weakness analysis.',
      emptyTopicsTitle: 'No topics linked yet',
      emptyTopicsHint:
        'Go to the "Assessments" tab and pick the matching BAFS topic for a test / exam to see weaknesses here.',
      emptyRankingTitle: 'The leaderboard hasn’t kicked off',
      emptyRankingHint:
        'Once scores are entered, the class ranking will be sorted out right away.',

      // ── Score summary band ──
      classWeightedAvg: 'Class weighted average',
      classAvg: 'Class average',
      studentsOnRoll: 'Students on roll',
      unitPeople: '',
      gradedAssessments: 'Assessments graded',

      // ── Grid toolbar ──
      sortByNo: 'Student no.',
      sortHighToLow: 'High → low',
      weightedScoring: 'Weighted scoring',
      heatmapOff: 'Turn off grade shading',
      heatmapOn: 'Turn on grade shading',
      toggleHeatmap: 'Toggle grade shading',
      exportCsv: 'Export CSV',

      // ── Score matrix ──
      scoreMatrix: '成績矩陣 · Score Matrix',
      matrixDims: '{{rows}} rows × {{cols}} items',
      colStudent: 'Student',
      colWeightedTotal: 'Weighted total',
      colAverage: 'Average',
      colRank: 'Rank',
      scoreAriaLabel: '{{student}} · {{assessment}} score (out of {{max}})',
      viewReport: 'View report card',
      footerSettle: 'Settlement · Class average',

      // ── Grid footnotes ──
      footBelow50: 'Below 50% is flagged with a red grade.',
      footWeighted: 'Totals use the category weights from "Grading scheme".',
      footUnweighted:
        'Totals are an equal-weight average of all assessments (enable weighting in "Grading scheme").',

      // ── CSV ──
      csvStudentNo: 'Student no.',
      csvStudent: 'Student',
      csvWeightedTotal: 'Weighted total (%)',
      csvGrade: 'Grade',
      csvRank: 'Rank',
      csvFileSuffix: 'grades',
      toastExported: 'Exported {{className}} grades as CSV',

      // ── Analysis views ──
      viewOverview: 'Overview',
      viewAssessments: 'By assessment',
      viewTopics: 'Topic weaknesses',
      viewRanking: 'Leaderboard',
      exportStats: 'Export stats',

      // ── Overview stat cards ──
      statClassAvg: 'Class average',
      statMedian: 'Median {{value}}%',
      statPassRate: 'Pass rate',
      statPassLine: 'Pass mark {{value}}%',
      statDispersion: 'Score spread',
      statDispersionHint: 'Standard deviation (lower = more even)',
      statCompletion: 'Entry completion',
      statCompletionHint: '{{graded}}/{{total}} assessments entered',

      // ── Overview charts ──
      chartDistribution: 'Score distribution (class totals)',
      chartDistributionHint:
        'Each bar is the number of students in that score band; red bands are below pass.',
      chartGradeShare: 'Grade share ({{scale}})',
      chartBoxplot: 'Class score spread (box plot)',
      chartWeakStudents: 'Students to watch (total below {{value}}%)',
      weakNoneTitle: 'No one has slipped below the pass mark for now — the class is holding steady.',
      weakSubmitted: 'Submitted {{submitted}}/{{expected}}',
      chartTrend: 'Assessment trend (class average)',
      chartTrendHint: 'Sorted by assessment date to show how the class is trending.',

      // ── By assessment ──
      assSubmitted: 'Submitted {{n}}/{{total}}',
      assMedian: 'Median {{value}}',
      assStdev: 'σ {{value}}',
      assPass: 'Pass {{value}}',

      // ── Topics ──
      topicsHeading: 'Performance by topic (weakest to strongest)',
      topicsHint:
        'Link assessments to BAFS topics (in the Assessments tab) to see topic-level strengths and weaknesses here.',
      topicUncategorized: 'Uncategorised',

      // ── Ranking ──
      slopePerAssessment: '{{value}} pts/assessment',
      mostImproved: 'Most improved',
      mostImprovedSub: 'Trending up across assessments',
      noClearImproved: 'No clearly rising students for now.',
      needsAttention: 'Needs attention',
      needsAttentionSub: 'Trending down across assessments',
      noClearDeclined: 'No clearly declining students for now — keep it up.',

      // ── Stats CSV ──
      statsCsvAssessment: 'Assessment',
      statsCsvType: 'Type',
      statsCsvSubmitted: 'Submitted',
      statsCsvAvg: 'Average (%)',
      statsCsvMedian: 'Median (%)',
      statsCsvStdev: 'Std. dev.',
      statsCsvPassRate: 'Pass rate (%)',
      statsCsvFileSuffix: 'assessment-stats',

      // ── Students tab ──
      fieldStudentNo: 'Student no.',
      placeholderOptional: 'Optional',
      fieldStudentName: 'Student name',
      placeholderEnterName: 'Enter a name',
      btnAdd: 'Add',
      btnBulk: 'Bulk',
      bulkLabel: 'Bulk add (one per line)',
      bulkHint: 'Format: "no. name" or just "name". You can paste straight from Excel.',
      bulkPlaceholder: '1\tChan Tai Man\n2\tLee Siu Ming\nWong Mei Ling',
      btnCancel: 'Cancel',
      btnAddN: 'Add {{count}}',
      studentsCount: '{{count}} students in total',
      placeholderNo: 'No.',
      btnSave: 'Save',
      editStudent: 'Edit student',
      deleteStudent: 'Delete student',
      toastStudentAdded: 'Added student "{{name}}"',
      toastBulkAdded: 'Bulk-added {{count}} students',
      toastStudentUpdated: 'Student updated',
      toastStudentDeleted: 'Student deleted',
      confirmDeleteStudentTitle: 'Delete student?',
      confirmDeleteStudentMsg:
        'This will remove "{{name}}" and all their grade records. This cannot be undone.',
      confirmDelete: 'Delete',

      // ── Assessments tab ──
      fieldAssessmentName: 'Assessment name',
      placeholderAssessmentEg: 'e.g. First test',
      fieldType: 'Type',
      typeTest: 'Test',
      typeExam: 'Exam',
      typeHomework: 'Homework',
      typeProject: 'Project',
      typeClasswork: 'Class participation',
      fieldMaxScore: 'Max score',
      fieldDateOptional: 'Date (optional)',
      fieldTopicOptional: 'Topic (optional)',
      fieldTopicHint: 'Linking a topic lets you run topic-weakness analysis',
      topicNone: '— No topic —',
      btnCreate: 'Create',
      assessmentList: 'Assessment list',
      assessmentCount: '{{count}} items in total',
      maxBadge: 'Max {{value}}',
      labelTopic: 'Topic',
      topicUnlinked: '— Unlinked —',
      ariaLinkTopic: '{{name}} — link topic',
      ariaAssessmentDate: '{{name}} — assessment date',
      deleteAssessment: 'Delete assessment',
      toastAssessmentAdded: 'Added assessment "{{name}}"',
      toastAssessmentDeleted: 'Assessment deleted',
      confirmDeleteAssessmentTitle: 'Delete assessment?',
      confirmDeleteAssessmentMsg:
        'This will remove "{{name}}" and all its grade records. This cannot be undone.',

      // ── Scheme tab ──
      gradeSystem: 'Grade system',
      gradeSystemHint:
        'Affects the grade labels shown in the grade sheet / analysis (5**–U, distinction–pass, A–F).',
      scaleDse: 'DSE 5**–U',
      scalePercent: 'Distinction / credit / pass',
      scaleSimple: 'A–F',
      enableWeighting: 'Enable category weighting',
      dropLowest: 'Drop the lowest score once per category',
      bandCutsTitle: 'Grade cut-offs (custom)',
      bandCutsHint:
        'Adjust the percentage lower bound for each grade of "{{scale}}" to match your school standard. The lowest grade always starts from 0. Unchanged = default.',
      resetDefault: 'Reset to default',
      bandAbove: '{{value}} pts and above',
      bandRange: '{{from}}–{{to}} pts',
      bandDefault: '(default {{value}})',
      bandCutsInvalid:
        'Cut-offs must strictly decrease from high to low (a higher grade’s lower bound must exceed a lower grade’s), otherwise some grades end up unreachable. Please adjust the values in red.',
      bandCutAria: 'Percentage lower bound for grade "{{label}}"',
      categoryWeights: 'Category weights',
      categoryWeightsHint:
        'Each category’s share of the total grade. Only categories with actual scores are counted (auto-normalised).',
      normalize100: 'Normalise to 100%',
      weightAria: 'Weight (%) for category "{{type}}"',
      weightPctAria: 'Weight percentage for category "{{type}}"',
      totalWeight: 'Total weight',
      notEqual100: '(values that don’t sum to 100% are still scaled automatically)',
      toastNormalized: 'Weights normalised to total 100%',
      toastBandReset: 'Reset to default cut-offs',
      scoringPrinciple: 'How scoring works',
      scoringPrincipleBody:
        'Assessments of the same type (e.g. all "tests") are averaged first, then weighted into a total using the weights above. If a category has no scores at all, its weight is dropped and the remaining categories scale up proportionally, so early in the term an incomplete set still yields a sensible total. Turn off weighting and all assessments are averaged with equal weight.',

      // ── Student report card ──
      reportStampLedger: '成績冊 · Ledger',
      reportKicker: '成績單 · Report Card',
      reportStudentNo: 'Student no. {{no}}',
      reportWeighted: 'Weighted scoring',
      reportUnweighted: 'Equal-weight average',
      reportWeightedTotalGrade: 'Weighted total grade',
      reportTotalGrade: 'Total grade',
      reportTrendTitle: 'Trend across assessments',
      reportRankInClass: 'Rank in class',
      reportPercentile: 'Percentile',
      reportSubmitted: 'Submitted',
      reportScoreSheet: '成績明細 · Score Sheet',
      reportItemsCount: '{{count}} items',
      reportColAssessment: 'Assessment',
      reportColType: 'Type',
      reportColScore: 'Score',
      reportColVsAvg: 'vs class avg',
      reportNotSubmitted: 'Not submitted',
      reportWeightedTotal: 'Weighted total',
      reportTotal: 'Total',
      reportClassShort: 'Class {{value}}%',
      reportFootVsAvg:
        '"vs class avg" is each student’s gap (in percentage points) from the class average on each assessment.',
      reportFootBy: 'Auto-settled by EziTeach.',
      reportClose: 'Close',
      reportPrint: 'Print / Save PDF',
      reportTitle: '{{className}} Report Card',
      reportPrintStudent: 'Student: {{name}}',
      reportPrintDate: 'Print date: {{date}}',
      reportPrintRank: 'Rank in class',
      reportPrintPercentile: 'Percentile in class',
      reportPrintSubmitted: 'Submitted',
      reportPrintClassAvg: 'Class average',
      reportPrintColAssessment: 'Assessment',
      reportPrintColType: 'Type',
      reportPrintColScore: 'Score',
      reportPrintColClassAvg: 'Class avg',
      reportPrintFoot: 'Auto-generated by EziTeach · Weighting scheme: {{scheme}}',
      reportSchemeEnabled: 'enabled',
      reportSchemeEqual: 'equal-weight average',
      reportPrintTitle: 'Report Card — {{name}}',
      reportWindowFor: 'For',

      // ── Charts ──
      chartNoGrade: 'No grades yet',
      chartTrendEmpty: 'Trend appears once scores are entered',
      chartBoxEmpty: 'Not enough data for a box plot',
      chartCountPeople: '{{label}}: {{count}} people',
      chartGradeCount: '{{label}}: {{count}} people ({{pct}}%)',
      chartTrendPoint: '{{label}}: {{value}}%',
      chartTrendPointSub: '{{label}} · {{sub}}: {{value}}%',
      chartMean: 'Mean {{value}}%',
      chartMin: 'Min {{value}}',
      chartMedian: 'Median {{value}}',
      chartMax: 'Max {{value}}',
    },
  },
  true,
  true,
)
