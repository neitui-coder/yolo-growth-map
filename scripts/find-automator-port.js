#!/usr/bin/env node
/**
 * 连接 WeChat DevTools automator，并在需要时自动启用自动化 + 打开固定端口 9420。
 *
 * Sean 本机 shell 默认带 http_proxy=http://127.0.0.1:7890，会让 automator 的 WS 握手走代理，
 * 因此本模块会在进程内 unset 这些变量。也显式使用 --auto-port 9420 固定端口。
 *
 * Usage:
 *   const { getConnectedMiniProgram } = require('./scripts/find-automator-port');
 *   const mp = await getConnectedMiniProgram();
 */
const { execSync, spawn } = require('child_process');
const automator = require('miniprogram-automator');

const CLI = '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';
const PROJECT = '/Users/Sean/WeChatProjects/miniprogram-2';
const AUTO_PORT = 9420;

function stripProxyEnv() {
  for (const k of ['http_proxy', 'HTTP_PROXY', 'https_proxy', 'HTTPS_PROXY', 'all_proxy', 'ALL_PROXY', 'no_proxy', 'NO_PROXY']) {
    delete process.env[k];
  }
}

function isPortListening(port) {
  try {
    const out = execSync(`/usr/sbin/lsof -iTCP:${port} -sTCP:LISTEN -P 2>/dev/null || true`, { encoding: 'utf8' });
    return /LISTEN/.test(out);
  } catch (_) { return false; }
}

function cliAutoEnable(timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    for (const k of Object.keys(env)) { if (/proxy/i.test(k)) delete env[k]; }
    const proc = spawn(CLI, ['auto', '--project', PROJECT, '--auto-port', String(AUTO_PORT)], { env });
    let buf = '';
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; try { proc.kill(); } catch (_) {} reject(new Error('cli auto timeout; buf=' + buf)); } }, timeoutMs);
    const check = () => {
      if (done) return;
      if (/✔ auto/.test(buf) || isPortListening(AUTO_PORT)) { done = true; clearTimeout(timer); resolve(); }
    };
    proc.stdout.on('data', d => { buf += d.toString(); check(); });
    proc.stderr.on('data', d => { buf += d.toString(); check(); });
    proc.on('exit', () => { check(); if (!done) { done = true; clearTimeout(timer); reject(new Error('cli auto exited; buf=' + buf)); } });
  });
}

async function tryConnect() {
  return automator.connect({ wsEndpoint: `ws://127.0.0.1:${AUTO_PORT}` });
}

async function getConnectedMiniProgram() {
  stripProxyEnv();
  if (isPortListening(AUTO_PORT)) {
    try { return await tryConnect(); } catch (_) {}
  }
  await cliAutoEnable();
  for (let i = 0; i < 10; i++) {
    try { return await tryConnect(); } catch (_) { await new Promise(r => setTimeout(r, 500)); }
  }
  throw new Error(`Could not connect to automator on port ${AUTO_PORT}`);
}

if (require.main === module) {
  getConnectedMiniProgram()
    .then(async mp => {
      const p = await mp.currentPage();
      console.log(JSON.stringify({ port: AUTO_PORT, currentPage: p.path }));
      await mp.disconnect();
      process.exit(0);
    })
    .catch(e => { console.error(e.message); process.exit(1); });
}

module.exports = { getConnectedMiniProgram, AUTO_PORT };
