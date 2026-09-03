---
name: story-write
description: 撰写 —— 把录音转写稿（transcript）沉淀为文学化个人传记并维护长期记忆。读取 ~/.storytelling/recordings/ 下的 transcript，按 STORY.md 规定的村上春树式风格与「部/章/节」结构，撰写/更新 biography/ 下的传记小节，并维护 MEMORY.md。当用户需要整理录音成传记、写回忆录、更新自传、把日记沉淀成文章、或运行 story-write/撰写/写传时，使用此 skill。
---

# story-write · 撰写

把录音转写稿沉淀成一部持续生长的文学传记。写作由你（agent）完成，脚本只做确定性的规划准备。

## 第一步：务必先完整阅读传记宪法

**动笔前必须完整读 `~/.storytelling/STORY.md`**，它规定了写作风格（村上春树式、有文采、淡淡忧伤）、
反面清单、传记结构（年份=部、月份=章、每个 md=小节）、小节 frontmatter 规范、以及撰写原则。
本 skill 不重复这些规范——**一切以 STORY.md 为准**；用户修改 STORY.md 后风格与结构即随之改变。

## 第二步：规划待处理工作

运行规划脚本，得到「哪些月份有尚未写入传记的录音」：

```bash
node skills/story-write/scripts/plan.js
```

输出 JSON：
- `pending`：按 `YYYY-MM` 分组的未入传录音（含 uuid、title、date、transcriptPath）。判断依据是
  所有已有小节 frontmatter 里 `sources` 的 uuid 并集——**小节的 sources 即处理状态**。
- `existingSections`：各月已有的小节文件（path、title、section 序号、sources）。
- `stats`：总数与待处理月份列表。

## 第三步：读长期记忆

读 `~/.storytelling/MEMORY.md`，建立对「这个人是谁」的整体 context（身份、重要的人、项目、当前主线、时间线）。

## 第四步：逐章（月）撰写，从最早的月份开始

对每个待处理月份，按顺序：

1. **读已有小节**（若 `existingSections[该月]` 非空）：理解已写到哪里、每节的主题与情绪。
2. **通读该月全部待处理 transcript 全文**（`transcriptPath`）。不是浏览，是通读——
   体会那个人当时的心境：焦虑、期待、疲惫、嘴硬、故作轻松、说不出口的话。口头上的「还好」
   「就这样呗」底下往往压着别的东西，要能听出来（见 STORY.md 撰写原则第 5 条）。
3. **决定小节划分**：这些素材该织入已有小节、还是新开小节？一节像小说里的一小节，有相对完整性
   和主题性，不强制日期边界、不刻意点题，宏观按时间推进、允许主题交叉。为每节拟一个文学化小标题。
4. **撰写/重写小节文件**，写入 `~/.storytelling/biography/<年份>/<月份MM>/<NN>-<小节标题>.md`：
   - 目录不存在就创建；`<NN>` 为章内两位序号（新开小节取已有小节数 +1）。
   - 必须带 STORY.md 规定的 frontmatter：`type: biography-section`、`volume`、`chapter`、`section`、
     `title`、`period`（大致覆盖时间，松散即可）、`sources`（本节基于的录音 uuid 列表）、`updated_at`。
   - 正文严格按 STORY.md 的风格写：第一人称、村上式克制与文采、淡淡忧伤、具体物件与感官细节、
     不流水账、不职场黑话、不堆砌情绪词、不照搬口语、不虚构。
   - 织入已有小节时整篇重写为一篇完整文章，不在文末追加流水。
5. **覆盖核对**：处理完一个月后，确保该月**所有**待处理录音的 uuid 都出现在某个小节的 `sources` 里
   （一个录音只归属一节，不要在两节重复书写同一素材）。遗漏会导致下次 plan 仍把它列为待处理。

## 第五步：更新 MEMORY.md

全部章节处理完后，回到 `~/.storytelling/MEMORY.md`，按 STORY.md 的 MEMORY 规范更新：
新增确认的稳定事实（人、项目、主线、时间线节点），修正过期信息。事实性、简洁、不追求文学性。

## 第六步：写批次日志

撰写完成后，写 `~/.storytelling/log/write/<YYYY-MM-DD-HHMMSS>.json`：

```json
{
  "batch_id": "<同文件名>",
  "skill": "write",
  "started_at": "<ISO>",
  "finished_at": "<ISO>",
  "sections": [
    { "action": "created|updated", "path": "biography/2026/09/01-....md", "title": "...", "sources": ["<uuid>"] }
  ],
  "memory_updated": true
}
```

## 要点

- **你是传记作家，不是转录员。** transcript 是素材，传记是文学。取舍、重组、留白、定情绪底色，
  都是你的工作；唯一不能做的是无中生有。
- **一次写好一个月再往下走**，不要跨月拼凑。
- 风格拿不准时，回到 STORY.md 重读那 10 条风格要求和反面清单。
