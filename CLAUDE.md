# YOLO+ 成长地图 — 微信小程序

## 项目概况

为 YOLO+ 社区会员打造的**个人成长档案可视化工具**。以时间轴形式展示会员在 YOLO+ 的人生节点：加入时间、参加活动、TED 分享、角色担当、导师一对一、生活里程碑等。

需求来源：苏州年会上 Jenny 提出，希望给每个会员做可视化成长档案，类似支付宝年报/网易云年终汇报的交互体验。

## 技术栈

- **前端**: 微信小程序（原生开发，非框架）
- **后端**: 腾讯 CloudBase 云开发（云数据库 + 云存储）
- **原型**: `../growth-map-prototype.html`（Gemini 生成的 HTML 原型，作为视觉参考）

## 品牌色（蓝色系，2026-03-07 确认）

- 主色: `#1d4ed8`（导航栏背景）
- 强调色: `#2563eb`（按钮、链接、选中态）
- 浅色: `#3b82f6`（辅助元素）
- 渐变: `linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #3b82f6 100%)`

节点类型颜色：
- activity（活动）: 蓝 `#3b82f6`
- role（角色）: 紫 `#8b5cf6`
- life（生活）: 粉 `#ec4899`
- ted（TED分享）: 红 `#ef4444`
- cert（证书认证）: 绿 `#10b981`

## 项目结构

```
growth-map/
├── CLAUDE.md               # 本文件
├── app.js                  # 小程序入口（globalData）
├── app.json                # 全局配置（pages、window）
├── app.wxss                # 全局样式（品牌色、通用类）
├── project.config.json     # 项目配置（appid 待填）
├── sitemap.json
├── db-schema.json          # CloudBase 数据库表结构设计
├── db-seed-data.json       # 示例数据（3个用户 + milestones）
├── pages/
│   ├── index/              # 主页（成长地图 + Profile + 时间轴）
│   └── edit/               # 编辑节点页
├── components/
│   ├── member-bar/         # 会员切换栏（横滚头像列表）
│   ├── profile-header/     # Profile 头部（渐变背景、头像、统计）
│   ├── timeline-node/      # 时间轴节点（5种类型、左右交替）
│   ├── goal-card/          # 目标卡片（有/无目标两种状态）
│   └── avatar-picker/      # 头像选择器弹窗（4x4网格）
├── utils/
│   └── util.js             # 工具函数（daysSince, formatDate, computeGrowthValue 等）
└── images/                 # 静态资源
```

## 数据模型

### users 集合
| 字段 | 类型 | 说明 |
|------|------|------|
| _id | string | 自动生成 |
| _openid | string | 微信登录自动注入 |
| name | string | 用户名 |
| avatarStyle | string | 头像风格（如 "fun-emoji"） |
| avatarSeed | string | 头像种子 |
| motto | string | 个人格言 |
| skills | array[string] | 技能认证列表 |
| goal | string/null | 年度目标 |
| joinDate | string | 入会日期 "YYYY-MM" |
| editPassword | string | 编辑密码，默认 "yolo" |

### milestones 集合
| 字段 | 类型 | 说明 |
|------|------|------|
| _id | string | 自动生成 |
| userId | string | 关联 users._id |
| date | string | 日期 "YYYY-MM" |
| type | enum | activity/role/life/ted/cert |
| desc | string | 描述 |
| images | array[string] | 图片 fileID，最多3个 |

索引：milestones 上 userId + date 复合索引；users 上 _openid 唯一索引。

### 示例用户
- **Alex**: motto "在不确定中寻找确定", skills [CFA, PADI OW], goal "2024年完成马拉松", joinDate "2020-06"
- **Jenny**: motto "每一步都算数", skills [PMP], goal null, joinDate "2019-09"
- **Sean**: motto "做难而正确的事", skills [AWS SAA], goal "学会潜水", joinDate "2021-11"

## 当前状态

Phase 2 已完成（2026-02-13）：
- [x] 项目骨架搭建
- [x] HTML 原型 → 小程序代码转换
- [x] CloudBase 数据库设计（schema + seed data）
- [ ] 接入 CloudBase 云开发（云函数、登录）
- [ ] 真机调试
- [ ] 发布

Phase 4 规划中（2026-03-07，详见 ROADMAP.md）：
- [ ] UI 优化：样式对比切换、编辑按钮位置调整、图片展示放大
- [ ] 编辑体验：标签所见即所得编辑、减少页面跳转
- [ ] 数据存储：接入 CloudBase 云数据库（替换 globalData 硬编码）
- [ ] 用户激励与社交互动：更好玩的内容录入机制、会员间联系

## 开发命令

```bash
# 微信开发者工具导入项目目录：/Users/Sean/Documents/YOLO/growth-map/
# appid 在 project.config.json 中配置

# 如果需要用 Claude Code 处理此项目，从 YOLO 目录启动：
# cd /Users/Sean/Documents/YOLO && claude
```

## 注意事项

- 此项目与 JobWizard 完全独立，不共享任何代码或基础设施
- HTML 原型是视觉参考，小程序代码已从中转换但需持续优化
- px → rpx 转换：1px ≈ 2rpx
- 组件 json 里必须声明 `"component": true`
