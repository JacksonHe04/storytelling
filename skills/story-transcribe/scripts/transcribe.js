#!/usr/bin/env node
'use strict';

// 将 recordings/ 下尚未转写的录音批量转写为 transcript.md（纯文本，写入各录音目录）；
// 转写元数据（模型、热词数、时间等）并入该目录的 meta.json。
// 转写服务为豆包录音文件识别极速版（同步返回，base64 直传）；热词读自 ~/.storytelling/hotwords.txt。
// 每次运行是一个批次，逐条动作记录到 ~/.storytelling/log/transcribe/<批次时间>.json。
// 用法: node transcribe.js [--dir=<录音目录名>] [--force] [--limit=N]

const fs = require('fs');
const path = require('path');

const {
  paths,
  loadSettings,
  ensureDir,
  parseArgs,
  startBatch,
  finishBatch,
} = require('../../story-listen/scripts/storytelling');
const { loadHotwords, transcribe } = require('./doubao');

const options = parseArgs(process.argv);
const onlyDir = options.dir || null;
const force = options.force === 'true' || options.force === true;
const limit = options.limit ? Number(options.limit) : Infinity;

// 扫描待转写录音：有 meta.json 和音频、且没有 transcript.md（--force 时忽略后者）
function scanPending() {
  const pending = [];
  if (!fs.existsSync(paths.recordings)) return pending;

  for (const entry of fs.readdirSync(paths.recordings, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (onlyDir && entry.name !== onlyDir) continue;

    const dir = path.join(paths.recordings, entry.name);
    const metaPath = path.join(dir, 'meta.json');
    if (!fs.existsSync(metaPath)) continue;

    let meta;
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch {
      continue;
    }

    const audioFile = meta.audio_file || 'recording.m4a';
    if (!fs.existsSync(path.join(dir, audioFile))) continue;
    if (!force && fs.existsSync(path.join(dir, 'transcript.md'))) continue;

    pending.push({ dir: entry.name, dirPath: dir, meta, audioFile });
  }

  // 按录音时间正序处理（早的先转写）
  pending.sort((a, b) => (a.meta.created_at || '').localeCompare(b.meta.created_at || ''));
  return pending;
}

async function main() {
  const settings = loadSettings();
  const apiKey = settings.doubao?.api_key;
  const resourceId = settings.doubao?.asr_resource_id || undefined;
  const hotwords = loadHotwords(paths.hotwords);

  if (hotwords.length > 0) {
    console.log(`已加载热词 ${hotwords.length} 个（${paths.hotwords}）`);
  }

  const pending = scanPending();
  if (pending.length === 0) {
    console.log(onlyDir ? `目录 ${onlyDir} 无需转写。` : '没有待转写的录音（全部已有 transcript.md）。');
    return;
  }

  const todo = pending.slice(0, limit);
  console.log(`待转写 ${pending.length} 条，本次处理 ${todo.length} 条。\n`);

  const batch = startBatch('transcribe');
  const summary = { transcribed: 0, failed: 0, hotwords_count: hotwords.length };

  for (const item of todo) {
    const audioPath = path.join(item.dirPath, item.audioFile);
    try {
      const result = await transcribe(audioPath, {
        apiKey,
        resourceId,
        hotwords,
        format: path.extname(item.audioFile).slice(1) || 'm4a',
      });

      // transcript.md 只存纯文本；转写元数据并入 meta.json
      fs.writeFileSync(path.join(item.dirPath, 'transcript.md'), result.text.trim() + '\n', 'utf8');

      const metaPath = path.join(item.dirPath, 'meta.json');
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      meta.transcription = {
        provider: 'doubao',
        model: resourceId || 'volc.bigasr.auc_turbo',
        language: 'auto',
        ddc: true,
        hotwords_count: hotwords.length,
        transcribed_at: new Date().toISOString(),
        text_length: result.text.length,
        logid: result.logid,
      };
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf8');

      batch.entries.push({
        action: 'transcribed',
        uuid: item.meta.uuid,
        dir: item.dir,
        title: item.meta.title,
        duration_seconds: item.meta.duration_seconds,
        api_elapsed_ms: result.elapsedMs,
        text_length: result.text.length,
        logid: result.logid,
      });
      summary.transcribed++;
      console.log(`转写: ${item.dir}/transcript.md（${result.text.length} 字，API ${(result.elapsedMs / 1000).toFixed(1)}s）`);
    } catch (err) {
      batch.entries.push({
        action: 'failed',
        uuid: item.meta.uuid,
        dir: item.dir,
        title: item.meta.title,
        error: err.message.slice(0, 500),
      });
      summary.failed++;
      console.error(`失败: ${item.dir}: ${err.message}`);
    }
  }

  const logFile = finishBatch(batch, summary);
  console.log('');
  console.log(`完成: 成功 ${summary.transcribed} 条，失败 ${summary.failed} 条。`);
  console.log(`批次日志: ${logFile}`);
}

main().catch((err) => {
  console.error(`错误: ${err.message}`);
  process.exit(1);
});
