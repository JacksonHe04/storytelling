---
name: story-research
description: 挖掘 —— 从外部语料（Notion 本地导出，经 ~/.storytelling/sources/ 软链挂载）中检索与传记相关的信息，填补传记空白、核实细节、补充 context，结果在会话内直接交给 story-write 更新传记（不落中间产物）。当用户想从 Notion/历史资料里找信息补进传记、核实传记中的细节、挖掘过往笔记、或运行 story-research/挖掘/检索时，使用此 skill。
---

# story-research · 挖掘

传记越厚，挖掘越准——先有传记和访谈作为「知道该找什么」的依据，检索才有命中率。
这个 skill 负责 data flow 里的「外部 context」：从用户的长期资料库（第一期是 Notion
本地导出）里挖出与传记相关的信息。**产出不落盘**：挖到的东西在会话内呈给用户确认，
随后直接走 story-write 更新传记。

## 前置：挂载 sources

```bash
node skills/story-research/scripts/check.js
# --target=<目录>  指定 Notion 本地导出路径（默认 ~/California/Wiki/notion）
```

脚本确保 `~/.storytelling/sources/notion` 软链有效（缺失自动创建、坏链自动重建），
输出挂载状态与 md 文件数。`ready: false` 时不要继续。

**增量更新**（想拿到最新导出时）：

```bash
~/Codes/okf-anything/bin/okfa config root   # 先确认 workspace root 指向真实存在的目录
~/Codes/okf-anything/bin/okfa sync notion
```

OKFA 的 token 已配置好，本 skill 不做任何 Notion API 二次开发；若 okfa 配置的 root
已失效，请用户用 `okfa config edit` 修正，不要猜测或绕过。

## 工作流

1. **明确挖掘目标**。三种来源：story-interview 产出的传记空白、近期 transcript 里的
   主题、用户直接指定的命题（如「查一下 2024 年实习经历的细节」）。目标不明确时先问
   用户一句。
2. **多轮检索**。语料是约 3000+ 个 md 的目录树（顶层空间如 All About Myself / Days /
   Great Escape / World's End Notion / iNon Space），先用 `ls` 了解结构，再从目录名
   下钻 + 全文检索结合：

```bash
grep -ril "关键词" ~/.storytelling/sources/notion/    # 大小写不敏感列出命中文件
rg -l --no-ignore -i "关键词|正则" ~/.storytelling/sources/notion/
```

   检索词要多样：中文名、英文名、别名、项目代号轮着来；一轮没命中不等于没有，换词再试。
3. **通读命中文件**，筛出与目标相关的部分。注意导出文件是快照——文件里的时间信息
   （frontmatter、正文日期）比文件系统 mtime 可靠。
4. **区分事实与线索**：用户明确写过的是事实；只言片语、待办、草稿是线索。传记只收事实，
   线索要么向用户求证，要么放弃——research 不生产传说。
5. **呈报与回流**：把挖到的信息按「与传记哪个部分相关、补了什么」呈给用户确认，确认后
   在同一会话内衔接 story-write（其 plan.js 会照常处理），把素材织入对应小节。
   挖掘本身不改任何文件。

## 要点

- **你是研究员，不是搬运工。** 检索结果要筛选、组织、与传记已有内容对照，不是把 Notion
  原文粘给用户。
- Notion 空间里有大量与个人无关的内容（知识库、收集夹），检索时以「关于这个人」为准绳，
  无关命中直接丢弃。
- 找不到就明说找不到，附上试过的检索词——空手而归的诚实汇报比硬凑素材有价值得多。
