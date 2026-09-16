'use strict';

// Supabase Storage 客户端（零第三方依赖）。
// 用于豆包标准版（异步）转写：上传音频 → 生成临时签名 URL 供服务端拉取 → 转写完删除。
// 私有桶；签名 URL 有效期默认 24h，转写结束立即删对象，不占额度。
// 注意：大文件上传走系统 curl（Node 内置 fetch/undici 对超大请求体偶发
// "fetch failed"，实测 40MB+ 即不稳定）；签名/删除等小 JSON 请求仍用 fetch。

const fs = require('fs');
const { spawnSync } = require('child_process');

// 逐段 encodeURIComponent，保留路径斜杠
function encodePath(name) {
  return name.split('/').map(encodeURIComponent).join('/');
}

async function request({ method, url, serviceKey, body, contentType }) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        ...(contentType ? { 'Content-Type': contentType } : {}),
      },
      ...(body !== undefined ? { body } : {}),
    });
  } catch (err) {
    const cause = err.cause ? `（cause: ${err.cause.code || err.cause.message || err.cause}）` : '';
    throw new Error(`Supabase Storage 请求失败: ${err.message}${cause}`);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Supabase Storage ${method} 失败（HTTP ${res.status}）: ${json.message || JSON.stringify(json).slice(0, 300)}`);
  }
  return json;
}

// 上传音频对象（系统 curl，--data-binary 直传文件，避免 Node fetch 大包问题）。
// proxy 可选（如 http://127.0.0.1:7890）：国内直连 Supabase 东京节点很慢，走代理可提速。
// 返回 { key }。name 可含路径前缀（如 "tmp/rec.m4a"）。
async function uploadObject({ url, serviceKey, bucket, name, filePath, proxy }) {
  const objectUrl = `${url}/storage/v1/object/${bucket}/${encodePath(name)}`;
  const result = spawnSync(
    'curl',
    [
      '-sS',
      '--max-time', '3600',
      ...(proxy ? ['--proxy', proxy] : []),
      '-X', 'POST',
      '-H', `Authorization: Bearer ${serviceKey}`,
      '-H', 'Content-Type: application/octet-stream',
      '-H', 'x-upsert: true',
      '--data-binary', `@${filePath}`,
      '-w', '\n%{http_code}',
      objectUrl,
    ],
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
  );
  if (result.error) {
    throw new Error(`Supabase Storage 上传失败（curl）: ${result.error.message}`);
  }
  const output = (result.stdout || '').trim().split('\n');
  const status = Number(output.pop());
  const respBody = output.join('\n');
  if (result.status !== 0 || !(status >= 200 && status < 300)) {
    throw new Error(`Supabase Storage 上传失败（curl exit ${result.status}, HTTP ${status}）: ${respBody.slice(0, 300)}${result.stderr ? ` / ${result.stderr.trim().slice(0, 200)}` : ''}`);
  }
  return { key: `${bucket}/${name}` };
}

// 生成签名 URL（默认 24h），豆包服务端直接 GET 该 URL 拉取音频
async function createSignedUrl({ url, serviceKey, bucket, name, expiresIn = 86400 }) {
  const json = await request({
    method: 'POST',
    url: `${url}/storage/v1/object/sign/${bucket}/${encodePath(name)}`,
    serviceKey,
    body: JSON.stringify({ expiresIn }),
    contentType: 'application/json',
  });
  if (!json.signedURL) {
    throw new Error('Supabase Storage 签名响应缺少 signedURL 字段');
  }
  // 签名接口返回的是 /object/sign/... 相对路径，但新版 API 网关
  //（{ref}.supabase.co）要求带 /storage/v1 前缀，否则 404。
  const signedPath = json.signedURL.startsWith('/storage/v1')
    ? json.signedURL
    : `/storage/v1${json.signedURL}`;
  return `${url}${signedPath}`;
}

async function deleteObject({ url, serviceKey, bucket, name }) {
  await request({
    method: 'DELETE',
    url: `${url}/storage/v1/object/${bucket}/${encodePath(name)}`,
    serviceKey,
  });
}

module.exports = { uploadObject, createSignedUrl, deleteObject };
