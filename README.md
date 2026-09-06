<div align="center">

# storytelling

**一场每天进行的访谈，慢慢沉淀为你。**

一个开源、local-first 的 AI 自传系统：它聆听你的语音备忘录，转写成文字，再悄悄写成一本文学性的自传——然后读着你写下的传记，问出明天更好的问题。

[English](./README.en.md) · 简体中文

</div>

---

## 这是什么

storytelling 不是笔记应用，也不是聊天机器人。它是一组运行在你自己机器上的 agent skill，围绕一个核心假设构建：

> **AI 基于对你的全部历史 context，能问出更好的问题；而这些问题的答案，又会让它更了解你。**

你每天对着语音备忘录说几句话——今天发生了什么、焦虑什么、期待什么。storytelling 把这些录音接走，转写成文字，沉淀为一部按「部 / 章 / 节」组织、持续生长的文学传记。而传记本身又成为下一次采访的依据：AI 通读它，找出空白与含糊之处，问出只有它今天才问得出的问题。

越了解 → 越会问 → 越了解。这个循环，就是产品本身。

## 它如何运转

```
Apple 语音备忘录 / 飞书妙记
      │  story-listen
      ▼
recordings/<slug>-<时间>/recording.m4a
      │  story-transcribe（豆包 ASR + 个人热词表）
      ▼
recordings/<slug>-<时间>/transcript.md ─┐
                                        │
interviews/<日期>.md ───────────────────┼─► story-write（唯一传记写入者）
  （离线访谈录 / 交互访谈记录）          │      ├─► biography/<年>/<月>/<NN>-<小节>.md
                                        │      └─► MEMORY.md
sources/notion（Notion 本地导出）        │
      │  story-research（按传记空白检索挖掘）
      └────────────────────────────────┘
                    ▲
                    │ story-interview（读传记，问出好问题，回流素材）
```

| Skill | 职责 | 产出 |
|-------|------|------|
| [story-listen](./skills/story-listen/SKILL.md) | **聆听**：从 Apple 语音备忘录（私有 SQLite 增量导出）或飞书妙记（自带逐字稿）导入录音 | `recordings/…/{meta.json, recording.m4a}` |
| [story-transcribe](./skills/story-transcribe/SKILL.md) | **转写**：豆包录音识别极速版批量转写，配个人热词表修正专名，支持全局专名归一 | `transcript.md` |
| [story-write](./skills/story-write/SKILL.md) | **撰写**：通读全部素材，按你定义的文风（默认村上春树式）撰写传记小节，维护长期记忆 | `biography/…/*.md` + `MEMORY.md` |
| [story-interview](./skills/story-interview/SKILL.md) | **采访**：读传记、长期记忆与近期转写，生成离线访谈录或进行一次一问的交互访谈 | `interviews/<日期>.md` |
| [story-research](./skills/story-research/SKILL.md) | **挖掘**：从你的 Notion 本地导出等外部语料中检索，填补传记空白、核实细节 | 会话内直供 story-write，不落中间产物 |

## 快速开始

> 目前仅在 macOS 上完整运行（语音备忘录导入依赖 Mac 私有数据库），需要已接入 agent 运行时（如 Claude Code）。

```bash
git clone https://github.com/JacksonHe04/storytelling.git
cd storytelling
```

1. **安装 skills**：把 `skills/` 下的各目录链接或复制进你的 agent 的 skills 目录（Claude Code 为 `~/.claude/skills/`）。
2. **初始化数据目录**：首次运行任意 skill 脚本会自动创建 `~/.storytelling/`（可用 `STORYTELLING_HOME` 覆盖）。
3. **配置转写**：在 `~/.storytelling/settings.json` 中写入豆包（火山引擎）ASR 的 `api_key`；可选编辑 `hotwords.txt` 加入你的专名热词。
4. **跑通循环**：

```bash
# 聆听：增量导出语音备忘录（需完整磁盘访问权限）
node skills/story-listen/scripts/export.js

# 转写：所有尚未转写的录音
node skills/story-transcribe/scripts/transcribe.js

# 撰写：在 agent 会话中说「写传」，或先跑规划脚本看看待处理素材
node skills/story-write/scripts/plan.js
```

之后在 agent 会话里对它说「**采访我**」「**挖掘一下 XX**」「**写传**」，剩下的交给它。

## 留在硬盘上的东西

一切都在 `~/.storytelling/` 下，是带 YAML frontmatter 的纯 Markdown：

```
~/.storytelling/
├── settings.json          # 密钥与模型配置（不进仓库）
├── hotwords.txt           # ASR 热词表
├── recordings/            # 每份录音一个自包含目录（meta.json + 音频 + transcript.md）
├── interviews/            # 每日访谈：离线访谈录 / 交互访谈记录
├── sources/               # 外部语料软链（如 Notion 本地导出）
├── biography/<年>/<月>/   # 传记：年份是部，月份是章，每篇文章是一小节
├── MEMORY.md              # 长期记忆：这个人是谁
└── log/                   # 各 skill 的批次日志
```

可以 grep，可以用 git 版本管理，可以印成书，也可以交给任何一个 AI 当记忆。

## 设计原则

- **语音进去，Markdown 出来。** 每一份录音最终都成为硬盘上一个带时间戳、标注了来源的 Markdown 文件。没有任何东西被锁进 SaaS。
- **Local-first，直到永远。** 你的自传躺在你掌控的文件夹里。迁移、备份、版本管理、交给别的 agent——它始终是你的。
- **Agent 是传记作家，不是转录员。** 转写稿是素材，传记是文学。脚本只做确定性的规划与转换；取舍、重组、定情绪底色，是 agent 的工作。唯一不能做的是无中生有。
- **传记是采访的依据，采访是传记的来源。** 处理状态即传记本身：小节 frontmatter 里的 `sources` 并集就是「哪些素材已入传」。
- **一份录音 = 一个目录。** 音频、元数据、转写文本聚合在同一目录，自包含、可整体打包迁移。

## Web 演示

[web/](./web) 是一个双语落地页（Next.js 16 + Tailwind 4），用文学化的方式讲述这套循环——它就是这个仓库的门面：

```bash
cd web && pnpm install && pnpm dev
```

## 状态

v0.0.1 · 冷启动 · 个人研究项目。五个 skill 已全部落地并在作者的每日录音上跑了数周；正在打磨文档与上手体验。欢迎 issue 与讨论，PR 之前先开 issue 聊聊。

## 为什么开源

最初的十天，是我自己跑本地化：让 AI 采访我、为我写传，把每个环节打磨成可复用的 skill。此后，它是你的——把你的语音备忘录交给他，换回一本不断生长的、完全属于你的书。

---

<div align="center">

如果这个想法打动了你，给一个 ⭐ 会是很好的开始。

</div>
