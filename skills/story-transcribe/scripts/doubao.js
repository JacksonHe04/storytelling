'use strict';

// 豆包（火山引擎）录音文件识别极速版 API 客户端。
// 极速版同步返回结果，音频以 base64 直传（audio.data），无需对象存储；
// 详见 https://docs.volcengine.com/docs/6561/1631584 。

const fs = require('fs');
const crypto = require('crypto');

const FLASH_ENDPOINT = 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash';
const DEFAULT_RESOURCE_ID = 'volc.bigasr.auc_turbo';
const SUCCESS_STATUS_CODE = '20000000';

// 读取热词文件：每行一个词，# 开头的行与空行忽略
function loadHotwords(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

// 转写单个音频文件。返回 { text, audioDurationMs }。
// options: { apiKey, resourceId, hotwords, format, ddc }
async function transcribe(audioPath, options = {}) {
  const {
    apiKey,
    resourceId = DEFAULT_RESOURCE_ID,
    hotwords = [],
    format,
    ddc = true,
  } = options;

  if (!apiKey) {
    throw new Error('缺少豆包 API Key：请在 ~/.storytelling/settings.json 配置 doubao.api_key');
  }

  const audio = fs.readFileSync(audioPath);
  const body = {
    audio: {
      data: audio.toString('base64'),
      format: format || 'm4a',
    },
    request: {
      model_name: 'bigmodel',
      enable_itn: true, // 口语数字/日期规范化为书面形式
      enable_punc: true, // 标点
      enable_ddc: ddc, // 语义顺滑：删除停顿词（嗯/呃）、语气词、语义重复词
    },
  };

  // 热词通过 corpus.context 传入（JSON 字符串，官方限制约 500 tokens）
  if (hotwords.length > 0) {
    body.request.corpus = {
      context: JSON.stringify({ hotwords: hotwords.map((word) => ({ word })) }),
    };
  }

  const startedAt = Date.now();
  const res = await fetch(FLASH_ENDPOINT, {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
      'X-Api-Resource-Id': resourceId,
      'X-Api-Request-Id': crypto.randomUUID(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const statusCode = res.headers.get('x-api-status-code');
  const message = res.headers.get('x-api-message');
  const logid = res.headers.get('x-tt-logid');
  const elapsedMs = Date.now() - startedAt;

  if (statusCode !== SUCCESS_STATUS_CODE) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `转写失败（HTTP ${res.status}, api-status: ${statusCode}, message: ${message}, logid: ${logid}）${detail ? `: ${detail.slice(0, 300)}` : ''}`
    );
  }

  const json = await res.json();
  const text = json.result?.text;
  if (!text) {
    throw new Error(`转写响应中没有文本（logid: ${logid}）`);
  }

  return {
    text,
    audioDurationMs: json.audio_info?.duration ?? json.result?.additions?.duration ?? null,
    elapsedMs,
    logid,
  };
}

module.exports = {
  FLASH_ENDPOINT,
  DEFAULT_RESOURCE_ID,
  loadHotwords,
  transcribe,
};
