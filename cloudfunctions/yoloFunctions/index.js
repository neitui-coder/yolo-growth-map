const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const ADMIN_OPENIDS = ['oR4Gr5AfM4rgKhFwd6HsK7QWDNG0'];
const MEMBER_STATUSES = ['active', 'alumni'];
const PROFILE_UPDATE_FIELDS = [
  'name', 'motto', 'mottoSource', 'career', 'company', 'city', 'birthday',
  'education', 'goal', 'mbti', 'zodiac', 'gallup', 'hobbies', 'expertise',
  'tags', 'skills', 'visibility', 'avatarStyle', 'avatarSeed', 'avatarImage',
  'aiFunnyIntro', 'aiFunnyIntroVersion', 'aiFunnyIntroSourceKey',
  'aiFunnyIntroVariantIndex'
];

const isAdminOpenId = (openId) => ADMIN_OPENIDS.indexOf(openId) !== -1;

const isYoloMemberStatus = (status) => MEMBER_STATUSES.indexOf(status || 'active') !== -1;

const allKeysAllowed = (keys, allowed) => keys.every((key) => allowed.indexOf(key) !== -1);

const buildUserUpdateData = (updates) => {
  const data = Object.assign({}, updates || {});
  if (Object.prototype.hasOwnProperty.call(data, 'visibility')) {
    const visibility = data.visibility && typeof data.visibility === 'object' ? data.visibility : {};
    data.visibility = _.set(visibility);
  }
  return data;
};

const pickBoundMember = (rows) => {
  const members = (rows || [])
    .filter((u) => u.dataType === 'real' && isYoloMemberStatus(u.memberStatus))
    .sort((a, b) => {
      if (a.memberStatus === b.memberStatus) return 0;
      return a.memberStatus === 'active' ? -1 : 1;
    });
  return members[0] || null;
};

const getWechatBoundRows = async (openId, unionId) => {
  if (!openId) return [];
  const query = unionId
    ? _.or([{ wechatOpenId: openId }, { wechatUnionId: unionId }])
    : { wechatOpenId: openId };
  const res = await db.collection('users').where(query).limit(20).get();
  return res.data || [];
};

const getAuthenticatedMember = async () => {
  const { OPENID, UNIONID } = cloud.getWXContext();
  const rows = await getWechatBoundRows(OPENID, UNIONID);
  return pickBoundMember(rows);
};

const canEditOwnProfile = (actor, userId) => {
  return !!(actor && actor.userId === userId && isYoloMemberStatus(actor.memberStatus));
};

const canManageOwnTimeline = (actor, userId) => {
  return !!(actor && actor.userId === userId && actor.memberStatus !== 'alumni');
};

const ensureTimelineWriteAllowed = async (userId) => {
  const { OPENID } = cloud.getWXContext();
  if (isAdminOpenId(OPENID)) return { ok: true };
  const actor = await getAuthenticatedMember();
  if (canManageOwnTimeline(actor, userId)) return { ok: true };
  return { ok: false, error: '无权维护成长节点' };
};

const fetchRealUsers = async () => {
  const users = [];
  let cursor = 0;
  while (true) {
    const res = await db.collection('users')
      .where({ dataType: 'real' })
      .skip(cursor)
      .limit(100)
      .get();
    const rows = res.data || [];
    users.push(...rows);
    if (rows.length < 100) break;
    cursor += rows.length;
  }
  return users;
};

// 内容安全检查（微信审核硬性要求：UGC 文本须过 msgSecCheck）
// 返回 { ok:true } 或 { ok:false, error:'...' }
const checkTextSecurity = async (texts) => {
  const { OPENID } = cloud.getWXContext();
  const list = (Array.isArray(texts) ? texts : [texts])
    .filter((t) => typeof t === 'string' && t.trim().length > 0);
  if (!list.length) return { ok: true };
  const content = list.join('\n').slice(0, 2500);
  try {
    const res = await cloud.openapi.security.msgSecCheck({
      version: 2,
      scene: 2, // 资料文本
      openid: OPENID,
      content
    });
    const suggest = res && res.result && res.result.suggest;
    if (suggest === 'risky') {
      return { ok: false, error: '内容包含违规信息，请修改后重试' };
    }
    return { ok: true };
  } catch (e) {
    // 接口异常（如未配置）不阻断正常用户，但记录
    console.warn('msgSecCheck failed, allow through:', e && e.errMsg);
    return { ok: true };
  }
};

exports.main = async (event, context) => {
  switch (event.type) {
    // --- wechat auth ---
    case 'loginWechat':     return await loginWechat(event);
    case 'bindWechat':      return await bindWechat(event);
    case 'bindByPhone':     return await bindByPhone(event);
    case 'listBindable':    return await listBindable(event);
    case 'cleanupMockUsers': return await cleanupMockUsers(event);
    case 'addStaff':        return await addStaff(event);
    case 'removeStaff':     return await removeStaff(event);
    case 'listStaff':       return await listStaff(event);
    // --- activities ---
    case 'getActivities':   return await getActivities(event);
    case 'seedActivities':  return await seedActivities(event);
    case 'getUserProfile':  return await getUserProfile(event);
    // --- node by id ---
    case 'deleteNodeById':  return await deleteNodeById(event);
    case 'updateNodeById':  return await updateNodeById(event);
    // --- existing (unchanged) ---
    case 'seedData':      return await seedData(event);
    case 'getUsers':      return await getUsers(event);
    case 'getUser':       return await getUser(event);
    case 'updateUser':    return await updateUser(event);
    case 'addNode':       return await addNode(event);
    case 'deleteNode':    return await deleteNode(event);
    case 'addQuestion':   return await addQuestion(event);
    case 'answerQuestion': return await answerQuestion(event);
    case 'toggleLike':    return await toggleLike(event);
    case 'addComment':    return await addComment(event);
    case 'addUsers':      return await addUsers(event);
    case 'replaceUsersByDataType': return await replaceUsersByDataType(event);
    case 'bulkSetDataType': return await bulkSetDataType(event);
    case 'updateById':    return await updateById(event);
    default: return { success: false, error: 'unknown type' };
  }
};

// 微信登录：通过 cloud context 取到 openId/unionid
// 1. 查 users 集合是否已绑定成员
// 2. 查 staff 集合（隐藏型工作人员白名单，view-only）
const loginWechat = async () => {
  const { OPENID, UNIONID } = cloud.getWXContext();
  if (!OPENID) return { success: false, error: 'no OPENID in context' };
  const boundRows = await getWechatBoundRows(OPENID, UNIONID);
  const boundMember = pickBoundMember(boundRows);

  let staffEntry = null;
  if (!boundMember) {
    try {
      const sq = UNIONID
        ? _.or([{ wechatOpenId: OPENID }, { wechatUnionId: UNIONID }])
        : { wechatOpenId: OPENID };
      const sr = await db.collection('staff').where(sq).limit(1).get();
      if (sr.data && sr.data[0]) {
        staffEntry = { note: sr.data[0].note || '', org: sr.data[0].org || '' };
      }
    } catch (e) {
      // staff 集合不存在等情况，静默忽略
    }
  }

  return {
    success: true,
    openId: OPENID,
    unionId: UNIONID || '',
    bound: boundMember ? {
      userId: boundMember.userId,
      name: boundMember.name,
      memberStatus: boundMember.memberStatus || 'active'
    } : null,
    staff: staffEntry
  };
};

// 一键手机号绑定：用户点 button open-type="getPhoneNumber" 得到 code，传到这里
// 我们调 openapi 解出手机号，按 users.phones[] 匹配 → 绑定 openid
//
// 规范化策略：取最后 10 位数字，自动跨国家码（86/1）匹配
//   "13261627801"           → "3261627801"  (CN)
//   "+1 (908) 568-8001"     → "9085688001"  (US, openapi 也会返回这种格式)
//   "8613261627801"         → "3261627801"  (含 86 国家码)
const normalizePhone = (p) => {
  if (!p) return '';
  const digits = String(p).replace(/\D/g, '');
  if (!digits) return '';
  return digits.slice(-10);
};

const bindByPhone = async (event) => {
  const { OPENID, UNIONID } = cloud.getWXContext();
  if (!OPENID) return { success: false, error: 'no OPENID in context' };
  if (!event.code) return { success: false, error: 'code required' };

  let phoneInfo;
  try {
    const res = await cloud.openapi.phonenumber.getPhoneNumber({ code: event.code });
    phoneInfo = res.phoneInfo || {};
  } catch (e) {
    return { success: false, error: '获取手机号失败：' + (e.errMsg || String(e)) };
  }
  const rawPhone = phoneInfo.phoneNumber || phoneInfo.purePhoneNumber || '';
  if (!rawPhone) return { success: false, error: '手机号为空' };

  const normalized = normalizePhone(rawPhone);
  if (!normalized) return { success: false, error: '手机号格式异常' };

  // 当前微信若已经绑定过现届或往届成员，直接进入该成员身份。
  const alreadyBound = pickBoundMember(await getWechatBoundRows(OPENID, UNIONID));
  if (alreadyBound) {
    return { success: true, alreadyBound: true,
      user: {
        userId: alreadyBound.userId,
        name: alreadyBound.name,
        memberStatus: alreadyBound.memberStatus || 'active'
      } };
  }

  // 匹配 YOLO+ 成员（现届或往届）：phone 单字段或 phones 数组任一规范化后命中。
  // 手机号已由微信侧验证，允许覆盖旧 openid，解决体验版/正式版或换微信后的旧绑定残留。
  const realUsers = await fetchRealUsers();
  const matches = (realUsers || []).filter((u) => {
    if (!isYoloMemberStatus(u.memberStatus)) return false;
    if (normalizePhone(u.phone) === normalized) return true;
    if (Array.isArray(u.phones) && u.phones.some((p) => normalizePhone(p) === normalized)) return true;
    return false;
  });
  matches.sort((a, b) => {
    if (a.memberStatus === b.memberStatus) return 0;
    return a.memberStatus === 'active' ? -1 : 1;
  });
  const match = matches[0];
  if (!match) {
    return {
      success: true,
      matched: false,
      phone: normalized,
      notBindable: false,
      reason: 'not_found'
    };
  }

  // 绑定
  const rebound = !!match.wechatOpenId && match.wechatOpenId !== OPENID;
  const update = { wechatOpenId: OPENID, wechatUnionId: UNIONID || '' };
  await db.collection('users').where({ userId: match.userId }).update({ data: update });

  return {
    success: true,
    matched: true,
    rebound,
    user: {
      userId: match.userId,
      name: match.name,
      memberStatus: match.memberStatus || 'active'
    }
  };
};

// 清理遗留 mock 数据（仅 admin 可调）
const cleanupMockUsers = async () => {
  const { OPENID } = cloud.getWXContext();
  const ADMIN_OPENIDS = ['oR4Gr5AfM4rgKhFwd6HsK7QWDNG0'];
  if (ADMIN_OPENIDS.indexOf(OPENID) === -1) {
    return { success: false, error: 'admin only' };
  }
  let removed = 0;
  while (true) {
    const r = await db.collection('users')
      .where({ dataType: 'mock' }).limit(100).get();
    if (!r.data.length) break;
    for (const u of r.data) {
      await db.collection('users').doc(u._id).remove();
      removed++;
    }
  }
  // 也删 dataType 为 undefined/empty 的（前期残留）
  const noType = await db.collection('users')
    .where({ dataType: _.exists(false) }).limit(100).get();
  for (const u of (noType.data || [])) {
    await db.collection('users').doc(u._id).remove();
    removed++;
  }
  return { success: true, removed };
};

// 列出可被绑定的成员（仅当前 real dataType + YOLO+ 现届/往届成员 + 尚未绑定）
const listBindable = async () => {
  const all = await fetchRealUsers();
  const bindable = (all || [])
    .filter((u) => !u.wechatOpenId && !u.wechatUnionId && isYoloMemberStatus(u.memberStatus))
    .map((u) => ({
      userId: u.userId, name: u.name, englishName: u.englishName || '',
      company: u.company || '', avatarImage: u.avatarImage || '',
      role: u.yoloRole || '',
      memberStatus: u.memberStatus || 'active'
    }));
  return { success: true, members: bindable };
};

// 管理员加 staff（限 admin openid 调用）
const addStaff = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const ADMIN_OPENIDS = ['oR4Gr5AfM4rgKhFwd6HsK7QWDNG0']; // Sean
  if (ADMIN_OPENIDS.indexOf(OPENID) === -1) {
    return { success: false, error: 'admin only' };
  }
  if (!event.openId) return { success: false, error: 'openId required' };
  try { await db.createCollection('staff'); } catch (_) {}
  // 去重
  const existing = await db.collection('staff').where({ wechatOpenId: event.openId }).limit(1).get();
  if (existing.data && existing.data[0]) {
    return { success: true, updated: 0, note: 'already exists' };
  }
  await db.collection('staff').add({
    data: {
      wechatOpenId: event.openId,
      wechatUnionId: event.unionId || '',
      note: event.note || '',
      org: event.org || '杨三角',
      addedAt: new Date(),
      addedBy: OPENID
    }
  });
  return { success: true, added: 1 };
};

const removeStaff = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const ADMIN_OPENIDS = ['oR4Gr5AfM4rgKhFwd6HsK7QWDNG0'];
  if (ADMIN_OPENIDS.indexOf(OPENID) === -1) {
    return { success: false, error: 'admin only' };
  }
  if (!event.openId) return { success: false, error: 'openId required' };
  const r = await db.collection('staff').where({ wechatOpenId: event.openId }).remove();
  return { success: true, removed: r.stats.removed };
};

const listStaff = async () => {
  const { OPENID } = cloud.getWXContext();
  const ADMIN_OPENIDS = ['oR4Gr5AfM4rgKhFwd6HsK7QWDNG0'];
  if (ADMIN_OPENIDS.indexOf(OPENID) === -1) {
    return { success: false, error: 'admin only' };
  }
  const r = await db.collection('staff').limit(100).get();
  return { success: true, staff: r.data || [] };
};

// 绑定：将当前 openId/unionid 写入指定 userId 的 users 记录
// event.userId 必填；调用者应先通过 loginWechat 确认自己是该 userId 的归属
const bindWechat = async (event) => {
  const { OPENID, UNIONID } = cloud.getWXContext();
  if (!OPENID) return { success: false, error: 'no OPENID in context' };
  if (!event.userId) return { success: false, error: 'userId required' };
  const existingMember = pickBoundMember(await getWechatBoundRows(OPENID, UNIONID));
  if (existingMember && existingMember.userId !== event.userId) {
    return { success: false, error: '该微信号已绑定其他账户: ' + existingMember.userId };
  }
  const targetRes = await db.collection('users')
    .where({ userId: event.userId, dataType: 'real' })
    .limit(1)
    .get();
  const target = targetRes.data && targetRes.data[0];
  if (!target) return { success: false, error: '成员不存在' };
  if (!isYoloMemberStatus(target.memberStatus)) {
    return { success: false, error: '该档案不是 YOLO+ 会员身份，不能绑定' };
  }
  const update = { wechatOpenId: OPENID, wechatUnionId: UNIONID || '' };
  const r = await db.collection('users')
    .where({ userId: event.userId })
    .update({ data: update });
  return { success: r.stats.updated > 0, updated: r.stats.updated, openId: OPENID };
};

// 前端传用户数据上来写入，防止重复 seed
const seedData = async (event) => {
  const users = event.users;
  if (!users || users.length === 0) {
    return { success: false, error: 'no users data' };
  }
  // 先创建集合（如果已存在会忽略错误）
  try {
    await db.createCollection('users');
  } catch (e) {
    // 集合已存在，忽略
  }
  // 检查是否已有数据，防止重复 seed
  const countResult = await db.collection('users').count();
  if (countResult.total > 0) {
    return { success: false, error: 'already seeded', count: countResult.total };
  }
  // 逐条插入（云数据库 add 不支持批量）
  for (let i = 0; i < users.length; i++) {
    await db.collection('users').add({ data: users[i] });
  }
  return { success: true, count: users.length };
};

// 获取所有用户（按 dataType 筛选，云数据库单次最多 100 条）
const getUsers = async (event) => {
  const dataType = event.dataType || 'mock';
  const page = event.page || 0;
  const pageSize = Math.min(event.pageSize || 100, 100);
  const result = await db.collection('users')
    .where({ dataType: dataType })
    .orderBy('userId', 'asc')
    .skip(page * pageSize)
    .limit(pageSize)
    .get();
  return { success: true, data: result.data };
};

// 获取单个用户（按 dataType 筛选）
const getUser = async (event) => {
  const dataType = event.dataType || 'mock';
  const result = await db.collection('users')
    .where({ userId: event.userId, dataType: dataType })
    .get();
  if (result.data.length === 0) {
    return { success: false, error: 'user not found' };
  }
  return { success: true, data: result.data[0] };
};

// 更新用户资料（按 userId + dataType 精确定位）
const updateUser = async (event) => {
  const { userId, updates, dataType } = event;
  // 资料文本内容安全检查
  const u = updates || {};
  const updateKeys = Object.keys(u);
  if (!userId) return { success: false, error: 'userId required' };
  if (!updateKeys.length) return { success: false, error: 'no updates' };

  const { OPENID } = cloud.getWXContext();
  if (!isAdminOpenId(OPENID)) {
    const actor = await getAuthenticatedMember();
    const profileOnly = allKeysAllowed(updateKeys, PROFILE_UPDATE_FIELDS);
    const qaOnly = updateKeys.length === 1 && updateKeys[0] === 'qa';
    const timelineOnly = updateKeys.length === 1 && updateKeys[0] === 'nodes';

    if (profileOnly) {
      if (!canEditOwnProfile(actor, userId)) {
        return { success: false, error: '仅档案本人可修改资料' };
      }
    } else if (qaOnly) {
      if (!canEditOwnProfile(actor, userId)) {
        return { success: false, error: '无权修改问答' };
      }
    } else if (timelineOnly) {
      if (!canManageOwnTimeline(actor, userId)) {
        return { success: false, error: '无权维护成长节点' };
      }
    } else {
      return { success: false, error: '无权修改这些字段' };
    }
  }
  const textFields = [u.name, u.motto, u.career, u.company, u.city, u.goal,
    u.education].concat(u.gallup || [], u.hobbies || [], u.expertise || [], u.tags || [], u.skills || []);
  const sec = await checkTextSecurity(textFields);
  if (!sec.ok) return { success: false, error: sec.error };
  const where = { userId: userId };
  if (dataType) where.dataType = dataType;
  const result = await db.collection('users')
    .where(where)
    .update({ data: buildUserUpdateData(updates) });
  return { success: true, updated: result.stats.updated };
};

// 按 _id 更新单条记录
const updateById = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!isAdminOpenId(OPENID)) {
    return { success: false, error: 'admin only' };
  }
  const { id, updates } = event;
  const result = await db.collection('users').doc(id).update({ data: updates });
  return { success: true, updated: result.stats.updated };
};

// 批量给所有无 dataType 的用户设置 dataType: 'mock'
const bulkSetDataType = async (event) => {
  // 云数据库 where + update 一次最多更新 1000 条
  const result = await db.collection('users')
    .where({ dataType: db.command.exists(false) })
    .update({ data: { dataType: 'mock' } });
  return { success: true, updated: result.stats.updated };
};

// 添加成长节点（插入到数组头部）；若未传 nodeId，自动生成
const addNode = async (event) => {
  const { userId, dataType } = event;
  const auth = await ensureTimelineWriteAllowed(userId);
  if (!auth.ok) return { success: false, error: auth.error };
  const node = Object.assign({}, event.node);
  const sec = await checkTextSecurity([node.desc, node.title, node.summary]);
  if (!sec.ok) return { success: false, error: sec.error };
  if (!node.nodeId) {
    node.nodeId = 'n-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  }
  const where = { userId: userId };
  if (dataType) where.dataType = dataType;
  const result = await db.collection('users')
    .where(where)
    .update({ data: { nodes: _.unshift(node) } });
  return { success: true, updated: result.stats.updated, nodeId: node.nodeId };
};

// 删除节点（按索引，使用 splice 命令）
const deleteNode = async (event) => {
  const { userId, index, dataType } = event;
  const auth = await ensureTimelineWriteAllowed(userId);
  if (!auth.ok) return { success: false, error: auth.error };
  const where = { userId: userId };
  if (dataType) where.dataType = dataType;
  const result = await db.collection('users')
    .where(where)
    .update({ data: { nodes: _.splice(index, 1) } });
  return { success: true, updated: result.stats.updated };
};

// 添加提问到 qa 数组
const addQuestion = async (event) => {
  const { userId, question, dataType } = event;
  const asker = await getAuthenticatedMember();
  if (!asker) {
    return { success: false, error: '仅 YOLO+ 会员可提问' };
  }
  if (asker.userId === userId) {
    return { success: false, error: '不能向自己提问' };
  }
  const cleanQuestion = String(question || '').trim();
  if (!cleanQuestion) return { success: false, error: '问题不能为空' };
  if (cleanQuestion.length > 120) return { success: false, error: '问题不能超过 120 字' };

  const where = { userId: userId };
  if (dataType) where.dataType = dataType;
  const targetRes = await db.collection('users').where(where).limit(1).get();
  const target = targetRes.data && targetRes.data[0];
  if (!target || !isYoloMemberStatus(target.memberStatus)) {
    return { success: false, error: '被提问对象不是 YOLO+ 会员' };
  }

  const sec = await checkTextSecurity(cleanQuestion);
  if (!sec.ok) return { success: false, error: sec.error };
  const newQa = {
    qaId: 'qa_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    question: cleanQuestion,
    answer: null,
    askedBy: '匿名会员',
    askedByUserId: asker.userId,
    askedByMemberStatus: asker.memberStatus || 'active',
    visibility: 'public',
    status: 'active',
    createdAt: Date.now()
  };
  const result = await db.collection('users')
    .where(where)
    .update({
      data: {
        qa: _.push(newQa)
      }
    });
  return { success: true, updated: result.stats.updated, qa: newQa };
};

// 回答某个问题（按 qa 数组索引更新）
const answerQuestion = async (event) => {
  const { userId, index, answer, dataType } = event;
  const { OPENID } = cloud.getWXContext();
  const actor = await getAuthenticatedMember();
  const canAnswer = isAdminOpenId(OPENID) || !!(actor && actor.userId === userId);
  if (!canAnswer) {
    return { success: false, error: '只有档案本人可回答问题' };
  }
  const qaIndex = Number(index);
  if (!Number.isInteger(qaIndex) || qaIndex < 0) {
    return { success: false, error: '问题索引无效' };
  }
  const cleanAnswer = String(answer || '').trim();
  if (!cleanAnswer) return { success: false, error: '回答不能为空' };
  if (cleanAnswer.length > 500) return { success: false, error: '回答不能超过 500 字' };
  const sec = await checkTextSecurity(cleanAnswer);
  if (!sec.ok) return { success: false, error: sec.error };
  const updateKey = 'qa.' + qaIndex + '.answer';
  const answeredAtKey = 'qa.' + qaIndex + '.answeredAt';
  const updateData = {};
  updateData[updateKey] = cleanAnswer;
  updateData[answeredAtKey] = Date.now();
  const where = { userId: userId };
  if (dataType) where.dataType = dataType;
  const result = await db.collection('users')
    .where(where)
    .update({ data: updateData });
  return { success: true, updated: result.stats.updated };
};

// 切换点赞（likes 是 userId -> bool 映射）
const toggleLike = async (event) => {
  const { userId, likerUserId, nodeKey, dataType } = event;
  const where = { userId: userId };
  if (dataType) where.dataType = dataType;
  // 先读取当前状态
  const doc = await db.collection('users')
    .where(where)
    .get();
  if (doc.data.length === 0) {
    return { success: false, error: 'user not found' };
  }
  const user = doc.data[0];
  const likes = user.likes || {};
  const key = nodeKey + '_' + likerUserId;
  const isLiked = !!likes[key];
  const updateData = {};
  if (isLiked) {
    updateData['likes.' + key] = _.remove();
  } else {
    updateData['likes.' + key] = true;
  }
  const result = await db.collection('users')
    .where(where)
    .update({ data: updateData });
  return { success: true, liked: !isLiked, updated: result.stats.updated };
};

// 添加新用户（批量，不做重复检查）
const addUsers = async (event) => {
  const users = event.users;
  if (!users || users.length === 0) {
    return { success: false, error: 'no users' };
  }
  try { await db.createCollection('users'); } catch(e) {}
  let added = 0;
  for (let i = 0; i < users.length; i++) {
    await db.collection('users').add({ data: users[i] });
    added++;
  }
  return { success: true, count: added };
};

// 替换某个 dataType 的全部用户
const replaceUsersByDataType = async (event) => {
  const dataType = event.dataType;
  const users = event.users || [];

  if (!dataType) {
    return { success: false, error: 'no dataType' };
  }

  try { await db.createCollection('users'); } catch(e) {}

  // 1. 先把现有该 dataType 的用户的微信绑定信息备份（按 userId 索引）
  // 防止 replace 后用户需要重新走绑定流程
  const bindMap = {};
  let cursor = 0;
  while (true) {
    const existing = await db.collection('users')
      .where({ dataType: dataType })
      .skip(cursor).limit(100).get();
    if (!existing.data.length) break;
    existing.data.forEach((u) => {
      if (isYoloMemberStatus(u.memberStatus) && (u.wechatOpenId || u.wechatUnionId)) {
        bindMap[u.userId] = {
          wechatOpenId: u.wechatOpenId || '',
          wechatUnionId: u.wechatUnionId || ''
        };
      }
    });
    if (existing.data.length < 100) break;
    cursor += existing.data.length;
  }

  // 2. 删除所有
  let removed = 0;
  while (true) {
    const result = await db.collection('users')
      .where({ dataType: dataType })
      .limit(100).get();
    if (!result.data.length) break;
    for (let i = 0; i < result.data.length; i++) {
      await db.collection('users').doc(result.data[i]._id).remove();
      removed++;
    }
  }

  // 3. 插入新数据，并把备份的绑定信息合并回去
  let added = 0;
  let restored = 0;
  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    const preserved = bindMap[u.userId];
    if (preserved) {
      if (preserved.wechatOpenId) u.wechatOpenId = preserved.wechatOpenId;
      if (preserved.wechatUnionId) u.wechatUnionId = preserved.wechatUnionId;
      restored++;
    }
    await db.collection('users').add({ data: u });
    added++;
  }

  return { success: true, removed, added, restoredBindings: restored, dataType };
};

// ─── activities collection ───────────────────────────────────────────────────

// 获取全部活动（上限 100 条）
const getActivities = async (event) => {
  const result = await db.collection('activities').limit(100).get();
  return { success: true, data: result.data };
};

// 替换全部活动：先删除所有，再逐条插入
const seedActivities = async (event) => {
  const activities = event.activities || [];

  try { await db.createCollection('activities'); } catch (e) {}

  let removed = 0;
  while (true) {
    const batch = await db.collection('activities').limit(100).get();
    if (!batch.data.length) break;
    for (let i = 0; i < batch.data.length; i++) {
      await db.collection('activities').doc(batch.data[i]._id).remove();
      removed++;
    }
  }

  let added = 0;
  for (let i = 0; i < activities.length; i++) {
    await db.collection('activities').add({ data: activities[i] });
    added++;
  }

  return { success: true, removed: removed, added: added };
};

// 获取用户资料并将 nodes 中的 activityKey JOIN 到活动详情
const getUserProfile = async (event) => {
  const { userId, dataType } = event;
  const where = { userId: userId };
  if (dataType) where.dataType = dataType;

  // 1. 取用户文档
  const userResult = await db.collection('users').where(where).get();
  if (!userResult.data.length) {
    return { success: false, error: 'user not found' };
  }
  const user = userResult.data[0];

  // 2. 取全部活动，建 key→doc 映射
  const actResult = await db.collection('activities').limit(100).get();
  const actMap = {};
  for (const act of actResult.data) {
    if (act.activityKey) actMap[act.activityKey] = act;
  }

  // 3. 丰富 nodes
  const enrichedNodes = (user.nodes || []).map(node => {
    if (node.activityKey && actMap[node.activityKey]) {
      const act = actMap[node.activityKey];
      // 展开活动字段，不重复 _id
      const { _id, ...actFields } = act;
      return Object.assign({}, node, actFields);
    }
    // join 类节点或无匹配 activity，原样返回
    return node;
  });

  const { nodes: _nodes, ...userFields } = user;
  return {
    success: true,
    data: Object.assign({}, userFields, { nodes: enrichedNodes })
  };
};

// ─── node by nodeId ──────────────────────────────────────────────────────────

// 按 nodeId 删除节点（找到后用 splice 删除）
const deleteNodeById = async (event) => {
  const { userId, nodeId, dataType } = event;
  const auth = await ensureTimelineWriteAllowed(userId);
  if (!auth.ok) return { success: false, error: auth.error };
  const where = { userId: userId };
  if (dataType) where.dataType = dataType;

  // 先读出用户，找到目标节点的索引
  const userResult = await db.collection('users').where(where).get();
  if (!userResult.data.length) {
    return { success: false, error: 'user not found' };
  }
  const nodes = userResult.data[0].nodes || [];
  const index = nodes.findIndex(n => n.nodeId === nodeId);
  if (index === -1) {
    return { success: false, error: 'nodeId not found' };
  }

  const result = await db.collection('users')
    .where(where)
    .update({ data: { nodes: _.splice(index, 1) } });
  return { success: true, updated: result.stats.updated, removedIndex: index };
};

// 按 nodeId 更新节点（读取→找索引→用点路径更新）
const updateNodeById = async (event) => {
  const { userId, nodeId, updates, dataType } = event;
  const auth = await ensureTimelineWriteAllowed(userId);
  if (!auth.ok) return { success: false, error: auth.error };
  const u = updates || {};
  const sec = await checkTextSecurity([u.desc, u.title, u.summary]);
  if (!sec.ok) return { success: false, error: sec.error };
  const where = { userId: userId };
  if (dataType) where.dataType = dataType;

  // 先读出用户，找到目标节点的索引
  const userResult = await db.collection('users').where(where).get();
  if (!userResult.data.length) {
    return { success: false, error: 'user not found' };
  }
  const nodes = userResult.data[0].nodes || [];
  const index = nodes.findIndex(n => n.nodeId === nodeId);
  if (index === -1) {
    return { success: false, error: 'nodeId not found' };
  }

  // 把 updates 的每个字段转成 "nodes.<index>.<field>" 点路径
  const updateData = {};
  for (const key of Object.keys(updates)) {
    updateData['nodes.' + index + '.' + key] = updates[key];
  }

  const result = await db.collection('users')
    .where(where)
    .update({ data: updateData });
  return { success: true, updated: result.stats.updated, updatedIndex: index };
};

// ─────────────────────────────────────────────────────────────────────────────

// 添加评论（comments 是 nodeKey -> 评论数组 映射）
const addComment = async (event) => {
  const { userId, nodeKey, comment, dataType } = event;
  const sec = await checkTextSecurity(
    comment && typeof comment === 'object' ? comment.text || comment.content : comment);
  if (!sec.ok) return { success: false, error: sec.error };
  const updateKey = 'comments.' + nodeKey;
  const where = { userId: userId };
  if (dataType) where.dataType = dataType;
  const result = await db.collection('users')
    .where(where)
    .update({
      data: {
        [updateKey]: _.push(comment)
      }
    });
  return { success: true, updated: result.stats.updated };
};
