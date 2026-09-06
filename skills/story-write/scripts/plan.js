#!/usr/bin/env node
'use strict';

// 撰写规划：扫描所有已转写录音与访谈记录，对照 biography 各小节 frontmatter 的 sources（uuid），
// 算出哪些月份有尚未写入传记的素材（录音按年月分组、访谈单独列出），输出工作清单。
// 小节 sources 的并集即「已入传」状态，目录本身即状态，无需额外 state 文件。
// 用法: node plan.js   （输出 JSON 到 stdout）

const fs = require('fs');
const path = require('path');

const { paths, parseFrontmatter } = require('../../story-listen/scripts/storytelling');

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
        const year = fm.year || fm.volume; // 兼容旧版 volume=年份
        const chap = fm.chapter != null ? String(fm.chapter).padStart(2, '0') : '';
        const ym = chap ? `${year}-${chap}` : String(year);
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

  // 未入传的访谈记录（离线访谈录 = 问题清单本身待消化；交互访谈 = 问答记录）
  const pendingInterviews = [];
  if (fs.existsSync(paths.interviews)) {
    for (const entry of fs.readdirSync(paths.interviews)) {
      if (!entry.endsWith('.md')) continue;
      const full = path.join(paths.interviews, entry);
      const fm = parseFrontmatter(fs.readFileSync(full, 'utf8'));
      if (!fm || fm.type !== 'interview' || !fm.uuid) continue;
      if (sourcedUuids.has(fm.uuid)) continue;
      pendingInterviews.push({
        uuid: fm.uuid,
        mode: fm.mode || 'offline',
        created_at: fm.created_at || '',
        path: full,
      });
    }
    pendingInterviews.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  const result = {
    pending,
    pendingInterviews,
    existingSections,
    stats: {
      total_recordings: recordings.length,
      pending_count: Object.values(pending).reduce((n, arr) => n + arr.length, 0),
      pending_interviews: pendingInterviews.length,
      section_count: Object.values(existingSections).reduce((n, arr) => n + arr.length, 0),
      pending_months: Object.keys(pending).sort(),
    },
  };
  console.log(JSON.stringify(result, null, 2));
}

main();
