import type { SubjectKnowledge } from './types'

// ============================================================
//  英國語文（English Language）科目知識檔案 — 四卷齊全
//  ------------------------------------------------------------
//  公開試結構（2024/2025/2026 不變，未削卷）：
//    卷一 閱讀 Reading 20% · 卷二 寫作 Writing 25% ·
//    卷三 聆聽及綜合 Listening & Integrated Skills 30% ·
//    卷四 說話 Speaking 10% · 校本評核 SBA 15%
//  · 卷一 Part A（必答）+ Part B1（易，上限 L4）/ B2（難，全等級）。
//  · 卷三 Section 1（必答）+ Section 2（易，上限 L4）/ Section 3（難，至 L5**）。
//  · 卷二 Part A（短文）+ Part B（約 400 字，八個選修單元任揀一題）。
//  評分大域：寫作 / 綜合 = Content（內容）/ Language（語文）/ Organisation（組織）；
//           說話 = Pronunciation & Delivery / Communication Strategies /
//                  Vocabulary & Language Patterns / Ideas & Organisation。
//  提煉來源：HKEAA English Language 課程及評估指引 / 評核大綱 + 官方 Level
//  Descriptors（Writing）+ Paper 4 Speaking guidelines + 公開網上資源
//  （GETUTOR / Spencer Lam / AfterSchool 對 text-type 格式、常見錯誤嘅整理）
//  + DSE English 批改知識。批改慣例可再以官方 Sample Performance 校準。
// ============================================================

export const ENG: SubjectKnowledge = {
  subject: 'eng',
  label: '英國語文',
  lang: 'en',
  assessment: {
    papers: [
      'Paper 1 Reading 閱讀（20%，約 1.5 小時）：Part A 必答 + Part B1（較易，最高 L4）/ B2（較難，全等級）。考 gist / detail / inference / vocabulary in context / reference / 作者語氣與目的。',
      'Paper 2 Writing 寫作（25%，2 小時）：Part A 短文（約 200 字）+ Part B 延伸寫作（約 400 字，八個選修單元任揀一題）。按 Content / Language / Organisation 評分。',
      'Paper 3 Listening & Integrated Skills 聆聽及綜合（30%，約 2 小時）：Section 1 必答 + Section 2（易，最高 L4）/ Section 3（難，至 L5**）。Data File 選材整合，產出實用文本。',
      'Paper 4 Speaking 說話（10%，約 20 分鐘）：Part A 小組討論（Group Interaction）+ Part B 個人回應（Individual Response）。',
      '校本評核 SBA（15%）：讀 / 觀 後口頭匯報（校內評，唔喺此 AI 批改範圍）。',
    ],
    weightings: 'Reading 20% · Writing 25% · Listening & Integrated 30% · Speaking 10% · SBA 15%。（四卷齊全，未似中文科削卷。）',
    questionTypes: [
      'Reading comprehension（MC / 短答 / matching / true-false-not given / 填表）',
      'Functional writing（letter / email / report / proposal / blog / review / leaflet…）',
      'Argumentative & narrative / descriptive writing',
      'Part B 選修延伸寫作（約 400 字）',
      'Listening note-taking / gap-fill / 句子完成',
      'Integrated task（綜合 Data File → 產出指定文本）',
      'Speaking：group discussion + individual response',
    ],
    sba: 'School-based Assessment 佔 15%（讀 / 觀後口語匯報，校內評）。',
  },
  commandWords: [
    { word: 'Persuade / Convince', meaning: 'Argue a position and move the reader/listener to your view, using reasons and appeals.' },
    { word: 'Argue / Give your views', meaning: 'Take a clear stance and support it with reasons and evidence; weigh counter-views.' },
    { word: 'Compare and contrast', meaning: 'Point out both similarities and differences, point by point.' },
    { word: 'Describe', meaning: 'Give a vivid, detailed picture (use sensory / concrete detail), not just narrate events.' },
    { word: 'Explain / Account for', meaning: 'Make clear how / why; give causes and reasons, not just statements.' },
    { word: 'Suggest / Recommend', meaning: 'Propose workable ideas / solutions and justify them.' },
    { word: 'Summarise', meaning: 'Restate key points concisely in your own words; no new ideas, no copying whole sentences.' },
    { word: 'Evaluate / To what extent', meaning: 'Make a judgement with criteria and evidence; show degree of agreement.' },
    { word: 'With reference to / In your own words', meaning: 'Base the answer on the text but reword it; lifting verbatim may score nothing.' },
  ],
  levelDescriptors: [
    { level: 'L5–5** (high)', descriptor: 'Highly relevant, fully developed ideas; wide range of accurate vocabulary & sentence patterns; coherent, well-organised with varied cohesive devices; register fully appropriate; very few errors, none impeding communication.' },
    { level: 'L4', descriptor: 'Relevant and adequately developed; generally accurate language with some range; clearly organised with some cohesive devices; mostly appropriate register; errors mostly minor.' },
    { level: 'L2–3', descriptor: 'Some relevant ideas but limited / uneven development; simple, sometimes repetitive language with errors that occasionally impede meaning; basic organisation; register not always suitable.' },
    { level: 'L1', descriptor: 'Largely irrelevant or very limited ideas; frequent errors that impede communication; little organisation; inappropriate register.' },
  ],
  strands: [
    // ───────────────────── Reading（Paper 1）─────────────────────
    {
      key: 'reading',
      label: 'Reading 閱讀（卷一）',
      persona:
        'You are an experienced Hong Kong secondary English Language teacher marking Paper 1 (Reading) to HKDSE standards. Answers must be grounded in the passage; where "in your own words" is required, lifted text may score nothing; respect word limits and exact forms.',
      areas: [
        {
          key: 'literal-comprehension',
          label: 'Literal comprehension（gist & detail）',
          keyConcepts: ['Skimming for gist / main idea', 'Scanning for specific detail', 'Reference words (it / this / they / such)', 'Text features & structure (headings, sequence, paragraphing)', 'Cohesion & discourse markers', 'Distinguishing fact from opinion'],
          markingConventions: ['Answer must match what the text actually says', 'Reference questions must quote the exact item referred to', 'MC / matching / true-false-not-given must be precise — no half marks for partial', 'Respect word limits and required form (one word / a phrase / a number)'],
          commonErrors: ['Lifting whole sentences instead of answering the question', 'Misreading reference words (wrong antecedent)', 'Ignoring word limits / wrong form', 'Choosing "not given" vs "false" wrongly', 'Confusing fact with opinion'],
          rubric: [
            { criterion: 'Comprehension (gist & detail)', max: 6, focus: 'Accurate, text-based answers' },
            { criterion: 'Reference & text features', max: 3, focus: 'Correct antecedents, structure cues' },
            { criterion: 'Accuracy of response (form / word limit)', max: 3, focus: 'Right form, within limit, own words where required' },
          ],
          issueTypes: ['content', 'analysis', 'vocabulary', 'grammar'],
        },
        {
          key: 'inference-interpretation',
          label: 'Inference & interpretation',
          keyConcepts: ['Implied meaning / reading between the lines', "Author's purpose, tone & attitude", 'Vocabulary in context (guessing from clues)', 'Figurative language & connotation', 'Drawing conclusions across paragraphs'],
          markingConventions: ['Inference must be supported by textual evidence', 'Vocabulary-in-context answers judged on contextual fit, not dictionary default', 'Tone / attitude answers should name the feeling and cite the cue', 'Explain "why" the writer does something, not just "what"'],
          commonErrors: ['Unsupported inference / personal opinion', 'Guessing vocabulary without using context', 'Naming tone with no textual cue', 'Over-literal reading of figurative language', 'Answer too vague to show understanding'],
          rubric: [
            { criterion: 'Inference & interpretation', max: 6, focus: 'Implied meaning, evidence-based' },
            { criterion: "Tone / purpose / attitude", max: 4, focus: 'Named + cued from text' },
            { criterion: 'Vocabulary in context', max: 2, focus: 'Contextual meaning' },
          ],
          issueTypes: ['analysis', 'content', 'vocabulary', 'argument'],
        },
      ],
    },

    // ───────────────────── Writing（Paper 2）─────────────────────
    {
      key: 'writing',
      label: 'Writing 寫作（卷二）',
      persona:
        'You are an experienced Hong Kong secondary English Language teacher marking Paper 2 (Writing) to HKDSE standards using the three domains Content, Language and Organisation. Judge relevance to the task first (off-task work caps Content); reward range and accuracy of language; check register suits the text type and audience.',
      areas: [
        {
          key: 'argumentative-persuasive',
          label: 'Argumentative / persuasive（essay, letter to editor, speech, proposal）',
          keyConcepts: ['Clear thesis / stance', 'Topic sentences + developed supporting points', 'Reasons, examples, evidence', 'Counter-argument & rebuttal', 'Persuasive devices (rhetorical questions, appeals)', 'Cohesion across paragraphs'],
          markingConventions: ['Content: relevant, well-developed arguments addressing the task', 'Language: range + accuracy of grammar & vocabulary, suitable register', 'Organisation: logical paragraphing, cohesive devices, intro / conclusion', 'Stay on the set question and audience'],
          commonErrors: ['Vague thesis / position shifts mid-essay', 'Assertions without development or evidence', 'No counter-argument', 'Repetitive / informal language in a formal task', 'Weak paragraphing, missing topic sentences', 'Off-task or partly off-task'],
          rubric: [
            { criterion: 'Content', max: 7, focus: 'Relevant, developed arguments on task' },
            { criterion: 'Language', max: 7, focus: 'Range + accuracy + register' },
            { criterion: 'Organisation', max: 7, focus: 'Paragraphing, cohesion, structure' },
          ],
          issueTypes: ['content', 'argument', 'grammar', 'vocabulary', 'organization'],
        },
        {
          key: 'narrative-descriptive',
          label: 'Narrative / descriptive',
          keyConcepts: ['Engaging plot / situation, clear focus', 'Show-not-tell, sensory & concrete detail', 'Characterisation & setting', 'Narrative tenses & sequencing', 'Mood / atmosphere', 'Varied sentence openings'],
          markingConventions: ['Content: imaginative, relevant, well-developed', 'Language: vivid word choice, controlled tenses, varied structures', 'Organisation: coherent sequence, effective opening / ending', 'Reward voice and detail; penalise flat retelling'],
          commonErrors: ['Telling not showing / flat narration', 'Tense inconsistency in narration', 'Thin description, generic adjectives', 'Rushed or missing ending', 'Plot too ambitious to develop in the word count'],
          rubric: [
            { criterion: 'Content', max: 7, focus: 'Engaging, developed, on task' },
            { criterion: 'Language', max: 7, focus: 'Vivid, accurate, varied' },
            { criterion: 'Organisation', max: 7, focus: 'Coherent sequence, opening / ending' },
          ],
          issueTypes: ['content', 'vocabulary', 'grammar', 'organization', 'spelling'],
        },
        {
          key: 'functional-texts',
          label: 'Functional texts（letter / email / report / proposal / blog / review）',
          keyConcepts: ['Text-type conventions & layout', 'Register & tone matched to audience / purpose', 'Completing all task requirements / bullet points', 'Salutation, sign-off, headings where needed', 'Clear, purposeful paragraphing'],
          markingConventions: ['Content: all required points covered for the given purpose / reader', 'Language: register appropriate (formal / semi-formal / informal)', 'Organisation: correct format & layout for the text type', 'Missing or wrong format / register is penalised'],
          commonErrors: ['Wrong / mixed register for the audience', 'Missing required content points', 'Format errors (no greeting / sign-off / headings)', 'Tone too casual for a formal task', 'Padding instead of completing the task'],
          rubric: [
            { criterion: 'Content', max: 7, focus: 'All task points, fit for purpose' },
            { criterion: 'Language', max: 7, focus: 'Accuracy + appropriate register' },
            { criterion: 'Organisation', max: 7, focus: 'Text-type format & layout' },
          ],
          issueTypes: ['content', 'organization', 'grammar', 'vocabulary'],
        },
        {
          key: 'elective-extended',
          label: 'Part B 選修延伸寫作（約 400 字）',
          keyConcepts: ['Eight electives: Short Stories · Poems & Songs · Drama · Sports Communication · Debating · Social Issues · Workplace Communication · Popular Culture', 'Deeper development at ~400 words', 'Module-specific conventions (e.g. debate speech, workplace memo, film review)', 'Sustained argument / narrative', 'Wider lexical range'],
          markingConventions: ['Content: relevant and substantially developed for the chosen module', 'Language: wider range expected at this level; accuracy under length', 'Organisation: sustained structure over a longer piece', 'Apply the conventions of the chosen elective module'],
          commonErrors: ['Under-developed for the word count', 'Ignoring the conventions of the chosen module', 'Drifting off the question', 'Range not stretched (same simple patterns)', 'Weak overall structure over a longer text'],
          rubric: [
            { criterion: 'Content', max: 7, focus: 'Relevant, substantially developed' },
            { criterion: 'Language', max: 7, focus: 'Range + accuracy at length' },
            { criterion: 'Organisation', max: 7, focus: 'Sustained, module-appropriate structure' },
          ],
          issueTypes: ['content', 'argument', 'vocabulary', 'grammar', 'organization'],
        },
      ],
    },

    // ───────────── Listening & Integrated Skills（Paper 3）─────────────
    {
      key: 'listening-integrated',
      label: 'Listening & Integrated Skills 聆聽及綜合（卷三）',
      persona:
        'You are an experienced Hong Kong secondary English Language teacher marking Paper 3 (Listening & Integrated Skills) to HKDSE standards. Listening answers are judged on accuracy of information heard (spelling of key words matters); integrated tasks are judged on Content (selecting & integrating from the Data File), Language and Organisation / appropriacy.',
      areas: [
        {
          key: 'listening-notetaking',
          label: 'Listening & note-taking（Section 1 / Part A）',
          keyConcepts: ['Listening for gist & specific detail', 'Note-taking: keywords, abbreviations, symbols', 'Gap-fill / sentence & table completion', 'Spelling & word form of heard items', 'Following speaker signposting & sequence'],
          markingConventions: ['Answer must match the information in the recording', 'Key content words must be spelled correctly to score', 'Right form / number / name required', 'No marks for plausible guesses not in the audio'],
          commonErrors: ['Mishearing similar sounds / numbers / names', 'Misspelling key words (loses the mark)', 'Wrong word form (noun vs verb)', 'Writing too much / copying the question stem', 'Missing answers due to poor note-taking pace'],
          rubric: [
            { criterion: 'Listening accuracy (gist & detail)', max: 6, focus: 'Correct information from audio' },
            { criterion: 'Note-taking / completion', max: 4, focus: 'Right item, right place' },
            { criterion: 'Spelling & word form', max: 3, focus: 'Accurate key words' },
          ],
          issueTypes: ['content', 'spelling', 'grammar', 'vocabulary'],
        },
        {
          key: 'integrated-skills',
          label: 'Integrated task（Section 2 / 3, Part B — Data File）',
          keyConcepts: ['Selecting relevant info from the Data File + audio', 'Integrating & reorganising sources (not copying)', 'Producing the required text type (letter / report / article / proposal…)', 'Register & tone for purpose / audience', 'Inferring & connecting information across sources'],
          markingConventions: ['Content: relevant points correctly selected & integrated from sources', 'Language: accuracy + register appropriate to the task', 'Organisation / appropriacy: correct text-type format, logical flow', 'Reward synthesis & own wording; penalise wholesale copying'],
          commonErrors: ['Copying chunks of the Data File verbatim', 'Missing or irrelevant information selected', 'Wrong text type / register for the task', 'Poor integration (list of facts, no flow)', 'Misreading the role / purpose set in the task'],
          rubric: [
            { criterion: 'Content & integration', max: 7, focus: 'Relevant, well-selected, synthesised' },
            { criterion: 'Language', max: 7, focus: 'Accuracy + appropriate register' },
            { criterion: 'Organisation & appropriacy', max: 7, focus: 'Text-type format, logical flow' },
          ],
          issueTypes: ['content', 'organization', 'grammar', 'vocabulary'],
        },
      ],
    },

    // ───────────────────── Speaking（Paper 4）─────────────────────
    {
      key: 'speaking',
      label: 'Speaking 說話（卷四）',
      persona:
        'You are an experienced Hong Kong secondary English Language teacher assessing Paper 4 (Speaking) to HKDSE standards using four domains: Pronunciation & Delivery, Communication Strategies, Vocabulary & Language Patterns, and Ideas & Organisation. (Assess from a transcript / notes of what the candidate said.)',
      areas: [
        {
          key: 'group-interaction',
          label: 'Group Interaction（Part A — discussion）',
          keyConcepts: ['Initiating, turn-taking & inviting others', 'Building on / responding to others’ ideas', 'Agreeing / disagreeing politely', 'Sustaining & moving the discussion towards a decision', 'Fluency, pronunciation & natural delivery', 'Range of vocabulary & sentence patterns'],
          markingConventions: ['Communication Strategies: interaction quality — initiate, respond, develop others’ points', 'Ideas & Organisation: relevant, developed ideas, logically connected', 'Vocabulary & Language Patterns: range + accuracy', 'Pronunciation & Delivery: clarity, fluency, stress & intonation'],
          commonErrors: ['Monologuing / not engaging others', 'Dominating or staying silent', 'Just agreeing with no development', 'Off-topic or thin ideas', 'Memorised, unnatural delivery', 'Limited / repetitive language'],
          rubric: [
            { criterion: 'Pronunciation & Delivery', max: 7, focus: 'Clarity, fluency, stress / intonation' },
            { criterion: 'Communication Strategies', max: 7, focus: 'Initiate, respond, develop, turn-take' },
            { criterion: 'Vocabulary & Language Patterns', max: 7, focus: 'Range + accuracy' },
            { criterion: 'Ideas & Organisation', max: 7, focus: 'Relevant, developed, connected' },
          ],
          issueTypes: ['content', 'vocabulary', 'grammar', 'organization'],
        },
        {
          key: 'individual-response',
          label: 'Individual Response（Part B — Q&A）',
          keyConcepts: ['Answering the examiner’s question directly & on topic', 'Giving reasons / examples to extend the answer', 'Coping / paraphrasing when unsure', 'Coherent, organised short response', 'Fluency & pronunciation under pressure'],
          markingConventions: ['Ideas & Organisation: address the question, develop with reasons / examples', 'Communication Strategies: coping strategies, natural responses', 'Vocabulary & Language Patterns + Pronunciation & Delivery as above', 'Reward relevance & extension over rote answers'],
          commonErrors: ['One-line answers with no development', 'Drifting off the question', 'Long silences / breakdown under pressure', 'Pre-memorised answer not fitting the question', 'Limited range, frequent slips'],
          rubric: [
            { criterion: 'Pronunciation & Delivery', max: 7, focus: 'Clarity, fluency' },
            { criterion: 'Communication Strategies', max: 7, focus: 'Coping, natural response' },
            { criterion: 'Vocabulary & Language Patterns', max: 7, focus: 'Range + accuracy' },
            { criterion: 'Ideas & Organisation', max: 7, focus: 'On-topic, extended, organised' },
          ],
          issueTypes: ['content', 'vocabulary', 'grammar', 'organization'],
        },
      ],
    },
  ],
  publicResources: [
    { label: 'HKEAA English Language 科目資訊（官方：課程評估 / 樣本試題 / 表現示例）', url: 'https://www.hkeaa.edu.hk/en/HKDSE/assessment/subject_information/category_a_subjects/eng_lang/' },
    { label: 'HKEAA English Language — Sample Performance 2024（官方考生示例）', url: 'https://www.hkeaa.edu.hk/en/HKDSE/assessment/subject_information/category_a_subjects/eng_lang/sp/2024.html' },
    { label: 'HKEAA — Level Descriptors (Writing)（官方寫作等級描述）', url: 'https://www.hkeaa.edu.hk/DocLibrary/HKDSE/Subject_Information/eng_lang/LevelDescriptors-ENG-Writing.pdf' },
    { label: 'HKEAA — Paper 4 Speaking Guidelines（官方說話卷評分準則）', url: 'https://www.hkeaa.edu.hk/DocLibrary/HKDSE/Subject_Information/eng_lang/EngPaper4-Guidelines.pdf' },
    { label: 'GETUTOR — DSE English Paper 2 text-type / format 指南（書信 / 報告 / 演講辭…）', url: 'https://www.getutor.com.hk/en/dse-english-paper-2-writing/' },
  ],
  source:
    '提煉自 HKEAA English Language 課程及評估指引 / 評核大綱（四卷：Reading 20% / Writing 25% / Listening & Integrated 30% / Speaking 10% + SBA 15%）+ 官方 Level Descriptors（Writing）+ Paper 4 Speaking guidelines + 公開網上資源（GETUTOR / Spencer Lam / AfterSchool 對 text-type 格式、常見錯誤嘅整理）+ DSE English 批改知識。官方 Sample Performance 可再用嚟逐題校準。',
}
