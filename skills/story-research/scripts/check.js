#!/usr/bin/env node
'use strict';

// 研究前置检查：确保 ~/.storytelling/sources/notion 软链存在且指向有效的 Notion 本地导出，
// 缺失时自动创建。检索与挖掘由 agent 完成，脚本只做确定性的挂载保障。
// 用法: node check.js [--target=<notion导出目录>]   （输出 JSON 到 stdout）

const fs = require('fs');
const os = require('os');
const path = require('path');

const { paths, ensureDir } = require('../../story-listen/scripts/storytelling');

function countMarkdown(dir) {
  let n = 0;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (e.isDirectory()) stack.push(path.join(cur, e.name));
      else if (e.name.endsWith('.md')) n++;
    }
  }
  return n;
}

function main() {
  const arg = (process.argv.find((a) => a.startsWith('--target=')) || '').split('=').slice(1).join('=');
  const target = arg || path.join(os.homedir(), 'California', 'Wiki', 'notion');

  const link = path.join(paths.sources, 'notion');
  const actions = [];
  ensureDir(paths.sources);

  let stat = null;
  try {
    stat = fs.lstatSync(link);
  } catch {
    // 不存在
  }
  if (stat && !stat.isSymbolicLink()) {
    console.error(`sources/notion 已存在且不是软链，不做改动：${link}`);
    process.exit(1);
  }
  if (!stat) {
    if (!fs.existsSync(target)) {
      console.error(`目标目录不存在：${target}（可用 --target= 指定 Notion 本地导出路径）`);
      process.exit(1);
    }
    fs.symlinkSync(target, link, 'dir');
    actions.push('created');
  } else if (fs.existsSync(link)) {
    actions.push('ok');
  } else {
    // 坏链：删除后按 target 重建
    fs.rmSync(link);
    if (!fs.existsSync(target)) {
      console.error(`软链已失效且目标目录不存在：${target}（可用 --target= 指定）`);
      process.exit(1);
    }
    fs.symlinkSync(target, link, 'dir');
    actions.push(`relinked -> ${target}`);
  }

  const mdCount = fs.existsSync(link) ? countMarkdown(link) : 0;
  console.log(JSON.stringify({
    link,
    target: fs.existsSync(link) ? fs.realpathSync(link) : null,
    actions,
    markdown_files: mdCount,
    ready: mdCount > 0,
  }, null, 2));
}

main();
