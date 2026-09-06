#!/usr/bin/env node
'use strict';

// 将飞书妙记导出的素材组装为 ~/.storytelling/recordings/ 标准录音目录。
// 素材由 agent 通过 lark-cli 预先下载到暂存区（默认 ./minutes）：
//   minutes/<minute_token>/recording.bin   音频（妙记媒体文件，MP4/M4A 容器）
//   minutes/<minute_token>/transcript.txt  逐字稿（vc +notes 导出，已转写，无需再调 ASR）
//   minutes/<minute_token>/minute.json     妙记元数据（minutes minutes get 输出，可选）
// 组装结果与 story-listen（苹果语音备忘录）格式完全一致：
//   <标题slug>-<YYYY-MM-DD-HHMM>/{meta.json, recording.m4a, transcript.md}
// 录音身份 uuid 使用 minute_token（飞书侧稳定标识），source 标记为 feishu-minutes。
// 已导入的录音（uuid 相同）默认跳过，--force 可重新导入。
// 用法: node import-minutes.js [--staging=./minutes] [--output=/path] [--force] [--tokens=t1,t2]

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  paths,
  ensureDir,
  parseArgs,
  slugify,
  formatLocalTimestamp,
  formatDuration,
  startBatch,
  finishBatch,
} = require('./storytelling');

const options = parseArgs(process.argv);
const stagingDir = options.staging || 'minutes';
const outputDir = options.output || paths.recordings;
const force = options.force === 'true' || options.force === true;
const tokenFilter = options.tokens
  ? new Set(String(options.tokens).split(',').map((t) => t.trim()).filter(Boolean))
  : null;

// 逐字稿首行：`2026-06-26 11:30:51 CST|23min 31s`（录制开始时间 | 时长）
function parseHeader(line) {
  const m = (line || '').match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+CST\|(.+)$/);
  if (!m) return null;
  const date = new Date(`${m[1]}+08:00`);
  if (Number.isNaN(date.getTime())) return null;
  let seconds = 0;
  const h = m[2].match(/(\d+)\s*h/);
  const min = m[2].match(/(\d+)\s*min/);
  const s = m[2].match(/(\d+)\s*s/);
  if (h) seconds += Number(h[1]) * 3600;
  if (min) seconds += Number(min[1]) * 60;
  if (s) seconds += Number(s[1]);
  return { date, durationSeconds: seconds };
}

// 逐字稿正文 → transcript.md。块格式为 `说话人 时间戳` 行 + 内容行（可能多行）。
// 单人独白输出纯文本段落（与 story-transcribe 产物一致）；多人对话保留「说话人：」前缀。
function transcriptToMarkdown(text) {
  const lines = text.split(/\r?\n/);
  // 跳过首行元信息与 Keywords 段
  let i = 0;
  if (parseHeader(lines[0])) i = 1;
  if (/^\s*Keywords:/i.test(lines[i] || '')) {
    i += 1;
    while (i < lines.length && lines[i].trim() !== '') i += 1;
  }
  const blocks = [];
  let current = null;
  const headRe = /^(.+?)\s+(\d{2}:\d{2}:\d{2}\.\d{3})\s*$/;
  for (; i < lines.length; i++) {
    const line = lines[i];
    const head = line.match(headRe);
    if (head) {
      if (current) blocks.push(current);
      current = { speaker: head[1].trim(), content: [] };
    } else if (current && line.trim() !== '') {
      current.content.push(line.trim());
    }
  }
  if (current) blocks.push(current);
  if (blocks.length === 0) return '';

  const speakers = new Set(blocks.map((b) => b.speaker));
  const mono = speakers.size <= 1;
  const paragraphs = blocks
    .map((b) => (mono ? b.content.join('') : `${b.speaker}：${b.content.join('')}`))
    .filter((p) => p.trim() !== '');
  return paragraphs.join('\n\n') + '\n';
}

// 妙记媒体文件格式不一（MP3 / MP4 容器内 AAC 或 Opus）。能直用的保持原样（MP3 → recording.mp3，
// AAC → recording.m4a），只有 afconvert/ffmpeg 都无法直接落地的（如 Opus）才转码为 m4a/AAC。
function detectFormat(srcPath) {
  const r = spawnSync('afinfo', [srcPath], { encoding: 'utf8' });
  if (r.status === 0) {
    const m = r.stdout.match(/Data format:\s*(.+)/);
    if (m) {
      if (/\.mp3/i.test(m[1])) return 'mp3';
      if (/opus/i.test(m[1])) return 'opus';
      if (/aac/i.test(m[1])) return 'aac';
    }
  }
  return 'unknown';
}

function materializeAudio(srcPath, recDir) {
  const format = detectFormat(srcPath);
  if (format === 'mp3') {
    fs.copyFileSync(srcPath, path.join(recDir, 'recording.mp3'));
    return 'recording.mp3';
  }
  if (format === 'aac') {
    // 仅含单条 AAC 音轨的 mp4/m4a 容器，按 m4a 直接落地即可
    fs.copyFileSync(srcPath, path.join(recDir, 'recording.m4a'));
    return 'recording.m4a';
  }
  const dest = path.join(recDir, 'recording.m4a');
  const ffmpeg = spawnSync(
    'ffmpeg',
    ['-y', '-i', srcPath, '-vn', '-c:a', 'aac', '-b:a', '128k', dest],
    { stdio: ['ignore', 'ignore', 'pipe'] }
  );
  if (ffmpeg.status === 0 && fs.existsSync(dest)) return 'recording.m4a';
  throw new Error(`音频转换失败 (format=${format}): ${ffmpeg.stderr?.toString().split('\n').slice(-3).join('; ') || 'unknown error'}`);
}

function scanExistingUuids() {
  const uuids = new Set();
  if (!fs.existsSync(outputDir)) return uuids;
  for (const entry of fs.readdirSync(outputDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const metaPath = path.join(outputDir, entry.name, 'meta.json');
    if (!fs.existsSync(metaPath)) continue;
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      if (meta.uuid) uuids.add(meta.uuid);
    } catch {
      // meta.json 损坏的目录跳过
    }
  }
  return uuids;
}

ensureDir(outputDir);
const batch = startBatch('listen');
const summary = { imported: 0, skipped: 0, failed: 0 };

const existing = scanExistingUuids();
const stagingEntries = fs.existsSync(stagingDir)
  ? fs.readdirSync(stagingDir, { withFileTypes: true }).filter((e) => e.isDirectory())
  : [];

for (const entry of stagingEntries) {
  const token = entry.name;
  if (tokenFilter && !tokenFilter.has(token)) continue;
  const srcDir = path.join(stagingDir, token);
  const transcriptPath = path.join(srcDir, 'transcript.txt');
  if (!fs.existsSync(transcriptPath)) {
    batch.entries.push({ action: 'skipped', reason: 'transcript_missing', token });
    summary.skipped++;
    continue;
  }
  if (existing.has(token) && !force) {
    batch.entries.push({ action: 'skipped', reason: 'already_imported', token });
    summary.skipped++;
    console.log(`跳过: 已导入 (${token})`);
    continue;
  }

  let recDir = null;
  try {
    const raw = fs.readFileSync(transcriptPath, 'utf8');
    const header = parseHeader(raw.split(/\r?\n/)[0]);
    if (!header) throw new Error('transcript.txt 首行缺少开始时间/时长元信息');

    let title = token;
    let url = null;
    const minuteJsonPath = path.join(srcDir, 'minute.json');
    if (fs.existsSync(minuteJsonPath)) {
      try {
        const minute = JSON.parse(fs.readFileSync(minuteJsonPath, 'utf8')).data?.minute || {};
        if (minute.title) title = minute.title;
        if (minute.url) url = minute.url;
      } catch {
        // minute.json 损坏时退回 token 作标题
      }
    }

    const markdown = transcriptToMarkdown(raw);
    if (!markdown.trim()) throw new Error('逐字稿解析结果为空');

    const audioSrc = fs.existsSync(path.join(srcDir, 'recording.bin'))
      ? path.join(srcDir, 'recording.bin')
      : null;
    if (!audioSrc) throw new Error('recording.bin 不存在');

    let dirName = `${slugify(title)}-${formatLocalTimestamp(header.date)}`;
    if (fs.existsSync(path.join(outputDir, dirName))) dirName = `${dirName}-${token}`;
    recDir = path.join(outputDir, dirName);
    ensureDir(recDir);

    const audioFile = materializeAudio(audioSrc, recDir);
    fs.writeFileSync(path.join(recDir, 'transcript.md'), markdown, 'utf8');

    const meta = {
      uuid: token,
      source: 'feishu-minutes',
      title,
      created_at: header.date.toISOString(),
      duration_seconds: header.durationSeconds,
      url,
      audio_file: audioFile,
      transcription: {
        provider: 'feishu-minutes',
        language: 'auto',
        text_length: markdown.trim().length,
        imported_at: new Date().toISOString(),
      },
      exported_at: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(recDir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');

    batch.entries.push({
      action: 'imported',
      uuid: token,
      title,
      dir: dirName,
      duration_seconds: header.durationSeconds,
      text_length: meta.transcription.text_length,
    });
    summary.imported++;
    console.log(`导入: ${dirName}/ (${formatDuration(header.durationSeconds)}, ${meta.transcription.text_length} 字)`);
  } catch (err) {
    fs.rmSync(recDir, { recursive: true, force: true });
    batch.entries.push({ action: 'failed', token, detail: err.message });
    summary.failed++;
    console.warn(`失败: ${token}: ${err.message}`);
  }
}

const logFile = finishBatch(batch, summary);
console.log('');
console.log(`完成: 导入 ${summary.imported} 条，跳过 ${summary.skipped} 条，失败 ${summary.failed} 条 → ${outputDir}`);
console.log(`批次日志: ${logFile}`);
