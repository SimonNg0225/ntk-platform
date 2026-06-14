import type { SubjectKnowledge } from './types'

// ============================================================
//  英語文學 Literature in English 科目知識檔案
//  ------------------------------------------------------------
//  公開試結構（現行 / 2026，Category A 選修科）：
//    卷一 Paper 1 Essay Writing 論文寫作（50%，3 小時）：
//      Section A 必答一條（兩本指定小說擇一）+ Section B 必答一條
//      （兩齣指定戲劇擇一）+ Section C 必答一條（比較兩篇或以上短篇小說）。
//      每節每個文本各設兩條題目選一；全卷論文式作答，部分題目容許
//      想像式延伸（imaginative expansion）。
//    卷二 Paper 2 Appreciation 評賞（30%，2 小時）：三節各答一條，
//      多為多分部（multi-part）題。Section A 賞析指定小說或戲劇選段
//      （四選一，佔全科 10%）；Section B 指定詩作賞析（兩條選一，所評
//      為兩至三首、同一或不同詩人之 set poems，佔 12%）；Section C
//      未見詩 unseen poem（必答一條，佔 8%）。
//    校本評核 SBA（20%）：校內進行，含創作 / 評論回應任務，連繫文學
//      與當代文化議題（校內評，唔喺此 AI 批改範圍，僅 assessment 註明）。
//  評核目標（提煉自官方）：(a) 熟悉文本背景 / 內容與作者手法；
//    (b) 有理據嘅個人回應；(c) 清晰精煉、具批判與分析；(d) SBA 自由想像表達。
//  批改大域對齊：Understanding（理解）/ Textual evidence（文本佐證）/
//    Analysis & interpretation（分析與詮釋）/ Expression（表達）。
//  提煉來源：HKEAA Literature in English 課程及評估指引 / 評核大綱
//    （Paper 1 50% / Paper 2 30%，內含 Section A 10% / B 12% / C 8% / SBA 20%）
//    + 官方評核目標 + Sample Paper / Sample Performance + 公開文學評賞批改
//    知識。批改慣例可再以官方 Sample Performance / 考評報告逐題校準。
//  版權聲明：本檔只係官方課程 / 評估指引嘅衍生指引（準則 / 慣例 / 常見
//    錯誤 / 命令詞 / 等級描述），並無照搬 HKEAA 試題原文或 marking scheme
//    原句；切勿流入公開資源分享區。
// ============================================================

const ENGLIT_PERSONA =
  'You are an experienced Hong Kong secondary Literature in English teacher marking to HKDSE standards, judging on Understanding, Textual evidence, Analysis & interpretation and Expression. Reward close reading anchored in quoted or referred-to text; credit analysis of how literary techniques create meaning (not what merely happens); penalise plot/content summary that does not interpret, unsupported assertion, and answers that ignore the actual question or word/text scope.'

export const ENGLIT: SubjectKnowledge = {
  subject: 'englit',
  label: '英語文學 (Literature in English)',
  lang: 'en',
  assessment: {
    papers: [
      'Paper 1 Essay Writing 論文寫作（50%，3 小時）：Section A 一條（兩本指定小說擇一）+ Section B 一條（兩齣指定戲劇擇一）+ Section C 一條（比較兩篇或以上短篇小說）。每個文本各設兩題選一，論文式作答，部分題目容許想像式延伸（imaginative expansion）。',
      'Paper 2 Appreciation 評賞（30%，2 小時）：三節各答一條，多為多分部（multi-part）題。Section A 賞析指定小說或戲劇選段（四選一，佔全科 10%）；Section B 指定詩作賞析（兩條選一；所評為兩至三首、同一或不同詩人之 set poems，佔 12%）；Section C 未見詩 unseen poem（必答，佔 8%）。',
      '校本評核 SBA（20%）：校內進行，創作 / 評論回應任務，將文學意義連繫當代文化議題（校內評，唔喺此 AI 批改範圍）。',
    ],
    weightings: 'Paper 1 Essay Writing 50% · Paper 2 Appreciation 30%（Section A 10% / Section B 12% / Section C 8%）· SBA 20%。等級 1–5**（七級）。',
    questionTypes: [
      'Essay on a set novel（character / theme / technique / imaginative response）',
      'Essay on a set play（dramatic technique / character / theme）',
      'Comparative essay on two or more short stories',
      'Critical appreciation of a set prose / drama extract',
      'Appreciation of set poems（single or comparative）',
      'Unseen poetry appreciation（thought, feeling & how conveyed）',
    ],
    sba: 'School-based Assessment 佔 20%（校內創作 / 評論回應，連繫文學與當代文化；校內評，非此 AI 批改範圍）。',
  },
  commandWords: [
    { word: 'Discuss', meaning: 'Explore an aspect of the text from more than one angle, building an argument with textual support rather than a one-sided assertion.' },
    { word: 'Analyse', meaning: 'Break down how techniques (imagery, diction, structure, form) work and the effect they create; go beyond stating what happens.' },
    { word: 'Comment on / Appreciate', meaning: 'Give a close, evaluative reading of language, form and effect, citing the text precisely.' },
    { word: 'Compare and contrast', meaning: 'Bring out both similarities and differences between texts / poems, point by point, not two separate descriptions.' },
    { word: 'To what extent / How far', meaning: 'Take a judged position on a claim about the text, weighing evidence for and against and reaching a supported conclusion.' },
    { word: 'Explore', meaning: 'Develop an interpretation in depth, considering nuance, ambiguity and alternative readings, all grounded in the text.' },
    { word: 'Show how / Examine how', meaning: 'Trace the writer’s methods step by step and link each to meaning, theme or effect.' },
    { word: 'With close reference to the text', meaning: 'Anchor every point in specific words, images or moments (quote or refer precisely); general assertion will not score.' },
  ],
  levelDescriptors: [
    { level: 'L5–5** (high)', descriptor: 'Sustained, perceptive interpretation that fully addresses the question; precise, well-chosen textual evidence; sophisticated analysis of how technique and form create meaning, with awareness of nuance / alternative readings; fluent, accurate, well-organised expression in an appropriate critical register.' },
    { level: 'L4', descriptor: 'Relevant, developed argument; apt textual support; clear analysis of techniques and their effects (not just identification); generally accurate, organised expression; engages the actual question.' },
    { level: 'L2–3', descriptor: 'Some relevant points but uneven development; limited or loosely linked textual support; leans on narration / paraphrase with thin analysis; basic organisation; language errors that occasionally blur meaning.' },
    { level: 'L1', descriptor: 'Largely plot retelling or off-question; little or no textual evidence; assertion without analysis; weak structure; frequent errors impeding communication.' },
  ],
  strands: [
    // ───────────────────── Genres（卷一 / 卷二 文類）─────────────────────
    {
      key: 'genres',
      label: 'Genres 文類（Poetry · Prose · Drama）',
      persona: ENGLIT_PERSONA,
      areas: [
        {
          key: 'poetry',
          label: 'Poetry 詩歌（set & unseen, incl. Paper 2 Section B / C）',
          keyConcepts: ['Form & structure (stanza, line, enjambment, volta, sonnet / free verse)', 'Sound (rhyme, rhythm / metre, alliteration, assonance, onomatopoeia)', 'Imagery & figurative language (metaphor, simile, personification, symbol)', 'Tone, mood & speaker / persona', 'Theme and the development of feeling across the poem', 'Reading an unseen poem: thought, feeling and how they are conveyed'],
          markingConventions: ['Reward analysis of HOW devices shape meaning / feeling, not bare device-spotting', 'Quotation must be precise and integrated, then interpreted', 'For unseen poetry, no fixed “right answer” — credit a coherent, text-supported reading', 'Comparative poem questions need integrated comparison, not two separate accounts'],
          commonErrors: ['Listing devices with no effect explained ("uses a metaphor" and stops)', 'Paraphrasing the poem instead of analysing it', 'Unsupported claims about tone with no cued evidence', 'Over-literal reading of figurative / symbolic language', 'Ignoring form / structure entirely', 'In comparison, describing each poem separately'],
          rubric: [
            { criterion: 'Understanding', max: 7, focus: 'Grasp of thought, feeling and meaning' },
            { criterion: 'Textual evidence', max: 6, focus: 'Precise, integrated quotation / reference' },
            { criterion: 'Analysis & interpretation', max: 7, focus: 'How form, sound and imagery create effect' },
            { criterion: 'Expression', max: 5, focus: 'Clear, accurate critical writing' },
          ],
          issueTypes: ['analysis', 'evidence', 'content', 'term', 'organization'],
        },
        {
          key: 'prose-fiction',
          label: 'Prose fiction 小說與短篇（set novels & short stories）',
          keyConcepts: ['Plot & structure (exposition, conflict, climax, resolution)', 'Characterisation (direct / indirect, development, foils)', 'Narrative voice & point of view (first / third, reliability)', 'Setting & atmosphere; symbolism & motif', 'Theme and authorial purpose', 'Comparison across short stories (Paper 1 Section C)'],
          markingConventions: ['Credit interpretation of how narrative method conveys theme / character', 'Reward apt, embedded textual reference over long retold passages', 'Comparative short-story answers must integrate texts around the question’s focus', 'Imaginative-response tasks still judged on understanding of and fidelity to the text'],
          commonErrors: ['Retelling the plot instead of answering the question', 'Treating characters as real people, ignoring authorial craft', 'Ignoring narrative voice / point of view', 'Generic theme statements with no textual anchor', 'In comparison, listing one story then the other'],
          rubric: [
            { criterion: 'Understanding', max: 7, focus: 'Grasp of text, character and theme' },
            { criterion: 'Textual evidence', max: 6, focus: 'Apt, embedded reference to the text' },
            { criterion: 'Analysis & interpretation', max: 7, focus: 'How narrative method conveys meaning' },
            { criterion: 'Expression', max: 5, focus: 'Organised, accurate critical writing' },
          ],
          issueTypes: ['analysis', 'evidence', 'content', 'argument', 'organization'],
        },
        {
          key: 'drama',
          label: 'Drama 戲劇（set plays, Paper 1 Section B）',
          keyConcepts: ['Dramatic structure (acts / scenes, exposition, climax, denouement)', 'Dramatic techniques (dialogue, soliloquy, aside, stage directions, dramatic irony)', 'Characterisation & relationships through speech and action', 'Conflict, tension and pacing', 'Theme and the play in performance', 'Setting / context as it bears on meaning'],
          markingConventions: ['Reward awareness of the text as drama (effect on / for an audience)', 'Credit analysis of how dramatic devices build character / tension / theme', 'Quotation from dialogue / stage directions must be interpreted, not just cited', 'Stay on the set question (e.g. a named character / relationship / theme)'],
          commonErrors: ['Treating the play as a novel — ignoring its dramatic form', 'Narrating the action rather than analysing technique', 'Missing dramatic irony / soliloquy function', 'Character assertion without dialogue evidence', 'Drifting from the named focus of the question'],
          rubric: [
            { criterion: 'Understanding', max: 7, focus: 'Grasp of plot, character and theme' },
            { criterion: 'Textual evidence', max: 6, focus: 'Apt reference to dialogue / stage craft' },
            { criterion: 'Analysis & interpretation', max: 7, focus: 'How dramatic technique creates effect' },
            { criterion: 'Expression', max: 5, focus: 'Clear, organised critical writing' },
          ],
          issueTypes: ['analysis', 'evidence', 'content', 'term', 'organization'],
        },
      ],
    },

    // ───────────── Literary Elements & Appreciation（手法與評賞）─────────────
    {
      key: 'literary-elements',
      label: 'Literary Elements & Appreciation 文學手法與評賞',
      persona: ENGLIT_PERSONA,
      areas: [
        {
          key: 'language-style',
          label: 'Language, imagery & style 語言、意象與風格',
          keyConcepts: ['Diction & connotation; register & tone', 'Imagery & figurative language (metaphor, simile, symbol, personification)', 'Sound & rhythm in prose / verse', 'Syntax, sentence variety and pace', 'Irony, ambiguity and understatement', 'How style serves meaning and effect'],
          markingConventions: ['Reward the link technique → effect → meaning, not naming alone', 'Use correct literary terminology accurately and only where apt', 'Embed short, well-chosen quotations and unpack their working', 'Distinguish the writer’s craft from the content it conveys'],
          commonErrors: ['Feature-spotting without explaining effect', 'Misusing or inventing literary terms', 'Quoting at length without comment', 'Confusing tone with subject matter', 'Vague effect statements ("makes it interesting")'],
          rubric: [
            { criterion: 'Understanding', max: 7, focus: 'Grasp of how language conveys meaning' },
            { criterion: 'Textual evidence', max: 6, focus: 'Precise, well-chosen quotation' },
            { criterion: 'Analysis & interpretation', max: 7, focus: 'Technique → effect → meaning' },
            { criterion: 'Expression', max: 5, focus: 'Accurate terminology and writing' },
          ],
          issueTypes: ['analysis', 'term', 'evidence', 'vocabulary', 'content'],
        },
        {
          key: 'critical-appreciation',
          label: 'Critical appreciation of extracts 選段評賞（Paper 2 Section A）',
          keyConcepts: ['Close reading of a prose / drama extract in context', 'Identifying the writer’s purpose and central concern', 'Analysing language, structure and technique in the passage', 'Linking the extract to character / theme / mood', 'Building a focused argument that answers the set question'],
          markingConventions: ['Stay within the extract while using it to support a clear line of argument', 'Cover language, structure and effect, not just paraphrase the content', 'Quotation must be precise and interpreted in relation to the question', 'Credit a perceptive, coherent reading over coverage of every line'],
          commonErrors: ['Line-by-line paraphrase with no overarching argument', 'Ignoring structure / shifts within the passage', 'General comments not tied to the actual extract', 'Importing outside plot at the expense of close reading', 'Listing techniques without analysing their effect'],
          rubric: [
            { criterion: 'Understanding', max: 7, focus: 'Grasp of the passage and its concern' },
            { criterion: 'Textual evidence', max: 6, focus: 'Precise reference within the extract' },
            { criterion: 'Analysis & interpretation', max: 7, focus: 'Language / structure / effect' },
            { criterion: 'Expression', max: 5, focus: 'Focused, well-organised argument' },
          ],
          issueTypes: ['analysis', 'evidence', 'content', 'argument', 'organization'],
        },
      ],
    },

    // ───────────── Critical Response（個人 / 批判回應與比較）─────────────
    {
      key: 'critical-response',
      label: 'Critical Response 批判回應（Appreciation · Comparison · Personal response）',
      persona: ENGLIT_PERSONA,
      areas: [
        {
          key: 'argument-essay',
          label: 'Building a literary argument 文學論證寫作',
          keyConcepts: ['Clear thesis / line of argument answering the exact question', 'Topic sentences and signposted, developed paragraphs', 'Point–Evidence–Analysis (PEE / PEEL) integration', 'Sustained relevance to the question’s key terms', 'Conclusion that judges rather than merely repeats', 'Appropriate critical register'],
          markingConventions: ['Reward a controlled argument that engages the precise wording of the question', 'Every point should be supported and analysed, not asserted', 'Address the whole question (e.g. "to what extent" needs a weighed judgement)', 'Organisation and cohesion are credited alongside content'],
          commonErrors: ['Pre-prepared answer that ignores the actual question', 'Assertion without textual support or analysis', 'Drifting off the key terms of the task', 'No real conclusion / judgement', 'Disorganised paragraphs with no topic sentences'],
          rubric: [
            { criterion: 'Understanding', max: 7, focus: 'Relevance to the exact question' },
            { criterion: 'Textual evidence', max: 6, focus: 'Support integrated with the argument' },
            { criterion: 'Analysis & interpretation', max: 7, focus: 'Reasoned, developed argument' },
            { criterion: 'Expression', max: 5, focus: 'Organisation, cohesion, register' },
          ],
          issueTypes: ['argument', 'evidence', 'analysis', 'organization', 'content'],
        },
        {
          key: 'comparison-personal',
          label: 'Comparison & personal response 比較與個人回應',
          keyConcepts: ['Integrated comparison around a shared focus (theme / technique / effect)', 'Similarities AND differences, point by point', 'An informed personal response justified by the text', 'Awareness of context where it illuminates meaning', 'Alternative readings and nuance'],
          markingConventions: ['Comparison must be integrated, not two parallel descriptions', 'Personal response must be informed and text-justified, not unsupported opinion', 'Credit perceptive links and well-judged evaluation', 'Keep the comparison anchored to the question’s focus'],
          commonErrors: ['"Text A then Text B" with no real comparison', 'Personal opinion with no textual justification', 'Comparing surface plot, not technique / theme / effect', 'Unbalanced treatment (one text barely covered)', 'Listing context facts unconnected to the argument'],
          rubric: [
            { criterion: 'Understanding', max: 7, focus: 'Grasp of both / all texts on the focus' },
            { criterion: 'Textual evidence', max: 6, focus: 'Apt evidence from each text' },
            { criterion: 'Analysis & interpretation', max: 7, focus: 'Integrated comparison and judgement' },
            { criterion: 'Expression', max: 5, focus: 'Coherent, balanced organisation' },
          ],
          issueTypes: ['argument', 'evidence', 'analysis', 'content', 'organization'],
        },
      ],
    },
  ],
  publicResources: [
    { label: 'HKEAA Literature in English 科目資訊（官方：課程評估 / 樣本試題 / 表現示例）', url: 'https://www.hkeaa.edu.hk/en/HKDSE/assessment/subject_information/category_a_subjects/liteng/' },
    { label: 'HKEAA — Literature in English Introduction / Assessment Framework（官方 PDF）', url: 'https://www.hkeaa.edu.hk/DocLibrary/HKDSE/Subject_Information/liteng/2026hkdse-e-elit.pdf' },
    { label: 'HKEAA — Literature in English SBA Teachers’ Handbook（官方校本評核手冊）', url: 'https://www.hkeaa.edu.hk/DocLibrary/SBA/HKDSE/SBAhandbook-2026-LITE.pdf' },
    { label: 'EDB — Literature in English Curriculum & Assessment Guide（課程及評估指引）', url: 'https://www.edb.gov.hk/en/curriculum-development/kla/eng-edu/curriculum-documents.html' },
  ],
  source:
    '提煉自 HKEAA Literature in English 課程及評估指引 / 評核大綱（Paper 1 Essay Writing 50% / Paper 2 Appreciation 30%，內含 Section A 10% / B 12% / C 8% / SBA 20%）+ 官方評核目標（背景與文本內容及作者手法熟悉度 / 有理據個人回應 / 清晰精煉批判分析 / SBA 自由想像表達）+ Sample Paper / Sample Performance + 公開文學評賞批改知識。批改慣例可再以官方 Sample Performance / 考評報告逐題校準。',
}
