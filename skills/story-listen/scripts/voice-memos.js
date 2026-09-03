'use strict';

// 苹果语音备忘录（Voice Memos）本地数据库访问。
// Apple 没有公开 API：录音元数据保存在 iCloud 同步容器内的私有 Core Data SQLite 中，
// 本模块只读访问该库，并把 Core Data 字段转换为直接可用的录音对象。

// Node 24 的 node:sqlite 仍标记为实验性；先移除默认警告处理器，仅吞掉 SQLite 实验警告。
process.removeAllListeners('warning');
process.on('warning', (w) => {
  if (w.name === 'ExperimentalWarning' && /sqlite/i.test(w.message)) return;
  console.error(w.stack || `${w.name}: ${w.message}`);
});

const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

// Apple Core Data 时间戳以 2001-01-01 UTC 为纪元，转换为 Unix 时间戳需加此偏移
const APPLE_EPOCH_OFFSET = 978307200;

const DEFAULT_DB_PATH = path.join(
  os.homedir(),
  'Library/Group Containers/group.com.apple.VoiceMemos.shared/Recordings/CloudRecordings.db'
);

function permissionGuidance() {
  console.error('错误: 没有权限读取语音备忘录数据库。');
  console.error('');
  console.error('需要为你运行此脚本的终端 App（Terminal / iTerm / VS Code 等）开启「完整磁盘访问权限」：');
  console.error('  系统设置 → 隐私与安全性 → 完整磁盘访问权限 → 添加并勾选你的终端 App');
  console.error('授权后完全重启终端 App，再重新运行。');
  console.error('');
  console.error('正在为你打开系统设置面板…');
  exec('open "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles"', () => {});
  process.exit(2);
}

function openDatabase(dbPath = DEFAULT_DB_PATH) {
  if (!fs.existsSync(dbPath)) {
    console.error(`错误: 语音备忘录数据库不存在: ${dbPath}`);
    console.error('请确认语音备忘录 App 至少打开过一次，且 iCloud 已完成同步。');
    process.exit(1);
  }

  // node:sqlite 会把权限错误包装成通用的 "unable to open database file"，
  // 这里先用 fs 探测，拿到真实的 EPERM/EACCES 以给出准确指引。
  try {
    const fd = fs.openSync(dbPath, 'r');
    fs.closeSync(fd);
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'EACCES') permissionGuidance();
    console.error(`错误: 无法读取数据库文件: ${err.message}`);
    process.exit(1);
  }

  const { DatabaseSync } = require('node:sqlite');
  try {
    return new DatabaseSync(dbPath, { readOnly: true });
  } catch (err) {
    if (/unable to open|permission|operation not permitted/i.test(err.message)) permissionGuidance();
    console.error(`错误: 无法打开数据库: ${err.message}`);
    process.exit(1);
  }
}

// 返回在库录音列表（按录音时间倒序），字段已转换为直接可用形式：
//   pk, uuid, opt, title, relPath（相对 Recordings 目录）, duration（秒）, date（Date 对象）
// ZEVICTIONDATE 非空表示录音已被用户删除（本地保留行作为 iCloud 同步墓碑），直接排除。
// ZUNIQUEID 为 iCloud 跨设备稳定 UUID；Z_OPT 为 Core Data 行版本号，改名/编辑后自增。
function getRecordings(db) {
  const rows = db.prepare(`
    SELECT
      Z_PK,
      ZUNIQUEID,
      Z_OPT,
      COALESCE(ZCUSTOMLABELFORSORTING, ZENCRYPTEDTITLE) AS title,
      ZPATH,
      ZDURATION,
      ZDATE
    FROM ZCLOUDRECORDING
    WHERE ZPATH IS NOT NULL
      AND ZEVICTIONDATE IS NULL
    ORDER BY ZDATE DESC
  `).all();

  return rows.map((r) => ({
    pk: r.Z_PK,
    uuid: r.ZUNIQUEID || null,
    opt: r.Z_OPT,
    title: r.title ? r.title.trim() : null,
    relPath: r.ZPATH,
    duration: r.ZDURATION,
    date: new Date((r.ZDATE + APPLE_EPOCH_OFFSET) * 1000),
  }));
}

module.exports = {
  DEFAULT_DB_PATH,
  openDatabase,
  getRecordings,
};
