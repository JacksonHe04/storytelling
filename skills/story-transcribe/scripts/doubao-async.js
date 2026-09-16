'use strict';

// 豆包（火山引擎）录音文件识别标准版（异步）API 客户端。
// 流程：submit（audio.url 传入音频链接）→ 轮询 query → 返回文本。
// 详见 _satellites/api/doubao/录音识别-任务提交.md 与 录音识别-结果查询.md。
// 标准版限制 512MB / 5 小时；独有能力：enable_speaker_info 说话人分离。

const crypto = require('crypto');

const SUBMIT_ENDPOINT = 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit';
const QUERY_ENDPOINT = 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/query';
const DEFAULT_ASYNC_RESOURCE_ID = 'volc.bigasr.auc';
const SUCCESS_STATUS_CODE = '20000000';
// 处理中的状态码（等待识别 / 识别中），其余非成功码视为失败
const IN_PROGRESS_STATUS_CODES = new Set(['20000001', '20000002']);

async function callApi(endpoint, { apiKey, resourceId, requestId, body }) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
      'X-Api-Resource-Id': resourceId,
      'X-Api-Request-Id': requestId,
      'X-Api-Sequence': '-1',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const statusCode = res.headers.get('x-api-status-code');
  const message = res.headers.get('x-api-message');
  const logid = res.headers.get('x-tt-logid');
  const json = await res.json().catch(() => ({}));
  return { statusCode, message, logid, json };
}

// 提交转写任务。audioUrl 为可公开 GET 的音频链接（如 Supabase 签名 URL）。
// 返回 { taskId, logid }（taskId 即 X-Api-Request-Id）。
async function submitTask(audioUrl, options = {}) {
  const {
    apiKey,
    resourceId = DEFAULT_ASYNC_RESOURCE_ID,
    hotwords = [],
    format,
    speakerSeparation = true,
  } = options;

  const requestId = crypto.randomUUID();
  const body = {
    audio: {
      url: audioUrl,
      format: format || 'm4a',
      rate: 16000,
      bits: 16,
      channel: 1,
    },
    request: {
      model_name: 'bigmodel',
      enable_itn: true,
      enable_punc: true,
      enable_ddc: true,
      // 说话人分离：需同时 show_utterances 才能拿到分句结果
      enable_speaker_info: speakerSeparation,
      show_utterances: speakerSeparation,
    },
  };
  if (hotwords.length > 0) {
    body.request.corpus = {
      context: JSON.stringify({ hotwords: hotwords.map((word) => ({ word })) }),
    };
  }

  const { statusCode, message, logid } = await callApi(SUBMIT_ENDPOINT, {
    apiKey,
    resourceId,
    requestId,
    body,
  });
  if (statusCode !== SUCCESS_STATUS_CODE) {
    throw new Error(`提交任务失败（api-status: ${statusCode}, message: ${message}, logid: ${logid}）`);
  }
  return { taskId: requestId, logid };
}

// 查询一次任务状态。返回 { done, success, text, utterances, logid }。
async function queryTask(taskId, options = {}) {
  const { apiKey, resourceId = DEFAULT_ASYNC_RESOURCE_ID } = options;
  const { statusCode, message, logid, json } = await callApi(QUERY_ENDPOINT, {
    apiKey,
    resourceId,
    requestId: taskId,
    body: {},
  });
  if (statusCode === SUCCESS_STATUS_CODE) {
    return { done: true, success: true, text: json.result?.text || '', utterances: json.result?.utterances || null, logid };
  }
  if (IN_PROGRESS_STATUS_CODES.has(statusCode)) {
    return { done: false, success: null, logid };
  }
  throw new Error(`查询到任务失败（api-status: ${statusCode}, message: ${message}, logid: ${logid}）`);
}

// 连续相同说话人的分句合为一段，段前缀「说话人N:」；只有单一说话人时退化为纯文本
function formatSpeakerText(utterances) {
  if (!Array.isArray(utterances) || utterances.length === 0) return null;
  const speakerIds = new Set(utterances.map((u) => u.speaker_id));
  if (speakerIds.size <= 1) return null;
  const paragraphs = [];
  let current = null;
  for (const u of utterances) {
    if (current && current.speaker === u.speaker_id) {
      current.parts.push(u.text);
    } else {
      current = { speaker: u.speaker_id, parts: [u.text] };
      paragraphs.push(current);
    }
  }
  return paragraphs.map((p) => `说话人${p.speaker}: ${p.parts.join('')}`).join('\n\n');
}

// 完整异步转写：提交 → 轮询 → 返回 { text, speakers, taskId, logid, elapsedMs }。
async function transcribeAsync(audioUrl, options = {}) {
  const { apiKey, resourceId, pollIntervalMs = 10000, timeoutMs = 1800000 } = options;
  const startedAt = Date.now();
  const { taskId } = await submitTask(audioUrl, options);

  for (;;) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`轮询超时（>${timeoutMs / 1000}s），task_id: ${taskId}`);
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
    const q = await queryTask(taskId, { apiKey, resourceId: options.resourceId });
    if (q.done) {
      if (!q.success) throw new Error('任务结束但未成功');
      const speakerText = formatSpeakerText(q.utterances);
      return {
        text: speakerText || q.text,
        speakers: q.utterances ? new Set(q.utterances.map((u) => u.speaker_id)).size : null,
        speakerUsed: !!speakerText,
        taskId,
        logid: q.logid,
        elapsedMs: Date.now() - startedAt,
      };
    }
  }
}

module.exports = {
  SUBMIT_ENDPOINT,
  QUERY_ENDPOINT,
  DEFAULT_ASYNC_RESOURCE_ID,
  submitTask,
  queryTask,
  formatSpeakerText,
  transcribeAsync,
};
