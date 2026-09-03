---
name: story-listen
description: 聆听 —— 从 Mac 本地 iCloud 同步的苹果语音备忘录增量导出录音。读取语音备忘录私有 SQLite 数据库获取录音元数据，将每份录音导出为 ~/.storytelling/recordings/ 下的一个自包含目录（meta.json + recording.m4a）。当用户需要导入/同步/拉取苹果语音备忘录录音、或准备录音数据供后续转写时，使用此 skill。
---

# story-listen · 聆听

从 Mac 本地 iCloud 同步的苹果语音备忘录读取录音，增量导出到 `~/.storytelling/recordings/`。

## 前置条件

- **完整磁盘访问权限**：运行脚本的终端 App（Terminal / iTerm / VS Code 等）需在
  「系统设置 → 隐私与安全性 → 完整磁盘访问权限」中勾选。脚本在检测到权限不足时会自动打开该设置面板。
- 语音备忘录 App 至少打开过一次，iCloud 已完成同步（刚录的音若未同步完，本地只有占位文件，会被自动跳过）。

脚本零第三方依赖：使用 Node 24 内置的 `node:sqlite` 读数据库，音频转换用 macOS 自带 `afconvert`。

脚本组织（`scripts/`）：

- `list.js` / `export.js`：CLI 入口。
- `voice-memos.js`：苹果语音备忘录数据库访问（权限指引、只读打开、在库录音查询，Core Data 字段已转为含 `date`/`uuid` 的对象）。
- `storytelling.js`：各 story-* skill 共用的工作区工具（`~/.storytelling` 路径、settings 读取、批次日志、slug/时间格式化）。其他 skill 通过相对路径复用此模块。

## 产出结构

每份录音导出为一个独立目录，命名为 `<iCloud标题slug>-<YYYY-MM-DD-HHMM>`：

```
~/.storytelling/recordings/260901-日记-2026-09-01-2054/
├── meta.json        # uuid（iCloud ZUNIQUEID）、来源、标题、创建时间、时长、原始路径
└── recording.m4a    # 音频（Apple .qta 会自动转为标准 m4a/AAC）
```

后续 story-transcribe 产出的 `transcript.md` 也会写入同一目录。

**身份与更新同步**：每条录音以 iCloud UUID（`ZUNIQUEID`）为稳定身份，记录在 `meta.json` 的
`uuid` 字段。已导出录音的识别方式是扫描各目录的 `meta.json`（无独立状态文件）；重跑导出时若
iCloud 侧标题变化（目录名与预期不符），会自动重命名目录并更新 `meta.json`。已在语音备忘录中
删除的录音（数据库中 `ZEVICTIONDATE` 软删除标记）不会被导出。

**批次日志**：每次运行是一个批次，逐条动作（exported / renamed / updated / skipped）记录到
`~/.storytelling/log/listen/<批次时间>.json`，含批次开始/结束时间与汇总计数。

## 用法

```bash
# 列出语音备忘录中所有在库录音（按时间倒序），不导出
node skills/story-listen/scripts/list.js

# 增量导出所有新录音到 ~/.storytelling/recordings/，并同步改名等更新
node skills/story-listen/scripts/export.js

# 常用参数
#   --db-path=<path>   指定 CloudRecordings.db 路径（默认走系统标准位置）
#   --output=<dir>     指定导出目录（默认 ~/.storytelling/recordings/）
#   --all              忽略已导出目录，全部重新导出
# 数据根目录可用环境变量 STORYTELLING_HOME 覆盖（默认 ~/.storytelling）
```

## 工作流程（脚本内部）

1. 打开 `~/Library/Group Containers/group.com.apple.VoiceMemos.shared/Recordings/CloudRecordings.db`（只读）。
2. 查询 `ZCLOUDRECORDING` 表，排除 `ZEVICTIONDATE` 非空的已删除录音；Apple Core Data 时间戳（2001 纪元）加 `978307200` 转为 Unix 时间。
3. 扫描 `recordings/` 下已有目录的 `meta.json`，以 uuid（兜底 Z_PK）建立已导出索引。
4. 跳过 iCloud 占位文件（<10KB）。
5. 未导出的录音：创建 `<slug>-<时间戳>/` 目录并复制音频，`.qta` 容器经 `afconvert` 转为 `recording.m4a`，写入 `meta.json`（含 `uuid`）。
6. 已导出的录音：目录名与预期不符则重命名；回写 `meta.json` 同步标题/时长等更新。
7. 写入批次日志 `log/listen/<批次时间>.json`。
