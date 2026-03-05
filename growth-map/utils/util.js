/**
 * 工具函数集 - 从 HTML 原型提取
 */

/**
 * 计算从指定日期到现在的天数
 * @param {string} dateStr - 格式 "YYYY-MM"
 * @returns {number} 天数
 */
function daysSince(dateStr) {
  var d = new Date(dateStr + '-01');
  return Math.floor((new Date() - d) / (1000 * 60 * 60 * 24));
}

/**
 * 将 "YYYY-MM" 格式化为 "YYYY年M月"
 * @param {string} dateStr - 格式 "YYYY-MM"
 * @returns {string} 格式化后的日期
 */
function formatDate(dateStr) {
  var parts = dateStr.split('-');
  return parts[0] + '年' + parseInt(parts[1]) + '月';
}

/**
 * 计算用户成长值
 * 规则：每个节点 100 分 + 每个技能 50 分
 * @param {Object} user - 用户对象
 * @returns {number} 成长值
 */
function computeGrowthValue(user) {
  return user.nodes.length * 100 + user.skills.length * 50;
}

/**
 * 计算用户导师数量
 * 规则：节点数和 3 取较小值
 * @param {Object} user - 用户对象
 * @returns {number} 导师数量
 */
function computeMentors(user) {
  return Math.min(user.nodes.length, 3);
}

/**
 * 获取 DiceBear 头像 URL
 * @param {Object} user - 用户对象（需要 avatarStyle 和 avatarSeed 字段）
 * @param {number} size - 头像尺寸，默认 80
 * @returns {string} 头像 URL
 */
function getAvatarUrl(user, size) {
  size = size || 80;
  var style = user.avatarStyle || 'fun-emoji';
  var seed = encodeURIComponent(user.avatarSeed || user.name);
  return 'https://api.dicebear.com/7.x/' + style + '/svg?seed=' + seed + '&size=' + size;
}

module.exports = {
  daysSince: daysSince,
  formatDate: formatDate,
  computeGrowthValue: computeGrowthValue,
  computeMentors: computeMentors,
  getAvatarUrl: getAvatarUrl
};
