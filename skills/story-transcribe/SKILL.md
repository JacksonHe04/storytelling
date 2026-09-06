---
name: story-transcribe
description: 转写 —— 调用豆包（火山引擎）录音文件识别极速版，把 ~/.storytelling/recordings/ 下的录音批量转写为文本，结果写入各录音目录的 transcript.md（YAML frontmatter + 转写正文）；并负责专名校正与热词维护（aliases.json 专名对照表、normalize.js 全局归一、向用户澄清 ASR 误写）。当用户需要转写录音、语音转文字、把录音变成文字稿、校正转写稿中的专有名词、或为后续传记撰写准备文本语料时，使用此 skill。
---

# story-transcribe · 转写

把 `~/.storytelling/recordings/` 下尚未转写的录音，通过豆包录音文件识别**极速版** API
（同步返回、base64 直传，无需对象存储）批量转写为 `transcript.md`。

## 前置条件

- `~/.storytelling/settings.json` 中配置 `doubao.api_key`；`doubao.asr_resource_id` 默认为极速版 `volc.bigasr.auc_turbo`。
- 录音已由 story-listen 导出（各录音目录含 `meta.json` 与 `recording.m4a`）。
- 可选：`~/.storytelling/hotwords.txt` 热词表，每行一个词，`#` 开头为注释。热词通过 `corpus.context`
  传给 ASR，用于纠正人名、公司名、项目名等个人专有名词（已验证可把误识别的「借月星辰」纠正为「阶跃星辰」）。
  热词是提示而非强制，不保证 100% 生效。

零第三方依赖：HTTP 用 Node 内置 `fetch`，热词/批次日志复用 story-listen 的 `scripts/storytelling.js`。

## 产出

- **`transcript.md`：纯文本转写结果**（不含 YAML 等任何元数据）。
- 转写元数据写入同目录 `meta.json` 的 `transcription` 块：

```json
{
  "...": "meta.json 原有字段（uuid/title/created_at 等）",
  "transcription": {
    "provider": "doubao",
    "model": "volc.bigasr.auc_turbo",
    "language": "auto",
    "ddc": true,
    "hotwords_count": 37,
    "transcribed_at": "2026-09-03T...",
    "text_length": 2333,
    "logid": "..."
  }
}
```

转写参数：ITN 开启（口语数字日期规范化）、标点开启、语义顺滑 `enable_ddc` 开启（API 侧去除
部分「嗯/呃」类语气词；实测效果温和，轻度口吃重复仍会保留，不做代码侧删减）、单人口述不做
说话人分离、不启用敏感词过滤。

批次日志写入 `~/.storytelling/log/transcribe/<批次时间>.json`，逐条记录成功/失败（含 API 耗时、
文本长度、logid）。

## 用法

```bash
# 转写所有还没有 transcript.md 的录音（按录音时间正序）
node skills/story-transcribe/scripts/transcribe.js

# 只转写指定录音目录
node skills/story-transcribe/scripts/transcribe.js --dir=260903-复盘-2026-09-03-2056

# 强制重新转写（已有 transcript.md 也重转）
node skills/story-transcribe/scripts/transcribe.js --force

# 本批最多处理 N 条（控制批量）
node skills/story-transcribe/scripts/transcribe.js --limit=5
```

## 工作流程（脚本内部）

1. 读取 settings（API Key、resource id）与 hotwords.txt。
2. 扫描 `recordings/`：有 `meta.json` + 音频、且无 `transcript.md` 的目录为待转写（`--force` 时忽略后者）。
3. 逐条：音频 base64 → POST `recognize/flash`（带热词 corpus、ddc 语义顺滑）→ 校验 `X-Api-Status-Code: 20000000`。
4. 转写文本写入 `transcript.md`（纯文本），转写元数据并入 `meta.json` 的 `transcription` 块；失败条目记录日志后继续，不中断批次。
5. 写批次日志。

## 限制与兜底

- 极速版限制 2 小时 / 100MB；超出的录音需改用标准版（异步 + 音频 URL），目前数据最长 27 分钟，无此问题。
- m4a 直传已验证可用；若未来格式报错，可用 afconvert 转 16kHz 单声道 WAV 兜底。

## 专名校正与热词维护

转写稿中的人名、公司名、产品名几乎必然出现 ASR 误写。完整方法论（权威级联、澄清协议、
热词维护规则）见 [references/transcript-normalization.md](references/transcript-normalization.md)，要点：

- **数据源**：[scripts/aliases.json](scripts/aliases.json)——`confirmed`（用户澄清过/热词已确认的
  correct + aliases 映射）与 `pending`（存疑待澄清，脚本只提醒不替换）。
- **执行**：`normalize.js` 把 confirmed 的别名全局替换为正确写法，范围是
  `recordings/*/transcript.md`、`biography/**/*.md`、`MEMORY.md`（按别名长度降序防嵌套误替换）：

```bash
node skills/story-transcribe/scripts/normalize.js --dry-run   # 预览
node skills/story-transcribe/scripts/normalize.js             # 执行
```

- **澄清后三件事缺一不可**：aliases.json 转正 → hotwords.txt 加热词（下次转写自动生效）→
  运行 normalize.js 清理存量。
- 传记正文中遇到未确认的疑似专名，先用保守写法，勿传播具体误写。
