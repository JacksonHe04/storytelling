#!/usr/bin/env node
'use strict';

// 专名归一：把转写稿 / 传记 / MEMORY 中的 ASR 误写统一替换为确认写法。
// 数据源：同目录 aliases.json。confirmed 条目会被替换（按别名长度降序，防止嵌套误替换，
// 如先替换「谢玉萌」再替换「玉萌」）；pending 条目只提醒，须向用户澄清后转正。
// 替换范围：recordings/*/transcript.md、biography/**/*.md、MEMORY.md。meta.json 与 hotwords.txt 不动。
// 用法: node normalize.js [--dry-run]
// 每次运行写批次日志到 ~/.storytelling/log/transcribe/<批次时间>.json。

const fs = require('fs');
const path = require('path');

const {
  paths,
  parseArgs,
  startBatch,
  finishBatch,
} = require('../../story-listen/scripts/storytelling');

const options = parseArgs(process.argv);
const dryRun = options['dry-run'] === 'true' || options['dry-run'] === true;

const aliasData = JSON.parse(fs.readFileSync(path.join(__dirname, 'aliases.json'), 'utf8'));
const confirmed = aliasData.confirmed || [];
const pending = aliasData.pending || [];

// 别名按长度降序替换，避免短别名破坏长别名（谢玉萌 必须先于 玉萌）
const pairs = confirmed
  .flatMap(({ correct, aliases }) => (aliases || []).map((a) => ({ from: a, to: correct })))
  .sort((a, b) => b.from.length - a.from.length);

function listFiles() {
  const files = [];
  if (fs.existsSync(paths.recordings)) {
    for (const entry of fs.readdirSync(paths.recordings, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const t = path.join(paths.recordings, entry.name, 'transcript.md');
      if (fs.existsSync(t)) files.push(t);
    }
  }
  if (fs.existsSync(paths.biography)) {
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (entry.name.endsWith('.md')) files.push(p);
      }
    };
    walk(paths.biography);
  }
  const memory = path.join(paths.root, 'MEMORY.md');
  if (fs.existsSync(memory)) files.push(memory);
  return files;
}

const batch = startBatch('transcribe');
const summary = { changedFiles: 0, replacements: 0 };

for (const file of listFiles()) {
  const before = fs.readFileSync(file, 'utf8');
  let after = before;
  const applied = [];
  for (const { from, to } of pairs) {
    const count = after.split(from).length - 1;
    if (count > 0) {
      after = after.split(from).join(to);
      applied.push({ from, to, count });
      summary.replacements += count;
    }
  }
  if (applied.length === 0) continue;
  summary.changedFiles++;
  if (!dryRun) fs.writeFileSync(file, after, 'utf8');
  batch.entries.push({
    action: dryRun ? 'would_replace' : 'replaced',
    file: path.relative(paths.root, file),
    applied,
  });
  console.log(
    `${dryRun ? '[dry] 将替换' : '替换'}: ${path.relative(paths.root, file)} ` +
      `(${applied.map((a) => `${a.from}→${a.to}×${a.count}`).join(', ')})`
  );
}

if (pending.length > 0) {
  console.log('\n待澄清（未替换，请向用户确认后移入 confirmed）:');
  for (const p of pending) console.log(`  - ${p.suspect}: ${p.context || ''}`);
}

const logFile = finishBatch(batch, summary);
console.log('');
console.log(
  `完成: 变更 ${summary.changedFiles} 个文件、共 ${summary.replacements} 处` +
    `${dryRun ? '（dry-run，未写入）' : ''}`
);
console.log(`批次日志: ${logFile}`);
