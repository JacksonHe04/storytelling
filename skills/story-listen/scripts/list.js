#!/usr/bin/env node
'use strict';

// 列出 Mac 本地语音备忘录中的所有在库录音（已删除的软删除记录自动排除）。
// 用法: node list.js [--db-path=/path/to/CloudRecordings.db]

const {
  parseArgs,
  formatLocalTimestamp,
  formatDuration,
} = require('./storytelling');
const {
  DEFAULT_DB_PATH,
  openDatabase,
  getRecordings,
} = require('./voice-memos');

const options = parseArgs(process.argv);
const dbPath = options['db-path'] || DEFAULT_DB_PATH;

const db = openDatabase(dbPath);

try {
  const rows = getRecordings(db);

  if (rows.length === 0) {
    console.log('未找到任何录音。');
    process.exit(0);
  }

  console.log(`共 ${rows.length} 条录音（按时间倒序）:\n`);
  console.log('序号  日期(本地)          时长     标题');
  console.log('-'.repeat(60));

  rows.forEach((row, i) => {
    const num = String(i + 1).padStart(3, ' ');
    console.log(
      `${num}  ${formatLocalTimestamp(row.date)}  ${formatDuration(row.duration).padStart(7, ' ')}   ${row.title || '未命名'}`
    );
  });

  console.log('\n提示: 运行 export.js 可将新录音导出到 ~/.storytelling/recordings/');
} finally {
  db.close();
}
