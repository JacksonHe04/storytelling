#!/usr/bin/env node
'use strict';

// 撰写规划：扫描所有已转写录音，对照 biography 各小节 frontmatter 的 sources（uuid），
// 算出哪些月份有尚未写入传记的录音，按年月分组输出工作清单。
// 小节 sources 的并集即「已入传」状态，目录本身即状态，无需额外 state 文件。
// 用法: node plan.js   （输出 JSON 到 stdout）

const fs = require('fs');
const path = require('path');

const { paths } = require('../../story-listen/scripts/storytelling');

// 解析小节 Markdown 的 YAML frontmatter（只取 story-write 需要的字段）
function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fm = {};
  const lines = m[1].split('\n');
  let inSources = false;
  for (const line of lines) {
    if (/^sources\s*:/.test(line)) {
      fm.sources = [];
      inSources = true;
      continue;
    }
    if (inSources) {
      const s = line.match(/^\s+-\s+(.+?)\s*$/);
      if (s) {
        fm.sources.push(s[1].replace(/^["']|["']$/g, ''));
        continue;
      }
      inSources = false;
    }
    const kv = line.match(/^(\w+)\s*:\s*(.*)$/);
    if (kv) {
      let v = kv[2].trim().replace(/^["']|["']$/g, '');
      fm[kv[1]] = v;
    }
  }
  return fm;
}

function yearMonth(isoDate) {
  const d = new Date(isoDate);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function main() {
  // 收集所有已转写录音
  const recordings = [];
  if (fs.existsSync(paths.recordings)) {
    for (const entry of fs.readdirSync(paths.recordings, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(paths.recordings, entry.name);
      const metaPath = path.join(dir, 'meta.json');
      const transcriptPath = path.join(dir, 'transcript.md');
      if (!fs.existsSync(metaPath) || !fs.existsSync(transcriptPath)) continue;
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        recordings.push({
          uuid: meta.uuid,
          title: meta.title,
          date: meta.created_at,
          ym: yearMonth(meta.created_at),
          transcriptPath,
          dir: entry.name,
        });
      } catch {
        // 损坏的 meta 跳过
      }
    }
  }

  // 收集已有小节及其 sources
  const existingSections = {};
  const sourcedUuids = new Set();
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.md')) {
        const fm = parseFrontmatter(fs.readFileSync(full, 'utf8'));
        if (!fm) continue;
        const vol = fm.volume;
        const chap = String(fm.chapter || '').padStart(2, '0');
        const ym = `${vol}-${chap}`;
        (existingSections[ym] = existingSections[ym] || []).push({
          path: full,
          title: fm.title || entry.name,
          section: Number(fm.section) || 0,
          sources: fm.sources || [],
        });
        for (const u of fm.sources || []) sourcedUuids.add(u);
      }
    }
  }
  walk(paths.biography);

  // 未入传录音按年月分组
  const pending = {};
  for (const rec of recordings) {
    if (rec.uuid && sourcedUuids.has(rec.uuid)) continue;
    (pending[rec.ym] = pending[rec.ym] || []).push(rec);
  }
  for (const ym of Object.keys(pending)) {
    pending[ym].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }

  const result = {
    pending,
    existingSections,
    stats: {
      total_recordings: recordings.length,
      pending_count: Object.values(pending).reduce((n, arr) => n + arr.length, 0),
      section_count: Object.values(existingSections).reduce((n, arr) => n + arr.length, 0),
      pending_months: Object.keys(pending).sort(),
    },
  };
  console.log(JSON.stringify(result, null, 2));
}

main();
