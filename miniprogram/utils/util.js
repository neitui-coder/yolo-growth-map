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
 * 加入 YOLO 的实际年数（向下取整，至少 1 年；累计 joinPeriods 所有段）
 * 这是 Sean 要求的展示格式："加入YOLO X 年"
 */
function yearsSince(user) {
  var days = daysSince(user);
  if (!days) return 0;
  var years = Math.floor(days / 365.25);
  return years < 1 ? 1 : years;
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
    try {
      var app = getApp && getApp();
      if (app && app.getMediaUrl) {
        var resolved = app.getMediaUrl(user.avatarImage);
        if (resolved) return resolved;
      }
    } catch (e) {}
    return user.avatarImage;
  }
  // 无真实头像 → 返回空字符串，组件层用"名字首字"占位
  return '';
}

function getAvatarInitial(user) {
  var name = (user && user.name) || '';
  return name ? name.slice(0, 1) : '?';
}

function normalizeCityName(value) {
  if (!value) return '';

  var text = String(value)
    .replace(/\s+/g, '')
    .replace(/[—–－]/g, '-')
    .trim();
  if (!text) return '';

  text = text.split(/[、,，;；/]/)[0].trim();
  if (!text) return '';

  var countries = [
    '中国大陆', '中国', '美国', '英国', '加拿大', '澳大利亚', '日本', '韩国',
    '法国', '德国', '新加坡', '阿联酋', '沙特'
  ];
  var provinces = [
    '浙江', '江苏', '广东', '福建', '山东', '河南', '河北', '湖南', '湖北',
    '四川', '陕西', '山西', '安徽', '江西', '广西', '云南', '贵州', '辽宁',
    '吉林', '黑龙江', '海南', '甘肃', '青海', '内蒙古', '宁夏', '新疆', '西藏'
  ];
  var municipalities = ['上海', '北京', '天津', '重庆'];

  var parts = text.split('-').filter(Boolean);
  if (text.indexOf('-') !== -1 && parts.length > 0) {
    var first = parts[0];
    var last = parts[parts.length - 1];
    if (municipalities.indexOf(first) !== -1) {
      text = first;
    } else if (countries.indexOf(first) !== -1 || provinces.indexOf(first) !== -1) {
      text = last;
    } else {
      text = last || first;
    }
  }

  countries.forEach(function (prefix) {
    if (text.indexOf(prefix) === 0 && text.length > prefix.length) {
      text = text.slice(prefix.length);
    }
  });

  provinces.forEach(function (prefix) {
    if (text.indexOf(prefix) === 0 && text.length > prefix.length) {
      text = text.slice(prefix.length);
    }
  });

  if (countries.indexOf(text) !== -1 || provinces.indexOf(text) !== -1) {
    return '';
  }

  return text;
}

function normalizeCityList(value) {
  var rawList = Array.isArray(value) ? value : String(value || '').split(/[、,，;；/]/);
  var seen = {};
  var result = [];
  rawList.forEach(function (item) {
    var city = normalizeCityName(item);
    if (city && !seen[city]) {
      seen[city] = true;
      result.push(city);
    }
  });
  return result;
}

function normalizeHobbyName(value) {
  if (!value) return '';
  var text = String(value)
    .replace(/\s+/g, ' ')
    .replace(/[∶﹕]/g, '：')
    .replace(/[（(]\s*/g, '（')
    .replace(/\s*[)）]/g, '）')
    .trim();
  if (!text) return '';

  var directMap = {
    '喜欢听歌': '听歌',
    '看篮球赛': '篮球',
    '看 YouTube': 'YouTube',
    '看YouTube': 'YouTube',
    '尤其是 cba': 'CBA',
    '尤其是cba': 'CBA',
    '自己也是体育赛事相关的博主': '体育赛事',
    '运动（户外': '户外运动',
    '露营）': '露营',
    '硬核露营': '露营',
    '马术（感兴趣）': '马术',
    '橄榄球（业余橄榄球队）': '橄榄球',
    '看书（毛选）': '看书',
    '看电影（剧情类）': '看电影',
    '动画片': '动画',
    '玩游戏': '游戏',
    '打游戏': '游戏',
    '单机游戏': '游戏',
    '看艺术展': '看展',
    '旅游': '旅行',
    '自驾游': '自驾',
    '做美食': '美食',
    '做饭': '做饭',
    '煮饭': '做饭',
    '弹钢琴': '钢琴',
    '打篮球': '篮球',
    '打网球': '网球',
    '骑自行车': '骑行',
    '看赛车': '赛车',
    '爱好音乐': '音乐'
  };
  if (directMap[text]) return directMap[text];

  var categoryPrefixes = [
    '极限运动', '二次元相关', '接触新东西', '运动', '体育', '户外活动',
    '户外运动', '球类运动', '球类', '艺术', '音乐', '影音', '影视'
  ];
  var colonIndex = text.indexOf('：');
  if (colonIndex > 0) {
    var prefix = text.slice(0, colonIndex);
    var rest = text.slice(colonIndex + 1).trim();
    if (rest && categoryPrefixes.indexOf(prefix) !== -1) {
      text = rest;
    }
  }

  if (directMap[text]) return directMap[text];
  return text.replace(/^偶尔/, '').trim();
}

function splitKnownHobbyTokens(text) {
  var compact = String(text || '').replace(/\s+/g, '');
  var known = [
    'YouTube', '羽毛球', '高尔夫', '橄榄球', '篮球', '足球', '网球',
    '攀岩', '滑雪', '手游', '漫画书', '漫展', '影视', '阅读',
    '看展', '露营', '徒步'
  ];
  var found = known
    .map(function (token) {
      return { token: token, index: compact.indexOf(token) };
    })
    .filter(function (item) {
      return item.index !== -1;
    })
    .sort(function (a, b) {
      return a.index - b.index;
    })
    .map(function (item) {
      return item.token;
    });
  return found.length >= 2 ? found : [];
}

function normalizeHobbyList(value) {
  var rawList = Array.isArray(value) ? value : String(value || '').split(/[、,，;；/]/);
  var seen = {};
  var result = [];

  function pushItem(item) {
    var normalized = normalizeHobbyName(item);
    if (!normalized) return;
    var knownTokens = splitKnownHobbyTokens(normalized);
    if (knownTokens.length) {
      knownTokens.forEach(pushItem);
      return;
    }
    if (!seen[normalized]) {
      seen[normalized] = true;
      result.push(normalized);
    }
  }

  rawList.forEach(function (item) {
    var text = String(item || '').trim();
    var shouldKeepWhole =
      /^尤其是/i.test(text) ||
      /^看\s*YouTube$/i.test(text) ||
      /^自己也是/.test(text) ||
      text.indexOf('：') !== -1 ||
      text.indexOf('∶') !== -1;
    (shouldKeepWhole ? [text] : text.split(/\s{1,}|[|｜]/))
      .filter(Boolean)
      .forEach(pushItem);
  });
  return result;
}

var CURRENT_DIRECTOR_IDS = {
  'pdf2025-katherine': true,
  'pdf2025-bill': true,
  'pdf2025-rachel': true,
  'pdf2025-yueyue': true,
  'pdf2025-jingzi': true,
  'mn-18025': true,
  'pdf2025-wenxin': true
};

// Source: YOLO+2026年会员成长档案资料收集.xlsx, category = "创始理事".
var FOUNDING_DIRECTOR_IDS = {
  'pdf2025-bill': true,
  'pdf2025-yueyue': true,
  'pdf2025-rachel': true,
  'pdf2025-katherine': true
};

var HISTORICAL_DIRECTOR_IDS = {
  'alumni-ruixiang': true,
  'pdf2025-sarah': true,
  'pdf2025-p09': true
};

function getUserStableId(user) {
  return (user && (user.userId || user.id || (user.identity && user.identity.userId))) || '';
}

function isCurrentDirector(user) {
  if (!user) return false;

  var userId = getUserStableId(user);
  if (CURRENT_DIRECTOR_IDS[userId]) return true;
  if (HISTORICAL_DIRECTOR_IDS[userId]) return false;
  if (user.memberStatus === 'alumni') return false;

  var role = String(
    user.yoloRole ||
      (user.community && user.community.role) ||
      ''
  ).trim();
  if (!role || role.indexOf('理事') === -1) return false;

  if (/20\d{2}\s*年度.*理事/.test(role) || /20\d{2}年度.*理事/.test(role)) {
    return false;
  }
  if (/^\d{4}年?度?理事/.test(role)) {
    return false;
  }

  return (
    role === '理事' ||
    role.indexOf('理事/') === 0 ||
    role.indexOf('/理事') !== -1 ||
    role.indexOf('初创理事') !== -1 ||
    role.indexOf('常务理事') !== -1 ||
    role.indexOf('成为理事') !== -1
  );
}

function isFoundingDirector(user) {
  return !!(user && FOUNDING_DIRECTOR_IDS[getUserStableId(user)]);
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
// 相似度归一化小工具
function _favNorm(s) {
  return String(s == null ? '' : s)
    .replace(/[《》「」『』“”"'，,。.\s·、!！~?？:：;；()（）]/g, '')
    .toLowerCase();
}

function _flattenFavorites(user) {
  var groups = buildFavoriteGroups(user) || [];
  var out = [];
  groups.forEach(function (g) {
    (g.items || []).forEach(function (it) {
      var n = _favNorm(it);
      if (n) out.push({ raw: it, norm: n });
    });
  });
  return out;
}

function _mbti4(value) {
  var m = String(value || '').toUpperCase().match(/[IE][NS][FT][JP]/);
  return m ? m[0] : '';
}

function computeSimilarity(userA, userB) {
  return computeSimilarityBreakdown(userA, userB).score;
}

// 综合相似度：不再让 MBTI 一家独大。MBTI 按维度部分计分，叠加城市/盖洛普/爱好/
// 趣味共鸣（同一首歌/书/游戏等高信号）/星座/加入年份。computeSimilarity 复用此结果。
function computeSimilarityBreakdown(userA, userB) {
  var score = 0;
  var reasons = [];
  var breakdown = [];

  // MBTI：逐维度匹配，每维 +0.6（四维全同=2.4），避免"同 MBTI 直接霸榜"
  var mA = _mbti4(userA.mbti), mB = _mbti4(userB.mbti);
  if (mA && mB) {
    var shared = 0;
    for (var k = 0; k < 4; k++) { if (mA[k] === mB[k]) shared++; }
    if (shared > 0) {
      var mpts = Math.round(shared * 0.6 * 100) / 100;
      score += mpts;
      if (shared === 4) {
        reasons.push('同为 ' + mA);
        breakdown.push({ label: 'MBTI', points: mpts, detail: '同为 ' + mA });
      } else {
        breakdown.push({ label: 'MBTI', points: mpts, detail: 'MBTI ' + shared + '/4 维相同 (' + mA + '·' + mB + ')' });
      }
    }
  }

  // 城市同城
  if (userA.city && userB.city) {
    var citiesA = normalizeCityList(userA.city);
    var citiesB = normalizeCityList(userB.city);
    for (var i = 0; i < citiesA.length; i++) {
      if (citiesB.indexOf(citiesA[i]) !== -1) {
        score += 2;
        reasons.push('都在' + citiesA[i]);
        breakdown.push({ label: '城市', points: 2, detail: '都在' + citiesA[i] });
        break;
      }
    }
  }

  // 盖洛普天赋（性格核心维度）
  var commonGallup = [];
  if (Array.isArray(userA.gallup) && Array.isArray(userB.gallup)) {
    userA.gallup.forEach(function (g) {
      if (userB.gallup.indexOf(g) !== -1) commonGallup.push(g);
    });
  }
  if (commonGallup.length) {
    var gpts = Math.round(commonGallup.length * 1.2 * 100) / 100;
    score += gpts;
    reasons.push('同有「' + commonGallup.slice(0, 2).join('、') + '」天赋');
    breakdown.push({ label: '盖洛普', points: gpts, detail: '共同天赋：' + commonGallup.join('、') });
  }

  // 爱好
  var commonHobbies = [];
  var hobbiesA = normalizeHobbyList(userA.hobbies || []);
  var hobbiesB = normalizeHobbyList(userB.hobbies || []);
  if (hobbiesA.length && hobbiesB.length) {
    hobbiesA.forEach(function (h) {
      if (hobbiesB.indexOf(h) !== -1) commonHobbies.push(h);
    });
  }
  if (commonHobbies.length > 0) {
    var hpts = Math.round(commonHobbies.length * 1.2 * 100) / 100;
    score += hpts;
    reasons.push('都爱' + commonHobbies.slice(0, 2).join('、'));
    breakdown.push({ label: '爱好', points: hpts, detail: '共同爱好：' + commonHobbies.join('、') });
  }

  // 趣味共鸣（同一本书/同一首歌/同一部电影/同一款游戏…高信号"缘分"）
  var favA = _flattenFavorites(userA);
  var favB = _flattenFavorites(userB);
  if (favA.length && favB.length) {
    var bset = {};
    favB.forEach(function (f) { bset[f.norm] = true; });
    var commonFav = [];
    var seenFav = {};
    favA.forEach(function (f) {
      if (bset[f.norm] && !seenFav[f.norm]) { seenFav[f.norm] = true; commonFav.push(f.raw); }
    });
    if (commonFav.length) {
      var fpts = Math.round(commonFav.length * 1.5 * 100) / 100;
      score += fpts;
      reasons.push('都喜欢' + commonFav.slice(0, 2).join('、'));
      breakdown.push({ label: '趣味共鸣', points: fpts, detail: '都喜欢：' + commonFav.join('、') });
    }
  }

  // 技能
  var commonSkills = [];
  if (userA.skills && userB.skills) {
    userA.skills.forEach(function (s) {
      if (userB.skills.indexOf(s) !== -1) commonSkills.push(s);
    });
  }
  if (commonSkills.length > 0) {
    score += commonSkills.length;
    reasons.push('同持' + commonSkills.slice(0, 2).join('、'));
    breakdown.push({ label: '技能', points: commonSkills.length, detail: '共同技能：' + commonSkills.join('、') });
  }

  // 星座
  var zA = userA.zodiac || deriveZodiacFromBirthday(userA.birthday);
  var zB = userB.zodiac || deriveZodiacFromBirthday(userB.birthday);
  if (zA && zB && zA === zB) {
    score += 0.8;
    breakdown.push({ label: '星座', points: 0.8, detail: '同为' + zA });
  }

  // 加入年份相近
  if (userA.joinDate && userB.joinDate) {
    var ya = parseInt(userA.joinDate.split('-')[0]);
    var yb = parseInt(userB.joinDate.split('-')[0]);
    if (Math.abs(ya - yb) <= 1) {
      score += 0.6;
      breakdown.push({ label: '加入时间', points: 0.6, detail: '加入年份相差不超过 1 年' });
    }
  }

  return {
    score: Math.round(score * 100) / 100,
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

  // 只有月份格式："6月" 或 "6"
  var monthOnly = String(birthday).match(/^(\d{1,2})月?$/);
  if (monthOnly) {
    var m = parseInt(monthOnly[1], 10);
    if (m >= 1 && m <= 12) return { month: m, day: null };
  }

  return null;
}

function getZodiacByMonthDay(month, day) {
  if (!month) return '';
  var d = day || 15;
  var ranges = [
    { name: '水瓶座', start: [1, 20], end: [2, 18] },
    { name: '双鱼座', start: [2, 19], end: [3, 20] },
    { name: '白羊座', start: [3, 21], end: [4, 19] },
    { name: '金牛座', start: [4, 20], end: [5, 20] },
    { name: '双子座', start: [5, 21], end: [6, 21] },
    { name: '巨蟹座', start: [6, 22], end: [7, 22] },
    { name: '狮子座', start: [7, 23], end: [8, 22] },
    { name: '处女座', start: [8, 23], end: [9, 22] },
    { name: '天秤座', start: [9, 23], end: [10, 23] },
    { name: '天蝎座', start: [10, 24], end: [11, 22] },
    { name: '射手座', start: [11, 23], end: [12, 21] },
    { name: '摩羯座', start: [12, 22], end: [1, 19] }
  ];
  for (var i = 0; i < ranges.length; i++) {
    var r = ranges[i];
    var start = r.start[0] * 100 + r.start[1];
    var end = r.end[0] * 100 + r.end[1];
    var value = month * 100 + d;
    if (start <= end) {
      if (value >= start && value <= end) return r.name;
    } else if (value >= start || value <= end) {
      return r.name;
    }
  }
  return '';
}

function deriveZodiacFromBirthday(birthday) {
  var parsed = parseBirthday(birthday);
  if (!parsed || !parsed.month) return '';
  return getZodiacByMonthDay(parsed.month, parsed.day);
}

function isBirthdayInCurrentMonth(user, now) {
  var parsed = parseBirthday(user && user.birthday);
  var current = now || new Date();
  if (!parsed) return false;
  return parsed.month === current.getMonth() + 1;
}

function buildFunnyIntro(user) {
  var options = buildFunnyIntroOptions(user);
  if (!options.length) return '';
  var seed = getFunnyIntroSeed(user);
  return options[seed % options.length];
}

function getFunnyIntroSeed(user) {
  return String((user && (user.userId || user.id || user.name)) || '').split('').reduce(function (sum, ch) {
    return sum + ch.charCodeAt(0);
  }, 0);
}

function buildFunnyIntroOptions(user) {
  if (!user) return [];

  var city = normalizeCityName(Array.isArray(user.city) ? user.city[0] : (user.city || ''));
  var normalizedHobbies = normalizeHobbyList(user.hobbies || []);
  var genericHobbyWords = { '看': true, '玩': true, '吃': true };
  var usefulHobbies = normalizedHobbies.filter(function (item) {
    return item && !genericHobbyWords[item] && String(item).length > 1;
  });
  var hobby = usefulHobbies[0] || normalizedHobbies[0] || '';
  var hobby2 = usefulHobbies[1] || normalizedHobbies[1] || '';
  var gallups = (user.gallup || []).filter(Boolean);
  var gallup = gallups[0] || '';
  var mbti = user.mbti || '';
  var career = user.career || '';
  var company = user.company || '';
  var education = user.education || '';

  function shortField(value, maxLen) {
    var text = Array.isArray(value) ? value.join('；') : String(value || '');
    text = text
      .replace(/\s+/g, ' ')
      .replace(/^\d+月(初|中|底)?计划/, '')
      .replace(/^计划/, '')
      .replace(/[（(].*$/, '')
      .split(/[；;、,，/]/)[0]
      .replace(/有限公司$/, '')
      .replace(/股份有限公司$/, '')
      .replace(/数字科技$/, '')
      .replace(/数据科技$/, '')
      .trim();
    if (!text) return '';
    if (/^[A-Za-z ]+$/.test(text)) return text.split(' ')[0];
    text = text.replace(/\s+/g, '');
    return text.length > maxLen ? text.slice(0, maxLen) : text;
  }

  var careerLabel = shortField(career, 8);
  var companyLabel = shortField(company, 8);
  var educationLabel = shortField(education, 8);
  var candidates = [];

  function add(text) {
    text = String(text || '').trim();
    if (!text) return;
    if (/抬高\s*3\s*度|气氛组|灵魂续费/.test(text)) return;
    candidates.push(text);
  }

  if (careerLabel && hobby) {
    add(careerLabel + '和' + hobby + '来回切换，主打认真但不太安分。');
  }
  if (mbti && gallup) {
    add(mbti + '遇上“' + gallup + '”，做事像开了个人任务面板。');
  }
  if (city && hobby) {
    add(city + '出没，' + hobby + '雷达常年在线，遇到同好会自动亮灯。');
  }
  if (gallup && hobby) {
    add('“' + gallup + '”优势加持，连' + hobby + '都像被排进小计划。');
  }
  if (careerLabel && mbti) {
    add(mbti + '的' + careerLabel + '选手，理性在线，脑内弹幕也不少。');
  }
  if (companyLabel && hobby2) {
    add(companyLabel + '之外，还给' + hobby2 + '留了固定档期。');
  }
  if (educationLabel && hobby) {
    add('履历走正经路线，兴趣清单负责把' + hobby + '这面露出来。');
  }
  if (hobby && hobby2) {
    add(hobby + '和' + hobby2 + '双持，休息方式看起来也挺忙。');
  }
  if (city && (mbti || gallup)) {
    add(city + '版' + (mbti || gallup) + '，看着低调，配置其实不简单。');
  }
  if (careerLabel || companyLabel) {
    add((careerLabel || companyLabel) + '只是表面身份，细看还有不少隐藏副本。');
  }
  if (mbti) {
    add(mbti + '选手一枚，日常大概率自带一套内心操作系统。');
  }
  if (hobby) {
    add('资料里最抢戏的是' + hobby + '，像是随时能展开一条支线。');
  }
  if (!candidates.length) {
    add('资料还不多，但已经能看出这位不是标准模板用户。');
  }

  var seen = {};
  var unique = candidates.filter(function (text) {
      text = String(text || '').trim();
      if (!text || seen[text]) return false;
      seen[text] = true;
      return true;
    });
  if (!unique.length) return [];
  var offset = getFunnyIntroSeed(user) % unique.length;
  return unique.slice(offset).concat(unique.slice(0, offset)).slice(0, 5);
}

// 趣味档案：富字段分类元数据（书籍/作家/影视/音乐/吃喝/游戏/冒险/童年梦想/童年动画/下一站）
var FAVORITE_META = [
  { key: 'books', emoji: '📚', label: '书籍' },
  { key: 'authors', emoji: '✍️', label: '作家' },
  { key: 'filmsTv', emoji: '🎬', label: '影视' },
  { key: 'music', emoji: '🎵', label: '音乐' },
  { key: 'foodDrink', emoji: '🍜', label: '吃喝' },
  { key: 'games', emoji: '🎮', label: '游戏' },
  { key: 'adventure', emoji: '🪂', label: '想试的冒险' },
  { key: 'childhoodDream', emoji: '🌟', label: '小时候的梦想' },
  { key: 'childhoodCartoon', emoji: '📺', label: '童年动画' },
  { key: 'nextTravel', emoji: '✈️', label: '下一站' }
];

function buildFavoriteGroups(user) {
  var fav = (user && user.favorites) || {};
  var groups = [];
  FAVORITE_META.forEach(function (meta) {
    var items = fav[meta.key];
    if (Array.isArray(items)) {
      items = items
        .map(function (s) { return String(s == null ? '' : s).trim(); })
        .filter(function (s) { return !!s; });
      if (items.length) {
        groups.push({ key: meta.key, emoji: meta.emoji, label: meta.label, items: items });
      }
    }
  });
  return groups;
}

module.exports = {
  daysSince: daysSince,
  buildFavoriteGroups: buildFavoriteGroups,
  yearsSince: yearsSince,
  formatDate: formatDate,
  getAvatarInitial: getAvatarInitial,
  normalizeCityName: normalizeCityName,
  normalizeCityList: normalizeCityList,
  normalizeHobbyName: normalizeHobbyName,
  normalizeHobbyList: normalizeHobbyList,
  isCurrentDirector: isCurrentDirector,
  isFoundingDirector: isFoundingDirector,
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
  getZodiacByMonthDay: getZodiacByMonthDay,
  deriveZodiacFromBirthday: deriveZodiacFromBirthday,
  isBirthdayInCurrentMonth: isBirthdayInCurrentMonth,
  buildFunnyIntro: buildFunnyIntro,
  buildFunnyIntroOptions: buildFunnyIntroOptions
};
