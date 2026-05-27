# YOLO+ 小程序交接文档

> 给下一位接手的 Claude Code 或工程师。读完应该能立刻继续开发、测试、部署、发版。
> 写于 2026-05-28；维护人 Sean (王骁，openId `oR4Gr5AfM4rgKhFwd6HsK7QWDNG0`)。
>
> **完整迭代历史与决策摘要**：见 [`CHANGELOG.md`](./CHANGELOG.md)

## 0. 密钥/凭证审计（重要）

**仓库外没有任何 secret 文件**——这是设计选择：
- 不需要 AppSecret：用 cloud function + `cloud.getWXContext()` 服务端直签
- 不需要 CloudBase AccessKey：用 DevTools CLI 部署走 DevTools 微信登录
- 仓库内的 AppID/EnvID/Sean openId 不是 secret（前者公开，后者是 Sean 个人标识）

**仓库外但跟项目相关**：
| 项 | 位置 | 说明 |
|---|---|---|
| 数据源 xlsx（含 PII 手机号）| `data/sources/` 仓库已备份 + `~/Downloads/` 原版 | scripts 优先用 `data/sources/`，fallback `~/Downloads/` |
| DevTools 登录态 | `~/Library/Application Support/微信开发者工具/` | Sean 本人持有，无法迁移 |
| mp.weixin.qq.com 浏览器登录 | 浏览器 cookies | 同上 |
| `~/.claude/shell-wrapper.sh` 一行 FNM_LOGLEVEL | 1 行环境变量 | 跟项目无关，纯抑制 fnm warning |

→ **所有项目代码 + 数据 + 脚本全部在 `/Users/Sean/WeChatProjects/miniprogram-2`**。

## 1. 仓库与路径

- **本地路径**：`/Users/Sean/WeChatProjects/miniprogram-2`
- **远程**：`git@github.com:neitui-coder/yolo-growth-map.git` (分支 `master`)
- **小程序后台**：mp.weixin.qq.com，AppID `wx2d60e117f613f2be`
- **CloudBase 环境**：`cloud1-7giblg7i4595eaf3`
- **拥有人**：Sean 个人微信主体（**不是**杨三角主体，故意保留以避免迁移成本，详见 `docs/MINIPROGRAM-ACCOUNTS.md`）
- **备用主体（杨三角）**：`gh_af1dbdf12929`（暂未启用，关联即可不迁移）

## 2. 启动开发 / 运行测试

### 必需工具
- macOS、Node.js 18+（用 `/usr/local/bin/node`）
- 微信开发者工具（已装 `/Applications/wechatwebdevtools.app/`），cli 在 `/Applications/wechatwebdevtools.app/Contents/MacOS/cli`
- Python 3.9+（`/Users/Sean/opt/anaconda3/envs/myenv/bin/python3`）+ 内置 zipfile/xml
- `miniprogram-automator` npm 包（已在 `package.json` 里）

### 启动 DevTools Automator（自动化测试必备）
```bash
unset http_proxy HTTP_PROXY https_proxy HTTPS_PROXY ALL_PROXY all_proxy
/Applications/wechatwebdevtools.app/Contents/MacOS/cli auto \
  --project /Users/Sean/WeChatProjects/miniprogram-2 \
  --auto-port 9420 &
```

⚠️ **proxy 必须 unset** — Sean 本机有 `http_proxy=127.0.0.1:7890`（Clash），自动化连接 ws://localhost:9420 会走代理失败。`scripts/find-automator-port.js` 已封装这点；新 helper 都应优先用它。

### 跑测试脚本
```bash
unset http_proxy ...; cd /Users/Sean/WeChatProjects/miniprogram-2
/usr/local/bin/node -e "
const automator = require('miniprogram-automator');
(async () => {
  const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' });
  await mp.reLaunch('/pages/index/index');
  // ... 你的测试
  await mp.disconnect();
})();
"
```

### 部署云函数（每次改 cloudfunctions/yoloFunctions/index.js 后必跑）
```bash
/Applications/wechatwebdevtools.app/Contents/MacOS/cli cloud functions deploy \
  --env cloud1-7giblg7i4595eaf3 --names yoloFunctions \
  --project /Users/Sean/WeChatProjects/miniprogram-2 --remote-npm-install
```

### 上传体验版
```bash
/Applications/wechatwebdevtools.app/Contents/MacOS/cli upload \
  --project /Users/Sean/WeChatProjects/miniprogram-2 \
  --version 1.0.X --desc "本次改动说明"
```

⚠️ CLI **不能**直接"设为体验版"。上传后 Sean 需要去 mp 后台 → 版本管理 → 开发版本 → 点 "选为体验版"。

## 3. 代码结构

```
miniprogram-2/
├── miniprogram/              # 小程序前端代码
│   ├── app.js                # 全局 App + 登录态 + adminOpenIds + staffOpenIds + TEST_BYPASS_AUTH
│   ├── app.json              # 页面注册、tabBar、AppID 配置
│   ├── pages/
│   │   ├── index/            # 首页 - 会员列表 + 排序 + 搜索 + alumni toggle
│   │   ├── profile/          # 个人成长档案（v2 简洁版，hero + 详细资料 + 时间线 + 问答）
│   │   ├── activities/       # 活动列表（按年份过滤）
│   │   ├── activity-detail/  # 活动详情（hero/亮点/参与者/照片）
│   │   ├── community/        # 社区动态（已从 tabBar 移除，代码保留）
│   │   ├── me/               # 「我的」页（含游客/工作人员/管理员三态）
│   │   ├── auth/             # 绑定身份（手机号一键 + 名单 fallback）
│   │   ├── privacy/          # 隐私政策
│   │   ├── edit/edit         # 节点编辑（旧）
│   │   └── edit-profile/     # 个人资料编辑
│   ├── components/
│   │   ├── member-card/      # 首页/搜索结果卡片
│   │   ├── timeline-node/    # 时间线节点
│   │   ├── avatar-picker/    # 头像选择（暂用 dicebear 备选）
│   │   └── ...
│   ├── utils/util.js         # 工具函数：getAvatarUrl/yearsSince/computeSimilarity 等
│   └── images/               # tab 图标
├── cloudfunctions/
│   └── yoloFunctions/
│       ├── index.js          # 所有云端业务（switch by event.type）
│       ├── config.json       # openapi 权限声明（security.msgSecCheck, phonenumber.getPhoneNumber）
│       └── package.json
├── data/
│   ├── yolo-2025-members.master.json   # 37 会员数据（rebuild 来源）
│   └── yolo-activities-collection.json # 31 活动数据（含 participants/cover/亮点）
├── scripts/                  # 一次性 Python/Node 工具脚本
│   ├── rebuild-from-xlsx.py         # 从档案 xlsx 重建 master（核心）
│   ├── add-old-activities.py        # 加 2019-2022 老活动
│   ├── remap-activity-uids.py       # 活动 participants uid 跨版本映射
│   ├── audit-attendance.py          # 活动出席数据准确性审计（按活动）
│   ├── audit-per-member.py          # 同上（按会员）
│   ├── extract-phones.py            # 从 xlsx 提取多手机号
│   ├── extract-mbti.py              # 从所有 sheet 提取 MBTI
│   ├── clean-education.py           # 学校字段清洗
│   ├── clean-company.py             # 公司字段清洗
│   ├── fix-master-data.py           # 数据修补（理事/头像/特殊修正）
│   ├── import-v2.js                 # 把 data/*.json 推到 CloudBase
│   ├── find-automator-port.js       # automator 端口探测 helper
│   └── ...
├── docs/
│   ├── MINIPROGRAM-ACCOUNTS.md  # 主体记录（当前主体 vs 杨三角）
│   └── REVIEW-SUBMISSION.md      # 提审材料模板
├── HANDOVER.md                   # 本文档
├── assets/logo/                  # YOLO+ 头像（512/144 PNG + SVG 源）
└── project.config.json
```

## 4. 数据流

### 会员数据
```
~/Downloads/YOLO+档案信息表（全）.xlsx
  ↓ scripts/rebuild-from-xlsx.py
data/yolo-2025-members.master.json   (37 人，sheet6 为权威现届名单 + 5 创始理事补回)
  ↓ scripts/extract-phones.py (从所有 sheet 拿 phones)
  ↓ scripts/extract-mbti.py (从所有 sheet 拿 MBTI)
  ↓ scripts/clean-education.py (学校清洗)
  ↓ scripts/clean-company.py (公司清洗)
  ↓ scripts/fix-master-data.py (理事/头像补)
  ↓ scripts/import-v2.js
CloudBase users collection (dataType:real)
  ↓ wx.cloud.callFunction loginWechat / getUsers
小程序运行时
```

### 活动数据
```
~/Downloads/YOLO+会员活动出席表格/{2023,2024,2025}年....xlsx   (按年的旧文件)
~/Downloads/YOLO+出席表.xlsx                                  (2019-2025 综合)
~/Downloads/YOLO+出席表-2026武夷山小组活动.csv               (武夷山专门表)
  ↓ scripts/add-old-activities.py + 内置 attendance 解析
data/yolo-activities-collection.json (31 活动)
  ↓ scripts/import-v2.js → seedActivities
CloudBase activities collection
```

### 出席审计循环
每次数据变化跑 `scripts/audit-attendance.py`（按活动）和 `audit-per-member.py`（按会员），输出应是 `0 差异`。

## 5. 关键业务规则

| 规则 | 实现位置 |
|------|---------|
| 现届 37 人 = sheet6 名单 + 5 创始理事 | `scripts/rebuild-from-xlsx.py:keep=in_roster or is_lishi` |
| 显示字段：姓名/MBTI/盖洛普/兴趣/公司/城市/生日(月)/教育 | profile.wxml hero + 关于 TA section |
| 头像优先云存储，无则名字首字 + 蓝色渐变 | util.getAvatarUrl / getAvatarInitial |
| 加入年数（不是天数） | util.yearsSince |
| 城市多个只取一个 | rebuild script first_city() + edit-profile 单 input |
| 生日只对外显示月份 | parseBirthday 支持 "X月" 格式 + index.js birthdayDayLabel |
| 理事统一显示「理事」 | profile.wxml `selectedUser.isLishi` + member-card.js `isLishi` |
| 「会员」黄色标签全局隐藏 | wxml 中没渲染普通 role 的 chip |
| 活动参与者：自己置顶 + 字母序 | activity-detail.js displayParticipants.sort |
| 非会员/家属不计入参与统计 | 通过 master 36 人 过滤；UI 加注脚 |
| 相似度算法（用于"跟我最像"排序）| util.computeSimilarity：MBTI+3/城市+2/盖洛普每+1/兴趣每+1/技能每+1/加入年份±1+1 |
| 头像点击预览 + cloud:// 兜底 | profile.js onAvatarPreview |
| 分享功能暂时关闭 | 所有 onShareAppMessage 已删 |

## 6. 登录与权限

```
扫码进入 → app._loginWechat() (调云函数 loginWechat)
  ↓
loginWechat 返回 { openId, unionId, bound?, staff? }
  ↓
分支：
  A. bound != null      → 已绑定成员 → 直接登录，currentUserId = bound.userId
  B. staff != null      → 隐藏型工作人员 → isStaff=true，只读访问，"我的"页显示工作人员卡片
  C. 都没匹配           → unbound：
     - TEST_BYPASS_AUTH=true 时 → 用 TEST_GUEST_USER_ID 兜底当游客（开发期）
     - false 时 → 强制跳 /pages/auth/auth
```

**白名单**：
- `adminUserIds` / `adminOpenIds` in app.js:globalData — 可切模式、可看管理选项
- `staff` 集合 in CloudBase — 隐藏型工作人员，调 yoloFunctions{type:addStaff/removeStaff/listStaff}（仅 Sean 可调）

**测试开关**：
- `app.js:globalData.TEST_BYPASS_AUTH` 当前 `true` — 上线前必须改 `false`

## 7. 提审准备状态

详见 `docs/REVIEW-SUBMISSION.md`。简要：

- ✅ 内容安全：updateUser/addQuestion/answerQuestion/addNode/updateNodeById/addComment 都接入 `security.msgSecCheck`
- ✅ 隐私接口：无 wx.getUserProfile/chooseImage/getLocation，无需 wx.getPrivacySetting 弹窗
- ✅ 隐私政策页：pages/privacy/privacy
- ✅ "我的"页诚实游客态（不冒用任何会员）
- ✅ 当前 v1.0.8 可直接提审
- ⏳ Sean 后台必做：ICP 备案、用户隐私保护指引、选服务类目、改小程序名称为 YOLO+
- 一旦审核通过：把 TEST_BYPASS_AUTH 改 false + 恢复 onShareAppMessage → 二次审核

## 8. 体验版上传完整流程

```bash
# 1. 改完代码后
git add -A && git commit -m "..." && git push

# 2. 重启 automator (proxy unset)
unset http_proxy ...; /Applications/wechatwebdevtools.app/Contents/MacOS/cli auto \
  --project /Users/Sean/WeChatProjects/miniprogram-2 --auto-port 9420 &
sleep 7

# 3. 如果改了云函数，部署
/Applications/wechatwebdevtools.app/Contents/MacOS/cli cloud functions deploy \
  --env cloud1-7giblg7i4595eaf3 --names yoloFunctions \
  --project /Users/Sean/WeChatProjects/miniprogram-2 --remote-npm-install

# 4. 如果改了 master/activities，import
cd /Users/Sean/WeChatProjects/miniprogram-2 && /usr/local/bin/node scripts/import-v2.js

# 5. 上传新版本
/Applications/wechatwebdevtools.app/Contents/MacOS/cli upload \
  --project /Users/Sean/WeChatProjects/miniprogram-2 \
  --version <下一个版本号> --desc "<改动摘要>"

# 6. Sean 去 mp 后台手动「选为体验版」
```

## 9. 常见陷阱

1. **fnm warning**：`/Users/Sean/.claude/shell-wrapper.sh` 已设 `FNM_LOGLEVEL=quiet`，Claude Code 调 bash 时不再吐警告。如果未来这一行被吃掉了，重新加。

2. **automator 端口掉线**：每次 `cli auto` 跑完会 detach，但 wechatweb 进程保持 9420 listening。如果 `automator.connect` 报"check if target project window is opened"，pkill cli auto + 重启即可。

3. **代理污染 ws 连接**：上面强调过，proxy 必须 unset。

4. **mp 后台 1 个自然月最多改 2 次小程序名称** — 改 YOLO+ 前慎重。

5. **dataType 字段必须设**：cloud users/activities 都用 dataType='real' 区分。listBindable / getUsers 等都按 dataType 过滤。老 mock 数据（如有）跑 yoloFunctions{type:cleanupMockUsers} 清掉（仅 Sean openid 可调）。

6. **替换 users 会丢绑定**：`replaceUsersByDataType` 已加 wechatOpenId 保留逻辑（备份 → 删除 → 插入时合并）。但如果重新跑 fix-master-data.py 这种脚本，最好提前 `db.collection('users').where({wechatOpenId: ...}).get()` 备份。

7. **xlsx 编辑后**：删 master JSON 中的对应字段再跑 rebuild，避免上次清洗导致的次生污染。

## 10. 我（Claude）操作模式

- 用 `Bash` 工具执行 cli/node/python 命令
- 用 `Read/Write/Edit` 修改代码
- 用 `miniprogram-automator` 跑 DevTools 截图验证（screenshot 写到 /tmp）
- **代码改完必跑测试**（automator 截图或 evaluate 检查数据）
- **不在 master 直接改**（其实 yolo 这个项目没有 worktree 规则，是直接 master 工作）
- commit 命名规范：`feat:` / `fix:` / `chore:` 前缀
- 每次大改后写 commit 含「核心逻辑 + 验证方式」

## 11. 当前未完成 / 下一步建议

| 优先级 | 事项 |
|------|------|
| 🔴 高 | Sean 完成 mp 后台备案 + 隐私指引 → 然后提审 |
| 🔴 高 | 审核通过后：`TEST_BYPASS_AUTH=false` + 恢复 onShareAppMessage |
| 🟡 中 | 学校/公司清洗仍有边缘 case 不完美（旧金山大学金融专业等），可继续打磨规则 |
| 🟡 中 | 达美欣等没填手机号的成员，需后续补充信息后才能用手机号一键绑 |
| 🟡 中 | 编辑资料保存逻辑：当前只更新前端，云端 updateUser 仅做内容安全检查，需验证字段持久化 |
| 🟢 低 | 头像云存储路径都是 pdf2025-* slug，未来如要换主体需重新上传 |
| 🟢 低 | 大模型增强相似度（如果以后 motto/简介丰富了）— 当前规则算法够用 |

## 12. 联系人

- Sean (王骁) 微信：sean2016ucsd@gmail.com
- 主要使用反馈渠道：Claude Code chat 本身

---
祝接手顺利。如遇问题先看 `docs/REVIEW-SUBMISSION.md` 和这份文档。
