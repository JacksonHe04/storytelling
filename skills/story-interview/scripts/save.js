#!/usr/bin/env node
'use strict';

// 访谈产物落盘：把 agent 整理好的访谈内容写入 interviews/，生成 uuid 与 frontmatter，并记批次日志。
// 两种模式：
//   offline     离线访谈录（问题清单），产出 interviews/<日期>.md
//   interactive 交互访谈记录（问答对），产出 interviews/<日期>-访谈.md
// 输入经 JSON 文件或 stdin 传入；确定性组装由本脚本完成，问题设计与口水词清理由 agent 完成。
//
// 用法:
//   node save.js --mode=offline --input=questions.json [--date=YYYY-MM-DD]
//   node save.js --mode=interactive --input=qa.json [--date=YYYY-MM-DD] [--minutes=25]
//
// 输入 JSON 格式：
//   offline     { "questions": ["...", ...] }
//   interactive { "exchanges": [{ "q": "agent 的问题", "a": "用户原话（已去口水词）" }, ...] }

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const {
  paths,
  ensureDir,
  parseArgs,
  startBatch,
  finishBatch,
} = require('../../story-listen/scripts/storytelling');

function readInput(file) {
  const raw = file && file !== '-'
    ? fs.readFileSync(file, 'utf8')
    : fs.readFileSync(0, 'utf8');
  const data = JSON.parse(raw);
  if (typeof data !== 'object' || data === null) {
    throw new Error('输入 JSON 必须是对象');
  }
  return data;
}

function main() {
  const options = parseArgs(process.argv);
  const mode = options.mode;
  if (mode !== 'offline' && mode !== 'interactive') {
    console.error('用法: node save.js --mode=offline|interactive --input=<json文件|-> [--date=YYYY-MM-DD] [--minutes=N]');
    process.exit(1);
  }

  const data = readInput(options.input);
  const date = options.date || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.error('--date 需要 YYYY-MM-DD 格式');
    process.exit(1);
  }

  const batch = startBatch('interview');
  let body;
  if (mode === 'offline') {
    const questions = data.questions;
    if (!Array.isArray(questions) || questions.length === 0) {
      console.error('offline 模式需要 questions 非空数组');
      process.exit(1);
    }
    body = questions.map((q, i) => `${i + 1}. ${q}`).join('\n\n');
  } else {
    const exchanges = data.exchanges;
    if (!Array.isArray(exchanges) || exchanges.length === 0) {
      console.error('interactive 模式需要 exchanges 非空数组');
      process.exit(1);
    }
    body = exchanges
      .map((x, i) => `### 问答 ${i + 1}\n\n**问**：${x.q}\n\n${String(x.a || '').trim()}`)
      .join('\n\n');
  }

  const uuid = crypto.randomUUID();
  const frontmatter = [
    '---',
    'type: interview',
    `mode: ${mode}`,
    `uuid: ${uuid}`,
    `created_at: ${new Date().toISOString()}`,
  ];
  if (mode === 'interactive' && options.minutes) {
    frontmatter.push(`duration_minutes: ${Number(options.minutes) || 0}`);
  }
  frontmatter.push('---');

  const fileName = mode === 'offline' ? `${date}.md` : `${date}-访谈.md`;
  const file = path.join(paths.interviews, fileName);
  ensureDir(paths.interviews);
  if (fs.existsSync(file)) {
    console.error(`已存在同名访谈文件，不覆盖：${file}`);
    process.exit(1);
  }
  fs.writeFileSync(file, `${frontmatter.join('\n')}\n\n${body}\n`, 'utf8');
  batch.entries.push({ action: 'created', path: file, mode });

  const logFile = finishBatch(batch, { created: 1, mode, date });
  console.log(JSON.stringify({ file, mode, uuid, log: logFile }, null, 2));
}

main();
