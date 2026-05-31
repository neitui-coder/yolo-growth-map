/**
 * upload-media.js — 通过已打开的微信开发者工具 automator 会话上传媒体到云存储
 *
 * 背景：cloudbase CLI 登录会过期（媒体上传那条线），但 DevTools 里的 wx.cloud
 * 会话用的是开发者工具自身的登录态，不依赖 cloudbase CLI。本脚本把本地文件读成
 * base64 → 在小程序运行时写入临时文件 → wx.cloud.uploadFile 上传到云存储。
 *
 * 用法：
 *   1. 确保 DevTools 打开本项目，且 automator 已监听（cli auto --auto-port 9420）
 *   2. 准备 manifest JSON：[["本地绝对路径","云存储 cloudPath"], ...]
 *   3. AUTOMATOR_WS_ENDPOINT=ws://127.0.0.1:9420 node scripts/upload-media.js <manifest.json>
 *   输出：把 {cloudPath: fileID} 写到 manifest 同目录的 <manifest>.out.json
 *
 * 注意：上传大图前先压缩（建议 sips -Z 1280），base64 经 evaluate 传输，过大费时。
 */
const fs = require('fs');
const path = require('path');
const automator = require('miniprogram-automator');
const MiniProgram = require('miniprogram-automator/out/MiniProgram').default;

// 跳过版本检查，连接已打开的 DevTools 会话
MiniProgram.prototype.checkVersion = async () => true;

const wsEndpoint = process.env.AUTOMATOR_WS_ENDPOINT || 'ws://127.0.0.1:9420';
const manifestPath = process.argv[2];

if (!manifestPath || !fs.existsSync(manifestPath)) {
  console.error('用法: node scripts/upload-media.js <manifest.json>');
  console.error('manifest 格式: [["/abs/local.jpg","yolo-growth-map/media/.../x.jpg"], ...]');
  process.exit(1);
}

['http_proxy', 'HTTP_PROXY', 'https_proxy', 'HTTPS_PROXY', 'all_proxy', 'ALL_PROXY', 'no_proxy', 'NO_PROXY']
  .forEach((k) => { delete process.env[k]; });

async function main() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  let mp;
  const out = {};
  try {
    mp = await automator.connect({ wsEndpoint });
    for (const [local, cloudPath] of manifest) {
      if (!fs.existsSync(local)) throw new Error('缺少本地文件: ' + local);
      const b64 = fs.readFileSync(local).toString('base64');
      const fileID = await mp.evaluate(async (b64, cloudPath) => {
        const fsm = wx.getFileSystemManager();
        const tmp = `${wx.env.USER_DATA_PATH}/upload_media_tmp`;
        fsm.writeFileSync(tmp, b64, 'base64');
        const r = await wx.cloud.uploadFile({ cloudPath, filePath: tmp });
        return r.fileID;
      }, b64, cloudPath);
      out[cloudPath] = fileID;
      console.log('uploaded', path.basename(cloudPath), '->', fileID);
    }
  } finally {
    if (mp) { try { await mp.disconnect(); } catch (e) { /* ignore */ } }
  }
  const outPath = manifestPath.replace(/\.json$/, '') + '.out.json';
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log('wrote', outPath);
}

main().catch((err) => { console.error(err && (err.stack || err.message)); process.exit(1); });
