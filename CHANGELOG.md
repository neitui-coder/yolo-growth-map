# CHANGELOG — YOLO+ 成长地图

> 仓库历史完整迭代记录。最新在上。git log 提供完整 commit history，本文档是 Sean 与 Claude 协作的"对话决策"摘要。

---

## v1.0.8 · 2026-05-28 — 关闭分享 + mock 清理 + 编辑全宽

- 4 个页面 onShareAppMessage 全部删除（未审核小程序分享触发"违规"提示，先暂停）
- 云函数 `cleanupMockUsers` 一键清掉 27 条 dataType=mock 老残留
- `listBindable` 加 `dataType:'real'` 过滤，绑定名单不再混入老 mock 用户
- `replaceUsersByDataType` 加 wechatOpenId/wechatUnionId 备份-合并逻辑，防止重 import 冲掉绑定
- 编辑资料：form-input 加 `display:block + box-sizing`，全宽显示；城市改单输入框；生日 picker 文案优化
- commits: `c4a3090`

## v1.0.7 · 2026-05-28 — 活动 nav 滚动 + 头像预览兜底

- 活动页 nav-bar 移除 sticky，蓝色 YOLO+ 活动头部正常滚动消失
- profile 头像点击 → 增加 cloud:// 实时签名 URL 兜底，解决"邓礼睿等头像点不开"
- commits: `99e3fca`

## v1.0.6 · 2026-05-28 — 跟我最像 + 名字首字头像

- 首页加"跟我最像"排序按钮（自己置顶 + 相似度降序，全客户端实时算 <10ms）
- 相似度算法：MBTI+3 / 城市+2 / 盖洛普共有每+1 / 兴趣+1 / 技能+1 / 加入年份±1+1
- 无真实头像 → 名字首字 + 蓝紫渐变圆框（不再用 dicebear 卡通）
- util.getAvatarUrl 返回空、新增 getAvatarInitial 工具
- 活动详情同行的伙伴头像可点击跳 profile，排序：自己置顶 + 字母序
- 林安之 company 描述性字段清空（不是公司名）
- commits: `964edf4`

## v1.0.5 · 2026-05-28 — 卡片重设计 + 学校公司清洗

- 主页 member-card 重设计：头像 + 名字(+理事 tag) + MBTI + 城市 + 成长值+加入年数
- `extract-mbti.py` 扫所有 sheet 提取 MBTI（17→24/37 覆盖率）
- `clean-education.py` 学校字段清洗：去地点/学位/专业，双语优先英文
- `clean-company.py` 公司清洗：从工作经历取最新非日期段，简短化
- profile nav 标题"成长档案"居中 + backdrop-blur
- commits: `523c724`

## v1.0.4 · 2026-05-27 — 主页卡片对齐 profile 规则

- 主页 member-card：理事头衔统一显示"理事"（隐藏"2020年度理事/Mentee Leader"等）
- 隐藏"会员"黄色标签（默认即为会员，无需显示）
- commits: `aee90be`

## v1.0.3 · 2026-05-27 — 美国号支持

- bindByPhone 改取后 10 位匹配，自动跨国家码（86/1）
- 王骁的美国号 19085688001 也能识别
- commits: `e17a145`

## v1.0.2 · 2026-05-27 — 多手机号一键绑定

- `extract-phones.py` 从所有 sheet 扫每位会员手机号（多值数组）
- 41 个号码、覆盖 36/37 会员（王骁 3 个 / 陈威全 2 个 / 潘佳瑜 2 个 / 邓礼睿 2 个）
- 云函数 bindByPhone 支持 `users.phones[]` 数组任一命中
- import-v2.js 写 phones 数组到云端
- commits: `e390b6b`

## v1.0.1 · 2026-05-25 — 手机号绑定 + 名单去重

- auth 页加大蓝按钮「用微信手机号一键绑定」(open-type=getPhoneNumber)
- 云函数 bindByPhone：解 phone code → match users.phone → 绑定 openid
- 名单改用云端 listBindable，每个账户只能被一个微信绑定一次
- 文案社区化 10 条（个人档案→成长档案/成长节点→一起走过/活动亮点→高光时刻 等）
- 我的页菜单合并：删除重复的"我的成长地图"项
- commits: `eb57c5d`

## v1.0.0 · 2026-05-25 — 首版上传

- 36 位会员档案 + 31 场活动
- 微信登录 + adminOpenIds 白名单 + 工作人员 staff 集合
- 提审准备：内容安全 msgSecCheck / 隐私政策页 / 诚实游客态
- commits: `9de7ba3`

---

## 重大数据修复事件

### 2026-05-27 — 活动参与者 uid remap
- 根因：rebuild 后会员 userId 从 `pdf2025-*` 变 `mn-*`，但 activities.participants 没跟上
- 修复：`remap-activity-uids.py` 把所有老 pdf2025-* uid 映射到当前 master uid
- 影响：73 changed / 219 unchanged / 59 dropped（dropped 都是已过滤的老会员）
- 验证：艾佳宁武夷山等"消失的活动"恢复正常

### 2026-05-27 — 现届会员定义修正
- 错误规则："理事 + 2022+加入"导致王骁(Sean) 自己被过滤掉
- 用户反馈：sheet6 才是真正的"2025-2026 年度名单"（34 人）
- 修正：sheet6 + 5 创始理事 = 37 active
- 影响：从 36 人 → 37 人，含全部老理事

### 2026-05-27 — 出席数据全员审计
- `audit-attendance.py` / `audit-per-member.py` 对照源 xlsx
- 修补 1 处遗漏：郑州缺达美欣
- 最终：31 活动 / 293 出席，37/37 会员数据 100% 匹配源

### 2026-05-28 — 27 条 mock 残留数据清理
- 早期 mock 模式留下的 dataType=mock 用户没被清理
- 导致 listBindable 混入老 sean 用户、绑定列表 61 人异常
- 清理工具：云函数 `cleanupMockUsers`（仅 Sean openid 可调）

---

## 提审与发版

| 版本 | 上传时间 | 状态 |
|------|---------|------|
| v1.0.0 | 2026-05-25 | 上传 |
| v1.0.1 - v1.0.8 | 持续迭代 | 各次小版本 |
| 正式审核 | 未提交 | 等待 Sean 完成 ICP 备案 + 隐私指引 |

详见 `docs/REVIEW-SUBMISSION.md`。

---

## 跨重大决策

| 时间 | 决策 |
|------|------|
| 2026-04-16 | 不迁移主体（保留 Sean 个人主体 wx2d60e117f613f2be），仅让杨三角公众号关联现有小程序 |
| 2026-04-17 | 数据来源以 Sean 提供的官方 xlsx 为准，不再用 PDF 海报反推 |
| 2026-05-27 | 现届定义以 sheet6 为准（34 人 + 5 创始理事 = 37） |
| 2026-05-28 | 分享功能暂时关闭，等待审核通过后恢复 |

---

## 未来路线

详见 `HANDOVER.md` §11。重点：
1. 完成 ICP 备案 + 隐私指引 → 提审
2. 审核通过 → `TEST_BYPASS_AUTH=false` + 恢复 onShareAppMessage
3. 学校/公司清洗的边缘 case 打磨（旧金山大学金融专业等）
4. 后续大量新会员加入时考虑大模型增强相似度
