# 专名校正与热词维护（ASR 归一方法论）

> 转写稿里的人名、公司名、产品名几乎必然出现 ASR 误写（如「借月星辰」→「阶跃星辰」）。
> 本文档规定发现、澄清、校正、沉淀的完整流程。数据源是 `scripts/aliases.json`，
> 执行工具是 `scripts/normalize.js`。

## 权威级联

判断一个写法是否可信，按以下顺序：

1. **用户澄清过的**（对话中明确确认）——最高权威，立即落入 `aliases.json` 的 `confirmed`。
2. **hotwords.txt 已有的**——视为已确认（热词表即历史澄清的沉淀）。
3. **上下文可推断但未经确认的**——传记/正文中先用**保守写法**（宁可泛化、不传播具体误写），
   同时把疑似写法记入 `aliases.json` 的 `pending`，等待澄清。
4. **无任何依据的**——不写进任何文件。

## 工作流程

### 1. 发现

通读转写稿时，凡是**人名、公司名、产品名、课程名、活动名**出现可疑写法（同音字、形近字、
中英混写漂移），即为疑似误写。典型模式：

- 同一个人的名字在多篇转写稿里写法不一致（如 瑞娜/薇娜/Reina）；
- 中英文之间漂移（如 StableFun/StepFun）；
- 显然不合语境的词（如「结营」出现在审批流里，实为「洁莹」）。

### 2. 查表

先查 `aliases.json` 的 `confirmed` 与 `hotwords.txt`。命中即视为已确认，
直接运行 `normalize.js` 替换，无需再问用户。

### 3. 澄清

未命中的，收集**上下文片段**（原文引用 + 出现的录音），向用户一次性列出询问：
「这几个写法是否正确 / 正确写法是什么」。用户的回答即权威结论。

### 4. 沉淀（三件事缺一不可）

用户澄清后：

1. **`aliases.json`**：把条目从 `pending` 移入（或新增到）`confirmed`
   （`correct` + `aliases` + `note`）；
2. **`hotwords.txt`**：把正确写法加入对应分组（人名 / 公司与组织 / 个人项目等）——
   下次 ASR 转写自动生效，从源头减少误写；
3. **运行 `normalize.js`**：把已有转写稿、传记、MEMORY 里的旧写法全部替换。

### 5. 热词维护规则

- 热词是**提示而非强制**，不保证 100% 生效，但能显著提高命中；
- 放人名（含称呼）、公司/组织、产品/项目名、高频术语；不放普通词；
- 中英文名都放（如 `Reina`、`StepFun`、`SAYLESS`）；
- 每次澄清后同步，不积攒；定期（如每次 story-write 批次后）回顾 `pending` 是否该清空。

## 脚本用法

```bash
# 预览会替换什么（不写盘）
node skills/story-transcribe/scripts/normalize.js --dry-run

# 执行替换（transcript.md + biography/**/*.md + MEMORY.md）
node skills/story-transcribe/scripts/normalize.js
```

- 替换按别名**长度降序**进行，避免嵌套误替换（「谢玉萌」先于「玉萌」）；
- 批次日志写入 `~/.storytelling/log/transcribe/<批次时间>.json`；
- `meta.json`、`hotwords.txt`、`aliases.json` 本身不会被脚本改动。
