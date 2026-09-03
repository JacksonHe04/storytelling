#!/usr/bin/env node
'use strict';

// 将语音备忘录中的录音增量导出到 ~/.storytelling/recordings/。
// 每份录音一个独立目录：<标题slug>-<YYYY-MM-DD-HHMM>/{meta.json, recording.m4a}，
// 后续 story-transcribe 产出的 transcript.md 也写入同一目录。
// 已导出的录音以 meta.json 中的 uuid 为身份识别（iCloud 改名后重跑会同步重命名目录）。
// 每次运行是一个批次，逐条动作记录到 ~/.storytelling/log/listen/<批次时间>.json。
// 用法: node export.js [--output=/path/to/dir] [--db-path=/path/to/CloudRecordings.db] [--all]

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
const {
  DEFAULT_DB_PATH,
  openDatabase,
  getRecordings,
} = require('./voice-memos');

const options = parseArgs(process.argv);
const dbPath = options['db-path'] || DEFAULT_DB_PATH;
const outputDir = options['output'] || paths.recordings;
const exportAll = options.all === 'true' || options.all === true;

ensureDir(outputDir);

// 扫描已导出的录音目录，以 uuid（iCloud 稳定身份）为主键、Z_PK 为兜底
function scanExisting() {
  const byUuid = new Map();
  const byId = new Map();
  if (!fs.existsSync(outputDir)) return { byUuid, byId };
  for (const entry of fs.readdirSync(outputDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const metaPath = path.join(outputDir, entry.name, 'meta.json');
    if (!fs.existsSync(metaPath)) continue;
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      const rec = { dir: entry.name, meta };
      if (meta.uuid) byUuid.set(meta.uuid, rec);
      if (meta.id != null) byId.set(String(meta.id), rec);
    } catch {
      // meta.json 损坏的目录跳过，不阻塞批次
    }
  }
  return { byUuid, byId };
}

// 较新的苹果录音使用 .qta 容器（QuickTime + AAC），ASR 服务不识别该扩展名。
// 用 macOS 自带 afconvert 转成标准 m4a，使录音目录里始终是下游可直接使用的格式。
function materializeAudio(srcPath, recDir, ext) {
  if (ext === '.qta') {
    const dest = path.join(recDir, 'recording.m4a');
    const result = spawnSync(
      'afconvert',
      [srcPath, dest, '-f', 'm4af', '-d', 'aac', '-b', '128000'],
      { stdio: ['ignore', 'ignore', 'pipe'] }
    );
    if (result.status !== 0) {
      throw new Error(`afconvert 转换失败: ${result.stderr?.toString() || result.error?.message}`);
    }
    return 'recording.m4a';
  }
  const audioFile = `recording${ext || '.m4a'}`;
  fs.copyFileSync(srcPath, path.join(recDir, audioFile));
  return audioFile;
}

function dirNameFor(row) {
  return `${slugify(row.title)}-${formatLocalTimestamp(row.date)}`;
}

const db = openDatabase(dbPath);
const batch = startBatch('listen');
const summary = { exported: 0, renamed: 0, updated: 0, skipped: 0 };

try {
  const { byUuid, byId } = exportAll ? { byUuid: new Map(), byId: new Map() } : scanExisting();
  // list 按倒序展示，导出按时间正序处理，保证文件顺序自然
  const rows = getRecordings(db).reverse();
  const recordingsDir = path.dirname(dbPath);

  for (const row of rows) {
    const pk = String(row.pk);
    const title = row.title || '未命名';
    const existing = (row.uuid && byUuid.get(row.uuid)) || byId.get(pk);

    if (existing) {
      const oldPath = path.join(outputDir, existing.dir);
      if (!fs.existsSync(oldPath)) continue; // 目录被用户手动删除，尊重之

      const expected = dirNameFor(row);
      let dir = existing.dir;

      if (expected !== existing.dir) {
        let target = expected;
        if (fs.existsSync(path.join(outputDir, target))) target = `${expected}-${pk}`;
        fs.renameSync(oldPath, path.join(outputDir, target));
        dir = target;
        batch.entries.push({ action: 'renamed', uuid: row.uuid, id: row.pk, title, from: existing.dir, to: target });
        summary.renamed++;
        console.log(`重命名: ${existing.dir} → ${target}`);
      }

      // 回写 meta.json：uuid、标题、时长等任何变化都同步，保留首次导出时间
      const metaPath = path.join(outputDir, dir, 'meta.json');
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      meta.uuid = row.uuid || meta.uuid || null;
      meta.title = row.title;
      meta.duration_seconds = row.duration ? Math.round(row.duration * 10) / 10 : meta.duration_seconds ?? null;
      meta.updated_at = new Date().toISOString();
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf8');

      if (expected === existing.dir) {
        batch.entries.push({ action: 'updated', uuid: row.uuid, id: row.pk, title, dir });
        summary.updated++;
      }
      continue;
    }

    const audioPath = path.join(recordingsDir, row.relPath);
    if (!fs.existsSync(audioPath)) {
      batch.entries.push({ action: 'skipped', reason: 'audio_missing', id: row.pk, title });
      summary.skipped++;
      console.warn(`跳过: 音频文件缺失 (${title})`);
      continue;
    }

    // iCloud 未同步完成时本地只有 3-4KB 的占位文件，不能用于转写
    const size = fs.statSync(audioPath).size;
    if (size < 10 * 1024) {
      batch.entries.push({ action: 'skipped', reason: 'icloud_stub', id: row.pk, title, size_bytes: size });
      summary.skipped++;
      console.warn(`跳过: iCloud 占位文件（仅 ${size}B），同步完成后再导出: ${title}`);
      continue;
    }

    let dirName = dirNameFor(row);
    if (fs.existsSync(path.join(outputDir, dirName))) dirName = `${dirName}-${pk}`;
    const recDir = path.join(outputDir, dirName);
    ensureDir(recDir);

    const ext = path.extname(row.relPath).toLowerCase();
    let audioFile;
    try {
      audioFile = materializeAudio(audioPath, recDir, ext);
    } catch (err) {
      fs.rmSync(recDir, { recursive: true, force: true });
      batch.entries.push({ action: 'skipped', reason: 'audio_failed', id: row.pk, title, detail: err.message });
      summary.skipped++;
      console.warn(`跳过: 音频处理失败 (${title}): ${err.message}`);
      continue;
    }

    const meta = {
      id: row.pk,
      uuid: row.uuid,
      source: 'apple-voice-memos',
      title: row.title,
      created_at: row.date.toISOString(),
      duration_seconds: row.duration ? Math.round(row.duration * 10) / 10 : null,
      original_path: audioPath,
      audio_file: audioFile,
      exported_at: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(recDir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');

    batch.entries.push({
      action: 'exported',
      uuid: row.uuid,
      id: row.pk,
      title,
      dir: dirName,
      duration_seconds: meta.duration_seconds,
    });
    summary.exported++;
    console.log(`导出: ${dirName}/ (${formatDuration(row.duration)})`);
  }

  const logFile = finishBatch(batch, summary);

  console.log('');
  console.log(
    `完成: 新导出 ${summary.exported} 条，重命名 ${summary.renamed} 条，更新 ${summary.updated} 条，跳过 ${summary.skipped} 条 → ${outputDir}`
  );
  console.log(`批次日志: ${logFile}`);
  if (summary.exported === 0 && summary.renamed === 0 && summary.updated === 0 && summary.skipped === 0) {
    console.log('没有录音需要处理。');
  }
} finally {
  db.close();
}
