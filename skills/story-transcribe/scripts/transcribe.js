#!/usr/bin/env node
'use strict';

// 将 recordings/ 下尚未转写的录音批量转写为 transcript.md（纯文本，写入各录音目录）；
// 转写元数据（模型、热词数、时间等）并入该目录的 meta.json。
// 两条路径：
// - 极速版（默认）：同步返回、base64 直传，限制 2 小时 / 100MB；
// - 标准版（异步）：文件超过 100MB 或时长超过 2 小时（或 --async 强制）时走 submit/query，
//   音频经 Supabase Storage 上传后以签名 URL 交给豆包拉取，转写完成即删除对象；
//   独有说话人分离（多人对话按「说话人N:」分段，单人退化为纯文本）。
// 每次运行是一个批次，逐条动作记录到 ~/.storytelling/log/transcribe/<批次时间>.json。
// 用法: node transcribe.js [--dir=<录音目录名>] [--force] [--limit=N] [--async]

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  paths,
  loadSettings,
  ensureDir,
  parseArgs,
  startBatch,
  finishBatch,
} = require('../../story-listen/scripts/storytelling');
const { loadHotwords, transcribe } = require('./doubao');
const { transcribeAsync } = require('./doubao-async');
const storage = require('./supabase-storage');

const options = parseArgs(process.argv);
const onlyDir = options.dir || null;
const force = options.force === 'true' || options.force === true;
const forceAsync = options.async === 'true' || options.async === true;
const limit = options.limit ? Number(options.limit) : Infinity;

// 极速版限制：2 小时 / 100MB
const FLASH_MAX_SIZE = 100 * 1024 * 1024;
const FLASH_MAX_DURATION = 2 * 3600;

// 上传前把音频转码为 16kHz 单声道 AAC（ASR 只需该规格）：
// 128kbps 立体声源可缩至约 1/4 体积，显著缩短上行时间（实测家宽上行仅 ~100-160KB/s）。
// 返回 { path, transcoded }；ffmpeg 不可用或转码失败时返回原文件路径。
function prepareUploadFile(audioPath, workPath) {
  const ffmpeg = spawnSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', audioPath,
    '-ac', '1', '-ar', '16000', '-c:a', 'aac', '-b:a', '32k',
    workPath,
  ], { encoding: 'utf8' });
  if (ffmpeg.error || ffmpeg.status !== 0 || !fs.existsSync(workPath)) {
    const detail = ffmpeg.error ? ffmpeg.error.message : (ffmpeg.stderr || '').trim().slice(0, 200);
    console.error(`警告: ffmpeg 转码失败（${detail}），按原文件上传`);
    return { path: audioPath, transcoded: false };
  }
  return { path: workPath, transcoded: true };
}

// 标准版（异步）配置与前置检查
function loadAsyncConfig(settings) {
  const supabase = settings.supabase || {};
  if (!supabase.url || !supabase.service_key) {
    return null;
  }
  return {
    url: supabase.url,
    serviceKey: supabase.service_key,
    bucket: supabase.recordings_bucket || 'recordings',
    proxy: supabase.proxy || null,
    resourceId: settings.doubao?.asr_async_resource_id || undefined,
  };
}

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
    const sizeBytes = fs.statSync(audioPath).size;
    const durationSeconds = item.meta.duration_seconds || 0;
    const needsAsync =
      forceAsync || sizeBytes > FLASH_MAX_SIZE || durationSeconds > FLASH_MAX_DURATION;
    const asyncConfig = needsAsync ? loadAsyncConfig(settings) : null;
    if (needsAsync && !asyncConfig) {
      batch.entries.push({
        action: 'failed',
        uuid: item.meta.uuid,
        dir: item.dir,
        title: item.meta.title,
        error: '该录音超出极速版限制（2h/100MB），需走标准版（异步），但 settings.json 缺少 supabase.url / supabase.service_key 配置',
      });
      summary.failed++;
      console.error(`失败: ${item.dir}: 超出极速版限制且未配置 Supabase（settings.json 的 supabase.url / supabase.service_key）`);
      continue;
    }

    try {
      let result;
      let metaExtra;
      if (asyncConfig) {
        // 标准版（异步）：转码 → 上传 → 签名 URL → submit/query → 删除对象
        const objectName = `${item.meta.uuid}.m4a`;
        const workPath = path.join(item.dirPath, `.upload-${item.meta.uuid}.m4a`);
        console.log(`异步转写（标准版）: ${item.dir}（${(sizeBytes / 1024 / 1024).toFixed(1)}MB）转码/上传中…`);
        const uploadFile = prepareUploadFile(audioPath, workPath);
        const uploadSizeMB = fs.statSync(uploadFile.path).size / 1024 / 1024;
        if (uploadFile.transcoded) {
          console.log(`已转码为 16kHz 单声道（${uploadSizeMB.toFixed(1)}MB）`);
        }
        try {
          await storage.uploadObject({
            url: asyncConfig.url,
            serviceKey: asyncConfig.serviceKey,
            bucket: asyncConfig.bucket,
            name: objectName,
            filePath: uploadFile.path,
            proxy: asyncConfig.proxy,
          });
          const audioUrl = await storage.createSignedUrl({
            url: asyncConfig.url,
            serviceKey: asyncConfig.serviceKey,
            bucket: asyncConfig.bucket,
            name: objectName,
          });
          result = await transcribeAsync(audioUrl, {
            apiKey,
            resourceId: asyncConfig.resourceId,
            hotwords,
            format: 'm4a',
          });
          metaExtra = {
            task_id: result.taskId,
            speakers: result.speakers,
            speaker_used: result.speakerUsed,
            ...(uploadFile.transcoded ? { upload_transcoded: true } : {}),
          };
        } finally {
          // 转写完成或失败都删除对象与临时文件，不占额度
          await storage
            .deleteObject({
              url: asyncConfig.url,
              serviceKey: asyncConfig.serviceKey,
              bucket: asyncConfig.bucket,
              name: objectName,
            })
            .catch((err) => console.error(`警告: 删除存储对象失败: ${err.message}`));
          if (fs.existsSync(workPath)) fs.unlinkSync(workPath);
        }
      } else {
        result = await transcribe(audioPath, {
          apiKey,
          resourceId,
          hotwords,
          format: path.extname(item.audioFile).slice(1) || 'm4a',
        });
      }

      // transcript.md 只存纯文本；转写元数据并入 meta.json
      fs.writeFileSync(path.join(item.dirPath, 'transcript.md'), result.text.trim() + '\n', 'utf8');

      const metaPath = path.join(item.dirPath, 'meta.json');
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      meta.transcription = {
        provider: asyncConfig ? 'doubao-async' : 'doubao',
        model: asyncConfig ? asyncConfig.resourceId || 'volc.bigasr.auc' : resourceId || 'volc.bigasr.auc_turbo',
        language: 'auto',
        ddc: true,
        hotwords_count: hotwords.length,
        transcribed_at: new Date().toISOString(),
        text_length: result.text.length,
        logid: result.logid,
        ...(metaExtra || {}),
      };
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf8');

      batch.entries.push({
        action: 'transcribed',
        uuid: item.meta.uuid,
        dir: item.dir,
        title: item.meta.title,
        duration_seconds: item.meta.duration_seconds,
        size_bytes: sizeBytes,
        provider: asyncConfig ? 'doubao-async' : 'doubao',
        api_elapsed_ms: result.elapsedMs,
        text_length: result.text.length,
        logid: result.logid,
        ...(metaExtra || {}),
      });
      summary.transcribed++;
      const speakersInfo = result.speakers ? `，${result.speakers} 位说话人` : '';
      console.log(
        `转写: ${item.dir}/transcript.md（${result.text.length} 字${speakersInfo}，API ${(result.elapsedMs / 1000).toFixed(1)}s，${asyncConfig ? '标准版异步' : '极速版'}）`
      );
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
