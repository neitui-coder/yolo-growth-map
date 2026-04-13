const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  switch (event.type) {
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
  const where = { userId: userId };
  if (dataType) where.dataType = dataType;
  const result = await db.collection('users')
    .where(where)
    .update({ data: updates });
  return { success: true, updated: result.stats.updated };
};

// 按 _id 更新单条记录
const updateById = async (event) => {
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
  const node = Object.assign({}, event.node);
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
  const where = { userId: userId };
  if (dataType) where.dataType = dataType;
  const result = await db.collection('users')
    .where(where)
    .update({ data: { nodes: _.splice(index, 1) } });
  return { success: true, updated: result.stats.updated };
};

// 添加提问到 qa 数组
const addQuestion = async (event) => {
  const { userId, question, askedBy, dataType } = event;
  const newQa = { question: question, answer: null, askedBy: askedBy || 'anonymous' };
  const where = { userId: userId };
  if (dataType) where.dataType = dataType;
  const result = await db.collection('users')
    .where(where)
    .update({
      data: {
        qa: _.push(newQa)
      }
    });
  return { success: true, updated: result.stats.updated };
};

// 回答某个问题（按 qa 数组索引更新）
const answerQuestion = async (event) => {
  const { userId, index, answer, dataType } = event;
  const updateKey = 'qa.' + index + '.answer';
  const updateData = {};
  updateData[updateKey] = answer;
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

  let removed = 0;
  while (true) {
    const result = await db.collection('users')
      .where({ dataType: dataType })
      .limit(100)
      .get();

    if (!result.data.length) {
      break;
    }

    for (let i = 0; i < result.data.length; i++) {
      await db.collection('users').doc(result.data[i]._id).remove();
      removed++;
    }
  }

  let added = 0;
  for (let i = 0; i < users.length; i++) {
    await db.collection('users').add({ data: users[i] });
    added++;
  }

  return { success: true, removed: removed, added: added, dataType: dataType };
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
