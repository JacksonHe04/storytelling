---
name: story-listen
description: 聆听 —— 录音导入。两个来源：① 从 Mac 本地 iCloud 同步的苹果语音备忘录增量导出（读私有 SQLite 数据库）；② 从飞书妙记导入已转写的录音（lark-cli 下载媒体与逐字稿后组装）。统一产出为 ~/.storytelling/recordings/ 下的自包含目录（meta.json + 音频 + 可选 transcript.md）。当用户需要导入/同步/拉取苹果语音备忘录或飞书妙记的录音、或准备录音数据供后续转写/撰写时，使用此 skill。
---

# story-listen · 聆听

录音导入有两个来源，产出格式完全一致：

1. **苹果语音备忘录**（默认）：从 Mac 本地 iCloud 同步的语音备忘录增量导出，音频需再经 story-transcribe 转写。
2. **飞书妙记**：导入妙记里已转写过的录音，逐字稿随导入直接落地为 `transcript.md`，**无需再调 story-transcribe**。

## 前置条件

- **完整磁盘访问权限**（仅苹果来源需要）：运行脚本的终端 App（Terminal / iTerm / VS Code 等）需在
  「系统设置 → 隐私与安全性 → 完整磁盘访问权限」中勾选。脚本在检测到权限不足时会自动打开该设置面板。
- 语音备忘录 App 至少打开过一次，iCloud 已完成同步（刚录的音若未同步完，本地只有占位文件，会被自动跳过）。
- **飞书来源需要**：lark-cli 已配置且 user 身份已授权（见下文「飞书妙记导入」）。

脚本零第三方依赖：使用 Node 24 内置的 `node:sqlite` 读数据库，音频转换用 macOS 自带 `afconvert`；
飞书来源的 Opus 音频转码需要 `ffmpeg`（仅当出现 Opus 编码时才会调用，MP3/AAC 直接原样落地）。

脚本组织（`scripts/`）：

- `list.js` / `export.js`：苹果来源的 CLI 入口。
- `import-minutes.js`：飞书妙记来源的组装入口。
- `voice-memos.js`：苹果语音备忘录数据库访问（权限指引、只读打开、在库录音查询，Core Data 字段已转为含 `date`/`uuid` 的对象）。
- `storytelling.js`：各 story-* skill 共用的工作区工具（`~/.storytelling` 路径、settings 读取、批次日志、slug/时间格式化）。其他 skill 通过相对路径复用此模块。

## 产出结构

每份录音导出为一个独立目录，命名为 `<标题slug>-<YYYY-MM-DD-HHMM>`：

```
~/.storytelling/recordings/260901-日记-2026-09-01-2054/
├── meta.json        # uuid（苹果=iCloud ZUNIQUEID，飞书=minute_token）、来源、标题、创建时间、时长
├── recording.m4a    # 音频（Apple .qta 转为标准 m4a/AAC；飞书 MP3 原样为 recording.mp3）
└── transcript.md    # 转写文本（story-transcribe 产出，或飞书妙记导入时直接落地）
```

**身份与更新同步**：每条录音以 `meta.json` 的 `uuid` 为稳定身份（苹果=iCloud ZUNIQUEID，
飞书=minute_token）。已导出录音的识别方式是扫描各目录的 `meta.json`（无独立状态文件）；重跑导出时若
iCloud 侧标题变化（目录名与预期不符），会自动重命名目录并更新 `meta.json`。已在语音备忘录中
删除的录音（数据库中 `ZEVICTIONDATE` 软删除标记）不会被导出。

**批次日志**：每次运行是一个批次，逐条动作（exported / imported / renamed / updated / skipped）记录到
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

## 飞书妙记导入

妙记侧录音（上传的音频或会议录制）**已自带转写**，导入时逐字稿直接落地为 `transcript.md`
（meta.json 的 `transcription.provider` 标记为 `feishu-minutes`），story-transcribe 会因
`transcript.md` 已存在而自动跳过，不重复调 ASR。

导入分两步：lark-cli 交互（agent 执行，处理授权/分页/错误）+ 组装脚本（确定性，零 lark 依赖）。

**授权**（首次需要，split-flow）：

```bash
lark-cli auth login --scope "minutes:minutes.search:read,minutes:minutes:readonly,minutes:minutes.artifacts:read,minutes:minutes.transcript:export,minutes:minutes.media:export" --no-wait --json
# 引导用户完成授权后：lark-cli auth login --device-code <device_code>
```

**第一步：下载素材到暂存区**（在仓库根目录执行，lark-cli 只接受相对路径）：

```bash
# 1. 定位妙记：按时间范围/所有者搜索（范围最长 1 个月），从结果中挑出目标 token
lark-cli minutes +search --owner-ids me --start 2026-06-25 --end 2026-07-09 --format json

# 2. 下载音频。注意：媒体下载域名含 "internal-api"，lark-cli 的 SSRF 防护会拦截
#    直接下载，需先取 url-only 再用 curl 下载（链接有效期 1 天）
lark-cli minutes +download --minute-tokens <token> --url-only --format json
curl -sL -o minutes/<token>/recording.bin "<download_url>"

# 3. 下载逐字稿（落到 minutes/<token>/transcript.txt）与元数据
lark-cli vc +notes --minute-tokens <token> --format json
lark-cli minutes minutes get --params '{"minute_token": "<token>"}' --format json > minutes/<token>/minute.json
```

**第二步：组装**（脚本只负责确定性转换，详见 `scripts/import-minutes.js` 头注释）：

```bash
node skills/story-listen/scripts/import-minutes.js --staging=minutes

# 常用参数
#   --staging=<dir>     暂存区目录（默认 ./minutes，布局 minutes/<minute_token>/）
#   --tokens=t1,t2      只导入指定 token（默认全部含 transcript.txt 的子目录）
#   --force             已导入（uuid 相同）也重新导入
#   --output=<dir>      指定导出目录（默认 ~/.storytelling/recordings/）
```

脚本内部：解析 transcript.txt 首行（`开始时间 CST|时长`）得到 created_at/duration；逐字稿转为
纯文本段落（单人独白去掉说话人前缀，多人对话保留「说话人：」）；音频用 `afinfo` 探测编码——
MP3 原样落地为 `recording.mp3`，AAC 原样落地为 `recording.m4a`，Opus（afconvert 不支持）经
ffmpeg 转为 `recording.m4a`；失败时清理半成品目录，不阻塞批次。已导入（uuid 相同）默认跳过。
