'use strict';

// story-* 各 skill 脚本共用的工作区工具：数据目录、settings、批次日志与文本格式化。
// 归 story-listen 所有，其他 skill 通过相对路径复用（如 ../../story-listen/scripts/storytelling）。
// 数据根目录默认为 ~/.storytelling，可用环境变量 STORYTELLING_HOME 覆盖。

const fs = require('fs');
const path = require('path');
const os = require('os');

const paths = {
  get root() { return storytellingHome(); },
  get settings() { return path.join(storytellingHome(), 'settings.json'); },
  get hotwords() { return path.join(storytellingHome(), 'hotwords.txt'); },
  get recordings() { return path.join(storytellingHome(), 'recordings'); },
  get interviews() { return path.join(storytellingHome(), 'interviews'); },
  get memories() { return path.join(storytellingHome(), 'memories'); },
  get biography() { return path.join(storytellingHome(), 'biography'); },
  logDir(skill) { return path.join(storytellingHome(), 'log', skill); },
};

function storytellingHome() {
  return process.env.STORYTELLING_HOME || path.join(os.homedir(), '.storytelling');
}

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(paths.settings, 'utf8'));
  } catch {
    return {};
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function parseArgs(argv) {
  const options = {};
  for (const arg of argv.slice(2)) {
    const eq = arg.match(/^--([^=]+)=(.*)$/);
    if (eq) {
      options[eq[1]] = eq[2];
    } else {
      const flag = arg.match(/^--([\w-]+)$/);
      if (flag) options[flag[1]] = true;
    }
  }
  return options;
}

// 生成文件名安全的 slug；保留中文等非 ASCII 字符，仅去除路径不安全字符、空白转连字符
function slugify(s) {
  return (s || 'recording')
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'recording';
}

function pad(n) { return String(n).padStart(2, '0'); }

// 本地时区格式 YYYY-MM-DD-HHMM
function formatLocalTimestamp(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-` +
    `${pad(date.getHours())}${pad(date.getMinutes())}`;
}

// 批次日志用，精确到秒：YYYY-MM-DD-HHMMSS
function formatLocalTimestampSeconds(date) {
  return `${formatLocalTimestamp(date)}${pad(date.getSeconds())}`;
}

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '-';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m${pad(s)}s` : `${s}s`;
}

// 批次日志：每次脚本运行是一个批次，落盘到 log/<skill>/<批次时间>.json；
// 批次内对每个文件的动作（导出/更新/重命名/跳过）逐条记录在 entries 中。
function startBatch(skill) {
  return {
    batch_id: formatLocalTimestampSeconds(new Date()),
    skill,
    started_at: new Date().toISOString(),
    entries: [],
  };
}

function finishBatch(batch, summary) {
  batch.finished_at = new Date().toISOString();
  batch.summary = summary;
  const dir = paths.logDir(batch.skill);
  ensureDir(dir);
  const file = path.join(dir, `${batch.batch_id}.json`);
  fs.writeFileSync(file, JSON.stringify(batch, null, 2) + '\n', 'utf8');
  return file;
}

module.exports = {
  paths,
  loadSettings,
  ensureDir,
  parseArgs,
  slugify,
  formatLocalTimestamp,
  formatLocalTimestampSeconds,
  formatDuration,
  startBatch,
  finishBatch,
};
