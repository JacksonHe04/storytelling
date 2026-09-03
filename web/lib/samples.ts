import type { Locale } from "../i18n/routing";

// Multi-line on-disk artifacts shown in the signature "open book" section.
// Kept out of message JSON to avoid escaping real Markdown/YAML content.
const samples = {
  en: {
    tree: `~/.storytelling/
├── STORY.md            # the constitution: voice & structure
├── MEMORY.md           # long-term memory, facts only
├── hotwords.txt        # names, places, projects
├── settings.json
├── recordings/
│   └── 260901-diary-2026-09-01-2054/
│       ├── meta.json       # iCloud uuid · duration · title
│       ├── recording.m4a
│       └── transcript.md   # plain-text transcript
├── biography/
│   └── 2026/
│       └── 09/
│           └── 01-morning-along-the-canal.md
└── log/                # one entry per batch`,
    bioFm: `type: biography-section
volume: 2026
chapter: 9
section: 1
title: Morning along the canal
period: 2026-08-31 → 2026-09-03
sources:
  - 7f3a…c2
  - 91bd…0e
updated_at: 2026-09-03T23:10:00+08:00`,
    bioProse: `The path along the canal still held last night's rain. I had been circling the same question for three weeks — until I said it out loud into a recording, and the answer came back small and immediate. Nothing like the dramatic one I had been rehearsing.`,
  },
  zh: {
    tree: `~/.storytelling/
├── STORY.md            # 传记宪法：文风与结构
├── MEMORY.md           # 长期记忆，只记事实
├── hotwords.txt        # 人名、地名、项目名
├── settings.json
├── recordings/
│   └── 260901-日记-2026-09-01-2054/
│       ├── meta.json       # iCloud uuid · 时长 · 标题
│       ├── recording.m4a
│       └── transcript.md   # 纯文本逐字稿
├── biography/
│   └── 2026/
│       └── 09/
│           └── 01-运河边的清晨.md
└── log/                # 每批运行一条日志`,
    bioFm: `type: biography-section
volume: 2026
chapter: 9
section: 1
title: 运河边的清晨
period: 2026-08-31 → 2026-09-03
sources:
  - 7f3a…c2
  - 91bd…0e
updated_at: 2026-09-03T23:10:00+08:00`,
    bioProse: `运河边的小路还留着昨夜的雨。同一个问题，我绕了三个星期，直到在录音里把它说出口——答案很小，立刻就来了，一点也不像我在心里排练过的那样戏剧化。`,
  },
} as const;

export const getSamples = (locale: Locale) => samples[locale];
