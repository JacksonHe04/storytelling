#!/usr/bin/env node
'use strict';

// 采访 context 规划：汇总传记大纲、MEMORY、近期已转写录音、访谈历史与素材覆盖状态，
// 供 agent 决定「今天该问什么」。判断性工作（选问题、挖空白）由 agent 完成，脚本只做确定性汇总。
// 用法: node context.js [--days=14]   （输出 JSON 到 stdout）

const fs = require('fs');
const path = require('path');

const { paths, parseFrontmatter } = require('../../story-listen/scripts/storytelling');

function main() {
  const days = Number((process.argv.find((a) => a.startsWith('--days=')) || '').split('=')[1]) || 14;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  // 传记大纲：各小节的位置、标题与覆盖时段
  const sections = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.md')) {
        const fm = parseFrontmatter(fs.readFileSync(full, 'utf8'));
        if (!fm) continue;
        sections.push({
          path: full,
          volume: fm.volume || '',
          year: fm.year || '',
          chapter: fm.chapter != null ? fm.chapter : '',
          section: Number(fm.section) || 0,
          title: fm.title || entry.name,
          period: fm.period || '',
        });
        for (const u of fm.sources || []) covered.add(u);
      }
    }
  }
  const covered = new Set();
  walk(paths.biography);

  // 近期已转写录音（默认近 14 天），并标记是否已入传
  const recentTranscripts = [];
  if (fs.existsSync(paths.recordings)) {
    for (const entry of fs.readdirSync(paths.recordings, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const metaPath = path.join(paths.recordings, entry.name, 'meta.json');
      const transcriptPath = path.join(paths.recordings, entry.name, 'transcript.md');
      if (!fs.existsSync(metaPath) || !fs.existsSync(transcriptPath)) continue;
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        const t = new Date(meta.created_at).getTime();
        if (!Number.isFinite(t) || t < cutoff) continue;
        recentTranscripts.push({
          uuid: meta.uuid,
          title: meta.title,
          date: meta.created_at,
          transcriptPath,
          covered: covered.has(meta.uuid),
        });
      } catch {
        // 损坏的 meta 跳过
      }
    }
    recentTranscripts.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  // 访谈历史：避免重复提问，也提示哪些访谈尚未被消化
  const interviews = [];
  if (fs.existsSync(paths.interviews)) {
    for (const entry of fs.readdirSync(paths.interviews).sort()) {
      if (!entry.endsWith('.md')) continue;
      const full = path.join(paths.interviews, entry);
      const fm = parseFrontmatter(fs.readFileSync(full, 'utf8'));
      if (!fm || fm.type !== 'interview') continue;
      interviews.push({
        file: entry,
        path: full,
        mode: fm.mode || 'offline',
        uuid: fm.uuid || '',
        created_at: fm.created_at || '',
        consumed: fm.uuid ? covered.has(fm.uuid) : undefined,
      });
    }
  }

  const memoryPath = path.join(paths.root, 'MEMORY.md');
  const result = {
    generated_at: new Date().toISOString(),
    window_days: days,
    biography: { section_count: sections.length, sections },
    memory: { path: memoryPath, exists: fs.existsSync(memoryPath) },
    recentTranscripts,
    interviews,
    stats: {
      section_count: sections.length,
      recent_transcripts: recentTranscripts.length,
      interview_count: interviews.length,
    },
  };
  console.log(JSON.stringify(result, null, 2));
}

main();
