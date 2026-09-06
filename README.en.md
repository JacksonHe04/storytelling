<div align="center">

# storytelling

**A daily interview that slowly settles into you.**

An open-source, local-first AI autobiography system: it listens to your voice memos, transcribes them, and quietly writes them into a literary memoir—then reads the biography it wrote to ask you better questions tomorrow.

English · [简体中文](./README.md)

</div>

---

## What is this

storytelling is not a note-taking app, and it is not a chatbot. It is a set of agent skills that run on your own machine, built around one core hypothesis:

> **An AI with your full historical context can ask better questions—and your answers make it understand you even more.**

Each day you speak a few sentences into your voice memos—what happened, what you're anxious about, what you're looking forward to. storytelling takes those recordings, transcribes them, and distills them into a literary autobiography, organized into volumes / chapters / sections and growing continuously. The biography itself then becomes the basis for the next interview: the AI reads it, finds the gaps and the vague spots, and asks the question only it could ask today.

The more it knows → the better it asks → the more it knows. That loop is the product.

## How it works

```
Apple Voice Memos / Feishu Minutes
      │  story-listen
      ▼
recordings/<slug>-<time>/recording.m4a
      │  story-transcribe (Doubao ASR + personal hotword list)
      ▼
recordings/<slug>-<time>/transcript.md ─┐
                                        │
interviews/<date>.md ───────────────────┼─► story-write (the only biography writer)
  (offline question lists / interactive │      ├─► biography/<year>/<month>/<NN>-<section>.md
   interview transcripts)               │      └─► MEMORY.md
sources/notion (local Notion export)    │
      │  story-research (mines gaps in the biography)
      └────────────────────────────────┘
                    ▲
                    │ story-interview (reads the biography, asks, feeds back)
```

| Skill | Role | Output |
|-------|------|--------|
| [story-listen](./skills/story-listen/SKILL.md) | **Listen**: import recordings from Apple Voice Memos (incremental export via its private SQLite DB) or Feishu Minutes (which ships its own transcript) | `recordings/…/{meta.json, recording.m4a}` |
| [story-transcribe](./skills/story-transcribe/SKILL.md) | **Transcribe**: batch transcription via Doubao Flash ASR, with a personal hotword list for proper nouns and global alias normalization | `transcript.md` |
| [story-write](./skills/story-write/SKILL.md) | **Write**: read every source, write biography sections in your chosen style (Murakami-esque by default), maintain long-term memory | `biography/…/*.md` + `MEMORY.md` |
| [story-interview](./skills/story-interview/SKILL.md) | **Interview**: read the biography, memory, and recent transcripts; produce an offline question list or run a one-question-at-a-time interview | `interviews/<date>.md` |
| [story-research](./skills/story-research/SKILL.md) | **Research**: search external corpora (e.g., a local Notion export) to fill biographical gaps and verify details | handed to story-write in-session, no intermediate files |

## Quick start

> Currently runs fully on macOS (Voice Memos import depends on the Mac's private database) and requires an agent runtime such as Claude Code.

```bash
git clone https://github.com/JacksonHe04/storytelling.git
cd storytelling
```

1. **Install the skills**: symlink or copy each directory under `skills/` into your agent's skills directory (`~/.claude/skills/` for Claude Code).
2. **Initialize the data directory**: running any skill script for the first time creates `~/.storytelling/` (override with `STORYTELLING_HOME`).
3. **Configure transcription**: put your Doubao (Volcano Engine) ASR `api_key` in `~/.storytelling/settings.json`; optionally add your proper nouns to `hotwords.txt`.
4. **Run the loop**:

```bash
# Listen: incrementally export Voice Memos (requires Full Disk Access)
node skills/story-listen/scripts/export.js

# Transcribe: every recording that has no transcript yet
node skills/story-transcribe/scripts/transcribe.js

# Write: say "write the biography" in an agent session, or preview pending material first
node skills/story-write/scripts/plan.js
```

From then on, just tell the agent "interview me", "research XX", or "write the biography".

## What stays on your disk

Everything lives under `~/.storytelling/` as plain Markdown with YAML frontmatter:

```
~/.storytelling/
├── settings.json          # keys & model config (not committed)
├── hotwords.txt           # ASR hotword list
├── recordings/            # one self-contained directory per recording (meta.json + audio + transcript.md)
├── interviews/            # daily interviews: offline question lists / interactive transcripts
├── sources/               # symlinks to external corpora (e.g., local Notion export)
├── biography/<year>/<month>/  # the biography: years are volumes, months are chapters, each file is a section
├── MEMORY.md              # long-term memory: who this person is
└── log/                   # batch logs per skill
```

Grep it, version it with git, print it as a book, or hand it to any AI as memory.

## Principles

- **Voice in, Markdown out.** Every recording ends up as a timestamped, source-attributed Markdown file on your disk. Nothing gets locked into a SaaS.
- **Local-first, forever.** Your autobiography lives in a folder you control. Migrate it, back it up, version it, hand it to another agent—it stays yours.
- **The agent is a biographer, not a transcriber.** Transcripts are raw material; the biography is literature. Scripts handle deterministic planning and conversion; selection, restructuring, and emotional tone are the agent's craft. The only thing it must never do is invent.
- **The biography drives the interview; the interview feeds the biography.** Processing state *is* the biography: the union of `sources` across section frontmatter tells you exactly what has been absorbed.
- **One recording, one directory.** Audio, metadata, and transcript live together—self-contained, portable, grep-able.

## Web demo

[web/](./web) is a bilingual landing page (Next.js 16 + Tailwind 4) that tells the story of this loop—it is the face of this repo:

```bash
cd web && pnpm install && pnpm dev
```

## Status

v0.0.1 · cold start · a personal research project. All five skills are shipped and have been running on the author's daily recordings for weeks; docs and onboarding are being polished. Issues and discussions are welcome—please open an issue before submitting a PR.

## Why open source

The first ten days were mine: letting the AI interview me and write my biography, refining every step into a reusable skill. After that, it is yours—give it your voice memos, and get back a book that never stops growing and belongs entirely to you.

---

<div align="center">

If this idea resonates with you, a ⭐ is a great way to start.

</div>
