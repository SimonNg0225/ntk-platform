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
    'work-slides': { name: 'Teaching slides', desc: 'AI-generate teaching slide decks from a topic, with distinctive templates; present and export.' },
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
}
