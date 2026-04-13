#!/bin/bash
set -euo pipefail

PROJECT_ROOT="/Users/Sean/WeChatProjects/miniprogram-2"
PDF_PATH="/Users/Sean/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxwxwx284260582_29ca/msg/file/2026-03/【PDF版本】YOLO+2025会员海报合集(1).pdf"
MASTER_PATH="$PROJECT_ROOT/data/yolo-2025-members.master.json"
OUTPUT_DIR="$PROJECT_ROOT/assets-source/images/avatars"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

mkdir -p "$OUTPUT_DIR"
rm -f "$OUTPUT_DIR"/pdf2025-*.jpg
pdftoppm -f 1 -l 37 -jpeg -r 170 "$PDF_PATH" "$TMP_DIR/page" >/dev/null 2>&1

node - "$MASTER_PATH" "$TMP_DIR" "$OUTPUT_DIR" <<'NODE'
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const masterPath = process.argv[2];
const tempDir = process.argv[3];
const outputDir = process.argv[4];
const master = JSON.parse(fs.readFileSync(masterPath, 'utf8'));

for (const member of master.members) {
  const page = String(member.source.page).padStart(2, '0');
  const pageImage = path.join(tempDir, `page-${page}.jpg`);
  const target = path.join(outputDir, `${member.identity.userId}.jpg`);
  childProcess.execFileSync('cp', [pageImage, target]);
  childProcess.execFileSync('sips', ['-c', '620', '620', target, '--out', target], { stdio: 'ignore' });
  childProcess.execFileSync('sips', ['-Z', '320', target, '--out', target], { stdio: 'ignore' });
  console.log(target);
}
NODE
