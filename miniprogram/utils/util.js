/**
 * 工具函数集 - 与 HTML 原型完全一致
 */

/**
 * 计算从指定日期到现在的天数
 * 如果用户有 joinPeriods，计算所有段的天数总和；否则 fallback 到 joinDate
 * @param {string|Object} dateStrOrUser - 格式 "YYYY-MM" 或用户对象
 * @returns {number} 天数
 */
function daysSince(dateStrOrUser) {
  // 支持传入用户对象（含 joinPeriods）
  if (dateStrOrUser && typeof dateStrOrUser === 'object' && dateStrOrUser.joinPeriods) {
    var periods = dateStrOrUser.joinPeriods;
    var total = 0;
    var now = new Date();
    for (var p = 0; p < periods.length; p++) {
      var period = periods[p];
      var start = new Date(period.start + '-01');
      var end = period.end ? new Date(period.end + '-01') : now;
      total += Math.floor((end - start) / (1000 * 60 * 60 * 24));
    }
    return total;
  }
  // fallback: 传入 dateStr 字符串，或用户对象但没有 joinPeriods
  var dateStr = (typeof dateStrOrUser === 'string') ? dateStrOrUser : (dateStrOrUser && dateStrOrUser.joinDate) || '';
  if (!dateStr) return 0;
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
 * 计算用户成长值（与 HTML 原型 growthVal 函数完全一致）
 * 规则：
 *   基础资料: 每个已填字段 +5，上限 50
 *   技能标签: 每个 +5，上限 30
 *   年度目标: +20
 *   成长节点: 每个 +15，无上限
 *   节点配图: 每张 +3，每节点上限 9
 *   爱好+专长: 每项 +3，上限 30
 *   问答回答: 每个已回答 +10，上限 50
 * @param {Object} user - 用户对象
 * @returns {number} 成长值
 */
function computeGrowthValue(user) {
  var val = 0;

  // 基础资料: 每个已填字段 +5，上限 50
  var profileFields = [user.name, user.motto, user.mbti, user.city, user.career, user.company, user.education, user.zodiac, user.wechat, user.birthday];
  var filledCount = 0;
  for (var i = 0; i < profileFields.length; i++) {
    if (profileFields[i] && String(profileFields[i]).trim()) {
      filledCount++;
    }
  }
  val += Math.min(filledCount * 5, 50);

  // 技能标签: 每个 +5，上限 30
  val += Math.min((user.skills || []).length * 5, 30);

  // 年度目标: +20
  if (user.goal) val += 20;

  // 成长节点: 每个 +15，无上限
  val += (user.nodes || []).length * 15;

  // 节点配图: 每张 +3，每节点上限 9
  var nodes = user.nodes || [];
  for (var j = 0; j < nodes.length; j++) {
    val += Math.min((nodes[j].images || []).length * 3, 9);
  }

  // 爱好+专长: 每项 +3，上限 30
  val += Math.min(((user.hobbies || []).length + (user.expertise || []).length) * 3, 30);

  // 问答回答: 每个已回答 +10，上限 50
  var qaAnswered = 0;
  var qa = user.qa || [];
  for (var k = 0; k < qa.length; k++) {
    if (qa[k].answer) qaAnswered++;
  }
  val += Math.min(qaAnswered * 10, 50);

  return val;
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
  if (user && user.avatarImage && String(user.avatarImage).trim()) {
    return user.avatarImage;
  }
  var style = user.avatarStyle || 'adventurer-neutral';
  var seed = encodeURIComponent(user.avatarSeed || user.name);
  return 'https://api.dicebear.com/7.x/' + style + '/svg?seed=' + seed + '&size=' + size;
}

/**
 * 计算用户资料完善度（与 HTML 原型 profileCompleteness 一致）
 * @param {Object} user - 用户对象
 * @returns {number} 完善度百分比 (0-100)
 */
function profileCompleteness(user) {
  var fields = [user.name, user.motto, user.mbti, user.city, user.career, user.company, user.education, user.zodiac, user.birthday];
  var filled = 0;
  for (var i = 0; i < fields.length; i++) {
    if (fields[i] && String(fields[i]).trim()) filled++;
  }
  var arrFields = [
    (user.hobbies || []).length > 0,
    (user.skills || []).length > 0,
    (user.expertise || []).length > 0,
    (user.tags || []).length > 0,
    user.goal
  ];
  var arrFilled = 0;
  for (var j = 0; j < arrFields.length; j++) {
    if (arrFields[j]) arrFilled++;
  }
  return Math.round(((filled + arrFilled) / (fields.length + arrFields.length)) * 100);
}

/**
 * 获取缺失字段列表（与 HTML 原型 getMissingFields 一致）
 * @param {Object} user - 用户对象
 * @returns {Array<string>} 缺失字段名列表（最多3个）
 */
function getMissingFields(user) {
  var checks = [
    [user.motto, '格言'], [user.mbti, 'MBTI'], [user.city, '城市'], [user.career, '职业'],
    [user.company, '公司'], [user.education, '教育背景'], [user.zodiac, '星座'], [user.birthday, '生日'],
    [(user.hobbies || []).length > 0, '爱好'], [(user.skills || []).length > 0, '技能认证']
  ];
  var missing = [];
  for (var i = 0; i < checks.length; i++) {
    var v = checks[i][0];
    var name = checks[i][1];
    if (!v || (typeof v === 'string' && !v.trim())) {
      missing.push(name);
      if (missing.length >= 3) break;
    }
  }
  return missing;
}

/**
 * 计算两个用户的相似度
 * 同 MBTI +3，同城市 +2（支持多城市），相同爱好每个 +1，相同技能每个 +1，加入时间差1年内 +1
 */
function computeSimilarity(userA, userB) {
  var score = 0;
  if (userA.mbti && userB.mbti && userA.mbti === userB.mbti) score += 3;
  if (userA.city && userB.city) {
    var citiesA = Array.isArray(userA.city) ? userA.city : [userA.city];
    var citiesB = Array.isArray(userB.city) ? userB.city : [userB.city];
    for (var i = 0; i < citiesA.length; i++) {
      if (citiesB.indexOf(citiesA[i]) !== -1) { score += 2; break; }
    }
  }
  if (userA.hobbies && userB.hobbies) {
    userA.hobbies.forEach(function (h) {
      if (userB.hobbies.indexOf(h) !== -1) score += 1;
    });
  }
  if (userA.skills && userB.skills) {
    userA.skills.forEach(function (s) {
      if (userB.skills.indexOf(s) !== -1) score += 1;
    });
  }
  if (userA.joinDate && userB.joinDate) {
    var ya = parseInt(userA.joinDate.split('-')[0]);
    var yb = parseInt(userB.joinDate.split('-')[0]);
    if (Math.abs(ya - yb) <= 1) score += 1;
  }
  return score;
}

function computeSimilarityBreakdown(userA, userB) {
  var score = 0;
  var reasons = [];
  var breakdown = [];

  if (userA.mbti && userB.mbti && userA.mbti === userB.mbti) {
    score += 3;
    reasons.push('同为 ' + userA.mbti);
    breakdown.push({ label: 'MBTI', points: 3, detail: '同为 ' + userA.mbti });
  }

  if (userA.city && userB.city) {
    var citiesA = Array.isArray(userA.city) ? userA.city : [userA.city];
    var citiesB = Array.isArray(userB.city) ? userB.city : [userB.city];
    for (var i = 0; i < citiesA.length; i++) {
      if (citiesB.indexOf(citiesA[i]) !== -1) {
        score += 2;
        reasons.push('都在' + citiesA[i]);
        breakdown.push({ label: '城市', points: 2, detail: '都在' + citiesA[i] });
        break;
      }
    }
  }

  var commonHobbies = [];
  if (userA.hobbies && userB.hobbies) {
    userA.hobbies.forEach(function (h) {
      if (userB.hobbies.indexOf(h) !== -1) {
        score += 1;
        commonHobbies.push(h);
      }
    });
  }
  if (commonHobbies.length > 0) {
    reasons.push('都爱' + commonHobbies.slice(0, 2).join('、'));
    breakdown.push({ label: '爱好', points: commonHobbies.length, detail: '共同爱好：' + commonHobbies.join('、') });
  }

  var commonSkills = [];
  if (userA.skills && userB.skills) {
    userA.skills.forEach(function (s) {
      if (userB.skills.indexOf(s) !== -1) {
        score += 1;
        commonSkills.push(s);
      }
    });
  }
  if (commonSkills.length > 0) {
    reasons.push('同持' + commonSkills.slice(0, 2).join('、'));
    breakdown.push({ label: '技能', points: commonSkills.length, detail: '共同技能：' + commonSkills.join('、') });
  }

  if (userA.joinDate && userB.joinDate) {
    var ya = parseInt(userA.joinDate.split('-')[0]);
    var yb = parseInt(userB.joinDate.split('-')[0]);
    if (Math.abs(ya - yb) <= 1) {
      score += 1;
      breakdown.push({ label: '加入时间', points: 1, detail: '加入年份相差不超过 1 年' });
    }
  }

  return {
    score: score,
    reasons: reasons,
    breakdown: breakdown
  };
}

/**
 * 找到与目标用户最相似的 N 个用户
 */
function findSimilarUsers(targetUser, allUsers, count) {
  count = count || 3;
  var targetId = targetUser.id || targetUser.userId;
  return allUsers
    .filter(function (u) { return (u.id || u.userId) !== targetId; })
    .map(function (u) {
      var detail = computeSimilarityBreakdown(targetUser, u);
      return { user: u, score: detail.score, detail: detail };
    })
    .sort(function (a, b) { return b.score - a.score; })
    .slice(0, count)
    .filter(function (item) { return item.score > 0; });
}

function isFieldVisible(user, fieldKey) {
  if (!user || !fieldKey) return true;
  if (!user.visibility) return true;
  return user.visibility[fieldKey] !== false;
}

function parseBirthday(birthday) {
  if (!birthday) return null;

  var fullDate = String(birthday).match(/^\d{4}-(\d{1,2})-(\d{1,2})$/);
  if (fullDate) {
    return {
      month: parseInt(fullDate[1], 10),
      day: parseInt(fullDate[2], 10)
    };
  }

  var monthDay = String(birthday).match(/(\d{1,2})月(\d{1,2})日/);
  if (monthDay) {
    return {
      month: parseInt(monthDay[1], 10),
      day: parseInt(monthDay[2], 10)
    };
  }

  var iso = String(birthday).match(/(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return {
      month: parseInt(iso[1], 10),
      day: parseInt(iso[2], 10)
    };
  }

  return null;
}

function isBirthdayInCurrentMonth(user, now) {
  var parsed = parseBirthday(user && user.birthday);
  var current = now || new Date();
  if (!parsed) return false;
  return parsed.month === current.getMonth() + 1;
}

function buildFunnyIntro(user) {
  if (!user) return '';

  var city = Array.isArray(user.city) ? user.city[0] : (user.city || '');
  var hobby = (user.hobbies || [])[0] || '';
  var gallup = (user.gallup || [])[0] || '';
  var mbti = user.mbti || '';
  var career = user.career || user.company || '';
  var seed = String(user.userId || user.name || '').split('').reduce(function (sum, ch) {
    return sum + ch.charCodeAt(0);
  }, 0);

  var templates = [
    function () {
      return (city || 'YOLO+') + '常驻气氛组，表面淡定，实际上随时准备把聊天热度抬高 3 度。';
    },
    function () {
      return (career || '这位会员') + '白天认真营业，晚上大概率靠' + (hobby || '兴趣爱好') + '给灵魂续费。';
    },
    function () {
      return (mbti || '神秘人格') + '选手一枚，擅长把普通日常过成带一点剧情反转的版本。';
    },
    function () {
      return gallup
        ? '盖洛普主打“' + gallup + '”，翻译成人话就是：这位同学很难把日子过得无聊。'
        : '资料还在继续长肉，但气质已经先一步写着“这人应该挺有梗”。';
    },
    function () {
      return (city || '这位会员') + (city ? '出没' : '') + '，大概率能把' + (hobby || '日常') + '聊成一场带笑点的深夜长谈。';
    }
  ];

  return templates[seed % templates.length]();
}

module.exports = {
  daysSince: daysSince,
  formatDate: formatDate,
  computeGrowthValue: computeGrowthValue,
  computeMentors: computeMentors,
  getAvatarUrl: getAvatarUrl,
  profileCompleteness: profileCompleteness,
  getMissingFields: getMissingFields,
  computeSimilarity: computeSimilarity,
  computeSimilarityBreakdown: computeSimilarityBreakdown,
  findSimilarUsers: findSimilarUsers,
  isFieldVisible: isFieldVisible,
  parseBirthday: parseBirthday,
  isBirthdayInCurrentMonth: isBirthdayInCurrentMonth,
  buildFunnyIntro: buildFunnyIntro
};
