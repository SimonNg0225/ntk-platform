import type { Feature } from '../features/types'

// ============================================================
//  i18n · app 導航 / 外殼 英文資源（en）
//  ------------------------------------------------------------
//  zh-HK 一律靠 t(key, { defaultValue: 原廣東話 }) 回退，故唔喺度重覆
//  中文；呢度淨係補 en。功能名 / 描述用 feature id 做 key。
// ============================================================

// 輕量 t 型別（同 react-i18next 嘅 t 結構相容）
type TFn = (key: string, opts?: { defaultValue?: string }) => string

/** 功能名稱（en 由 feat.<id>.name；其餘語言回退原 registry 名）。 */
export const featName = (t: TFn, f: Feature): string =>
  t(`feat.${f.id}.name`, { defaultValue: f.name })

/** 功能描述。 */
export const featDesc = (t: TFn, f: Feature): string =>
  t(`feat.${f.id}.desc`, { defaultValue: f.description })

/** 功能分組標籤。 */
export const groupLabel = (t: TFn, g: string): string =>
  t(`group.${g}`, { defaultValue: g })

export const appEn = {
  shell: {
    brandName: 'EziTeach',
    home: 'Overview',
    settings: 'Settings',
    backOverview: 'Back to overview',
    backToMode: 'Back to {{mode}} overview',
    loading: 'Loading…',
    collapseSidebar: 'Collapse sidebar (⌘B)',
    hideSidebar: 'Hide sidebar (⌘B)',
    expandSidebar: 'Expand sidebar (⌘B)',
    soon: 'Soon',
    comingSoon: 'Coming soon',
    brandSub: 'Teacher workspace · growth',
    guestMode: '👤 Guest mode · local',
    signOut: 'Sign out',
    loginGoogle: 'Sign in with Google',
    seePro: 'See Pro',
    upgradePro: 'Upgrade Pro',
    manage: 'Manage',
    renews: 'Renews {{date}}',
    featuresCount: 'features',
    planFree: 'Free',
    planPro: 'Pro',
    planProTrial: 'Pro · Trial',
    planProTest: 'Pro · Test',
    quickAdd: 'Quick add',
    navHint: 'Navigate',
    actionHint: 'Action',
    modeHint: 'Mode',
    switchTo: 'Switch to {{mode}}',
    bnHome: 'Home',
    bnMore: 'Menu',
    bnMark: 'Mark',
    bnGrades: 'Grades',
    bnCal: 'Calendar',
    bnAI: 'AI',
    bnCards: 'Cards',
    recent: 'Recent',
    allFeatures: 'All features',
  },

  mode: {
    learning: { name: 'Personal', short: 'Personal', tagline: 'Record life, keep growing' },
    work: { name: 'Work', short: 'Work', tagline: 'Prep · marking · grades · parent comms — all in one' },
  },

  group: {
    概覽: 'Overview',
    AI: 'AI',
    知識管理: 'Knowledge',
    目標與習慣: 'Goals & Habits',
    健康: 'Health',
    教學: 'Teaching',
    學生: 'Students',
    行政: 'Admin',
    理財: 'Finance',
    工具: 'Tools',
  },

  feat: {
    'learning-dashboard': { name: 'Personal dashboard', desc: "Today's reviews, streak, goals and recent notes at a glance." },
    'learning-ai': { name: 'Personal AI assistant', desc: 'Q&A, explain concepts, summarise notes, make exercises.' },
    'learning-card-generator': { name: 'AI flashcard generator', desc: 'Paste a topic or notes; AI builds flashcards straight into your deck.' },
    'learning-notes': { name: 'Personal notes', desc: 'Jot down what you learn; auto-saved.' },
    'learning-flashcards': { name: 'Flashcards + review', desc: 'Spaced repetition (SRS); cards surface when due.' },
    'learning-reading': { name: 'Reading list', desc: 'Save books and articles; track by status.' },
    'learning-goals': { name: 'Personal goals', desc: 'Set goals and track progress.' },
    'learning-habits': { name: 'Habit tracker', desc: 'Daily check-ins to build good habits.' },
    'learning-focus': { name: 'Focus timer', desc: 'Pomodoro focus / break cycles + stats.' },
    'learning-journal': { name: 'Journal', desc: 'Daily reflection; track your growth over time.' },
    'learning-health': { name: 'Health tracker', desc: 'Log weight, sleep, exercise, water and mood; see trends and goals.' },
    'learning-fitness': { name: 'Fitness centre', desc: 'Body metrics, training log, AI nutrition, AI coach, exercise library.' },
    'work-dashboard': { name: 'Work dashboard', desc: "Today's lessons, tasks, follow-ups and class progress at a glance." },
    'work-ai': { name: 'Teaching AI', desc: 'Questions, lesson outlines, marking comments, class activities.' },
    'work-grading': { name: 'AI marking', desc: 'Mark student answers (text / photo) + generate report-card comments.' },
    'work-curriculum': { name: 'Curriculum progress', desc: 'Track each class against the syllabus.' },
    'work-lesson-plan': { name: 'Lesson planning', desc: 'Write and organise teaching plans.' },
    'work-timetable': { name: 'Timetable', desc: 'Your weekly teaching timetable.' },
    'work-questions': { name: 'Question bank', desc: 'Store questions by topic / type / difficulty.' },
    'work-generate': { name: 'Material generator', desc: 'AI-generate MC / short / case / long questions, exercises and papers straight into the bank.' },
    'work-resources': { name: 'Resource library', desc: 'Save handouts, past papers and material links.' },
    'work-classes': { name: 'Class management', desc: 'Record the classes and students you teach.' },
    'work-gradebook': { name: 'Gradebook', desc: 'Record assessment scores, averages and weaknesses.' },
    'work-attendance': { name: 'Attendance', desc: 'Record student attendance each lesson.' },
    'work-parent-comms': { name: 'Parent communication', desc: 'Log contact and follow-ups with parents / students.' },
    'work-tasks': { name: 'To-do / marking', desc: 'Prep, marking and admin tasks at a glance.' },
    'work-meeting-notes': { name: 'Meeting notes', desc: 'Notes for meetings and admin matters.' },
    'work-team': { name: 'Team / seats', desc: 'Create a school / panel team, invite colleagues and manage seats.' },
    'work-admin-docs': { name: 'Admin documents', desc: 'Upload Word templates, fill {tags} field by field, generate .docx to print.' },
    'work-budget': { name: 'Budget', desc: 'Log daily income and expenses; see monthly balance and category split.' },
    'ask-data': { name: 'Ask-my-data AI', desc: 'AI answers from your notes / tasks / goals / schedule.' },
    calendar: { name: 'Calendar', desc: 'One place for personal and work schedules.' },
    search: { name: 'Global search', desc: 'Search notes, questions, resources and lesson plans at once.' },
    inbox: { name: 'Quick capture', desc: 'Drop a thought in a second; turn it into a task or note later.' },
    countdown: { name: 'Countdowns', desc: 'Big-number countdowns to exams, deadlines and assessments.' },
    quiz: { name: 'Self-quiz', desc: 'Pull MC from the bank, auto-mark, score and weakness analysis.' },
  },

  // ── 訂閱到手機日曆（CalendarSubscribe）──
  calSub: {
    kicker: 'On the go · Subscribe',
    title: 'Subscribe on your phone',
    close: 'Close',
    needCloudTitle: 'Connect the cloud to subscribe',
    needCloudBody:
      'A subscribed calendar needs a cloud feed so your phone / iPad can sync on a schedule and fire native reminders. This device isn’t connected to the cloud yet — for now, use “Export .ics” on the calendar page to import once.',
    signInTitle: 'Sign in to subscribe',
    signInBody:
      'Once you sign in you get a personal link. Subscribe once on your phone / iPad and your calendar and countdowns sync automatically and remind you natively, right on time.',
    signInGoogle: 'Sign in with Google',
    noUrlTitle: 'Can’t build the link right now',
    noUrlBody:
      'Couldn’t read the cloud URL setting (VITE_SUPABASE_URL). Please check the deployment settings and try again.',
    intro:
      'On iPhone / iPad, tap the link below to subscribe. Your calendar events and countdowns then sync into Apple Calendar and notify you with native reminders on time.',
    yourLink: 'Your subscription link',
    copy: 'Copy link',
    openApple: 'Open on Apple device',
    stepsHeader: 'Subscribe on iPhone / iPad',
    step1:
      'On your iPhone / iPad, tap the link above → a “Subscribe to Calendar” prompt appears → tap “Subscribe”.',
    step2:
      'Or manually: open Settings → Calendar → Accounts → Add Account → Add Subscribed Calendar, then paste the link.',
    step3:
      'Once subscribed, Apple Calendar fires native reminders on time (how early follows the alert you set on each event).',
    securityNote:
      'The link is read-only and only exposes your own event titles and times. If you think it has leaked, regenerate it any time — the old link stops working immediately.',
    regenerate: 'Regenerate link',
    copied: 'Link copied',
    copyFailed: 'Copy failed — long-press the link to copy manually',
    regenTitle: 'Regenerate the link?',
    regenMsg:
      'The old link stops working immediately. If you already subscribed on your phone / iPad, remove the old subscription and re-subscribe with the new link.',
    regenConfirm: 'Regenerate',
    regenDone: 'New link created; the old link no longer works',
  },

  // ── 行事曆 / 倒數頁入口掣 ──
  cal: {
    subscribeMobile: 'Subscribe on phone',
  },

  // ── 快速加入：重複偵測（QuickAddModal）──
  qadd: {
    repeat: 'Repeat',
    recurNone: 'No repeat',
    recurDaily: 'Daily',
    recurWeekly: 'Weekly',
    daily: 'Daily',
    everyNDays: 'Every {{n}} days',
    weekly: 'Weekly',
    everyNWeeks: 'Every {{n}} weeks',
    wdSep: ', ',
    wd0: 'Sun',
    wd1: 'Mon',
    wd2: 'Tue',
    wd3: 'Wed',
    wd4: 'Thu',
    wd5: 'Fri',
    wd6: 'Sat',
  },

  // ── 掃描 PDF（work-scan）──
  scan: {
    kicker: 'Document Scan',
    title: 'Scan to PDF',
    subtitle: 'Snap a document, auto-straighten it, make it searchable, export a PDF.',
    captureTitle: 'Snap document',
    close: 'Close',
    noCamera: 'Camera unavailable — you can upload a photo instead.',
    upload: 'Upload photo',
    shoot: 'Capture',
    emptyTitle: 'No scans yet',
    emptyDesc: 'Snap or upload a document photo to turn it into a scanned PDF.',
    start: 'Start scanning',
    filterColor: 'Colour',
    filterGray: 'Grayscale',
    filterBw: 'B&W',
    reshoot: 'Reshoot',
    apply: 'Apply',
    applying: 'Processing…',
    addPage: 'Add page',
    edit: 'Edit',
    delete: 'Delete',
    moveLeft: 'Move left',
    moveRight: 'Move right',
    merged: 'One file',
    perPage: 'One per page',
    ocrOn: 'OCR: On',
    ocrOff: 'OCR: Off',
    download: 'Download PDF',
    generating: 'Generating…',
    done: 'PDF ready',
    failed: 'Failed, please retry',
    defaultName: 'Scan',
    saveToLib: 'Save to library',
    savedToLib: 'Registered in library; PDF downloaded as a copy',
    bind: 'Bind class / student',
    class: 'Class',
    classNone: '— No class —',
    student: 'Student (optional)',
    studentNone: '— Whole class (unspecified) —',
    saveBound: 'Save & bind',
    savedToCloud: 'Saved to cloud library — open it straight from the library',
    cloudFailed: 'Cloud upload failed — registered locally + downloaded a copy',
  },
}
