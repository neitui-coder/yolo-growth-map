var app = getApp();
var util = require('../../utils/util.js');

function favNorm(s) {
  return String(s == null ? '' : s).replace(/[《》「」『』“”"'，,。.\s·、!！~?？:：;；()（）]/g, '').toLowerCase();
}

function topList(counter, n) {
  return Object.keys(counter)
    .map(function (k) { return { name: k, count: counter[k] }; })
    .sort(function (a, b) { return b.count - a.count; })
    .slice(0, n);
}

function computeStats(users) {
  var members = (users || []).filter(function (u) {
    return u && u.dataType === 'real' && u.memberStatus === 'active';
  });
  var total = members.length;

  // MBTI I/E + 分布
  var I = 0, E = 0, mbti = {};
  members.forEach(function (u) {
    var t = String(u.mbti || '').toUpperCase();
    if (/^[IE][NS][FT][JP]$/.test(t)) {
      t[0] === 'I' ? I++ : E++;
      mbti[t] = (mbti[t] || 0) + 1;
    }
  });
  var ieTotal = I + E || 1;

  // 爱好（规范化合并）
  var hob = {};
  members.forEach(function (u) {
    util.normalizeHobbyList(u.hobbies || []).forEach(function (h) { hob[h] = (hob[h] || 0) + 1; });
  });

  // 盖洛普
  var gallup = {};
  members.forEach(function (u) { (u.gallup || []).forEach(function (g) { gallup[g] = (gallup[g] || 0) + 1; }); });

  // 城市
  var city = {};
  members.forEach(function (u) {
    var c = Array.isArray(u.city) ? u.city[0] : u.city;
    c = util.normalizeCityName ? util.normalizeCityName(c) : c;
    if (c) city[c] = (city[c] || 0) + 1;
  });

  // 星座
  var zod = {};
  members.forEach(function (u) {
    var z = u.zodiac || (util.deriveZodiacFromBirthday ? util.deriveZodiacFromBirthday(u.birthday) : '');
    if (z) zod[z] = (zod[z] || 0) + 1;
  });

  // 缘分时刻：跨成员共享的具体最爱（同一首歌/书/电影/游戏/旅行地）
  var favCats = ['music', 'books', 'filmsTv', 'games', 'nextTravel', 'foodDrink', 'authors'];
  var catEmoji = { music: '🎵', books: '📚', filmsTv: '🎬', games: '🎮', nextTravel: '✈️', foodDrink: '🍜', authors: '✍️' };
  var serendipity = [];
  favCats.forEach(function (cat) {
    var map = {};
    members.forEach(function (u) {
      var arr = (u.favorites && u.favorites[cat]) || [];
      arr.forEach(function (it) {
        var k = favNorm(it);
        if (!k) return;
        if (!map[k]) map[k] = { raw: it, names: [] };
        if (map[k].names.indexOf(u.name) === -1) map[k].names.push(u.name);
      });
    });
    Object.keys(map).forEach(function (k) {
      if (map[k].names.length >= 2) {
        serendipity.push({ emoji: catEmoji[cat], text: map[k].raw, names: map[k].names.join('、'), count: map[k].names.length });
      }
    });
  });
  serendipity.sort(function (a, b) { return b.count - a.count; });

  function withPct(list) {
    var max = list.length ? list[0].count : 1;
    return list.map(function (x) { return { name: x.name, count: x.count, pct: Math.round(x.count / max * 100) }; });
  }

  return {
    total: total,
    ePct: Math.round(E / ieTotal * 100),
    iPct: Math.round(I / ieTotal * 100),
    eCount: E, iCount: I,
    mbtiTop: withPct(topList(mbti, 6)),
    hobbyTop: withPct(topList(hob, 8)),
    gallupTop: withPct(topList(gallup, 6)),
    cityTop: withPct(topList(city, 6)),
    zodiacTop: withPct(topList(zod, 6)),
    serendipity: serendipity.slice(0, 12)
  };
}

Page({
  data: {
    loading: true,
    stats: null,
    navPaddingTop: 20
  },

  onLoad: function () {
    var that = this;
    this.setData({ navPaddingTop: (app.globalData.statusBarHeight || 20) + 8 });
    function render() {
      that.setData({ stats: computeStats(app.globalData.users || []), loading: false });
    }
    if (app.ensureAllUsersLoaded && !app.globalData.allUsersLoaded) {
      app.ensureAllUsersLoaded(render);
    } else {
      render();
    }
  },

  onMemberTap: function () {
    wx.switchTab({ url: '/pages/index/index' });
  }
});
