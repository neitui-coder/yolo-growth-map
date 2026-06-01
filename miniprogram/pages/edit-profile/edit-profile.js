var app = getApp();
var util = require('../../utils/util.js');

function isOperatorMode() {
  return !!(app.globalData && (
    app.globalData.operatorModeActive ||
    app.globalData.godViewEnabled ||
    app.globalData.operatorMode ||
    app.globalData.currentUserRole === 'operator'
  ));
}

function normalizeMbti(value) {
  var raw = (value || '').toString().trim().toUpperCase();
  var match = raw.match(/[IE][NS][FT][JP]/);
  return match ? match[0] : raw;
}

Page({
  data: {
    pageLoading: true,
    submitting: false,
    userId: '',
    name: '',
    motto: '',
    career: '',
    company: '',
    city: '',
    birthday: '',
    education: '',
    eduSchool1: '',
    eduMajor1: '',
    eduSchool2: '',
    eduMajor2: '',
    goal: '',
    gallupStr: '',
    hobbiesStr: '',
    expertiseStr: '',
    tagsStr: '',
    skillsStr: '',
    mbtiOptions: [
      'INTJ', 'INTP', 'ENTJ', 'ENTP',
      'INFJ', 'INFP', 'ENFJ', 'ENFP',
      'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
      'ISTP', 'ISFP', 'ESTP', 'ESFP'
    ],
    mbtiIndex: -1,
    zodiacOptions: [
      '白羊座', '金牛座', '双子座', '巨蟹座',
      '狮子座', '处女座', '天秤座', '天蝎座',
      '射手座', '摩羯座', '水瓶座', '双鱼座'
    ],
    zodiacIndex: -1
  },

  onLoad: function (options) {
    var userId = options.userId || app.globalData.currentUserId;
    var canEdit = app.canEditUserProfile
      ? app.canEditUserProfile(userId)
      : (userId === app.globalData.currentUserId && !(app.isGuestMode && app.isGuestMode()));
    this.setData({ userId: userId });

    if (!canEdit && !isOperatorMode()) {
      wx.showToast({ title: '仅本人或运营团队可编辑', icon: 'none' });
      wx.navigateBack();
    } else {
      this._loadUserData(userId);
    }
  },

  _loadUserData: function (userId) {
    var that = this;
    var user = app.getUser(userId);
    if (!user && app.ensureAllUsersLoaded && !app.globalData.allUsersLoaded) {
      app.ensureAllUsersLoaded(function () {
        that._loadUserData(userId);
      });
      return;
    }
    if (!user && wx.cloud) {
      wx.cloud.callFunction({
        name: 'yoloFunctions',
        data: {
          type: 'getUser',
          userId: userId,
          dataType: app.globalData.dataType
        }
      }).then(function (res) {
        var r = res && res.result;
        if (!r || !r.success || !r.data) {
          wx.showToast({ title: '没有找到资料', icon: 'none' });
          that.setData({ pageLoading: false });
          return;
        }
        var normalized = app._normalizeUsers ? app._normalizeUsers([r.data])[0] : r.data;
        app.globalData.users = app._mergeUsers
          ? app._mergeUsers([normalized])
          : (app.globalData.users || []).concat([normalized]);
        that._loadUserData(userId);
      }).catch(function () {
        wx.showToast({ title: '资料加载失败', icon: 'none' });
        that.setData({ pageLoading: false });
      });
      return;
    }
    if (!user) {
      wx.showToast({ title: '没有找到资料', icon: 'none' });
      this.setData({ pageLoading: false });
      return;
    }

    var mbtiIndex = this.data.mbtiOptions.indexOf(normalizeMbti(user.mbti));
    var zodiacValue = user.zodiac || util.deriveZodiacFromBirthday(user.birthday) || '';
    var zodiacIndex = this.data.zodiacOptions.indexOf(zodiacValue);

    this.setData({
      pageLoading: false,
      name: user.name || '',
      motto: user.motto || '',
      career: user.career || '',
      company: user.company || '',
      city: Array.isArray(user.city) ? (user.city[0] || '') : (user.city || ''),
      birthday: user.birthday || '',
      education: user.education || '',
      eduSchool1: (this._eduEntries(user.education)[0] || {}).school || '',
      eduMajor1: (this._eduEntries(user.education)[0] || {}).major || '',
      eduSchool2: (this._eduEntries(user.education)[1] || {}).school || '',
      eduMajor2: (this._eduEntries(user.education)[1] || {}).major || '',
      goal: user.goal || '',
      gallupStr: (user.gallup || []).join(','),
      hobbiesStr: (user.hobbies || []).join(','),
      expertiseStr: (user.expertise || []).join(','),
      tagsStr: (user.tags || []).join(','),
      skillsStr: (user.skills || []).join(','),
      mbtiIndex: mbtiIndex >= 0 ? mbtiIndex : -1,
      zodiacIndex: zodiacIndex >= 0 ? zodiacIndex : -1
    });
  },

  onInput: function (e) {
    var field = e.currentTarget.dataset.field;
    var obj = {};
    obj[field] = e.detail.value;
    this.setData(obj);
  },


  onMbtiChange: function (e) {
    this.setData({ mbtiIndex: parseInt(e.detail.value) });
  },

  onBirthdayChange: function (e) {
    var zodiacValue = util.deriveZodiacFromBirthday(e.detail.value);
    var zodiacIndex = this.data.zodiacOptions.indexOf(zodiacValue);
    this.setData({
      birthday: e.detail.value,
      zodiacIndex: zodiacIndex >= 0 ? zodiacIndex : this.data.zodiacIndex
    });
  },

  onZodiacChange: function (e) {
    this.setData({ zodiacIndex: parseInt(e.detail.value) });
  },

  onSubmit: function () {
    var user = app.getUser(this.data.userId);
    if (!user || this.data.submitting) return;

    var updates = this._buildUpdates();
    this.setData({ submitting: true });
    wx.cloud.callFunction({
      name: 'yoloFunctions',
      data: {
        type: 'updateUser',
        userId: this.data.userId,
        dataType: app.globalData.dataType,
        updates: updates
      },
      success: function (res) {
        if (res && res.result && res.result.success) {
          Object.keys(updates).forEach(function (key) {
            user[key] = updates[key];
          });
          wx.showToast({ title: '已保存', icon: 'success' });
          setTimeout(function () { wx.navigateBack(); }, 400);
        } else {
          this.setData({ submitting: false });
          wx.showModal({
            title: '保存失败',
            content: (res && res.result && res.result.error) || '云端返回异常，请重试',
            showCancel: false
          });
        }
      }.bind(this),
      fail: function (err) {
        this.setData({ submitting: false });
        console.error('updateUser profile sync failed', err);
        wx.showModal({
          title: '保存失败',
          content: (err && err.errMsg) || '网络异常，请重试',
          showCancel: false
        });
      }.bind(this)
    });
  },

  _buildUpdates: function () {
    var motto = this.data.motto.trim();
    return {
      name: this.data.name.trim(),
      motto: motto,
      mottoSource: motto ? 'member-edited' : '',
      career: this.data.career.trim(),
      company: this.data.company.trim(),
      city: (this.data.city || '').trim(),
      birthday: this.data.birthday,
      education: this._composeEducation(),
      goal: this.data.goal.trim() || null,
      mbti: this.data.mbtiIndex >= 0 ? this.data.mbtiOptions[this.data.mbtiIndex] : '',
      zodiac: this.data.zodiacIndex >= 0
        ? this.data.zodiacOptions[this.data.zodiacIndex]
        : (util.deriveZodiacFromBirthday(this.data.birthday) || ''),
      gallup: this._splitToArray(this.data.gallupStr).slice(0, 5),
      hobbies: this._splitToArray(this.data.hobbiesStr).slice(0, 10),
      expertise: this._splitToArray(this.data.expertiseStr),
      tags: this._splitToArray(this.data.tagsStr),
      skills: this._splitToArray(this.data.skillsStr)
    };
  },

  _splitToArray: function (str) {
    if (!str || !str.trim()) return [];
    var seen = {};
    return str.split(/[,，、;；\n]+/)
      .map(function (s) { return s.trim(); })
      .filter(function (s) {
        if (!s || seen[s]) return false;
        seen[s] = true;
        return true;
      });
  },

  // 把已有教育字符串解析成最多两段 {school, major}（用于编辑预填）
  _eduEntries: function (edu) {
    if (!edu) return [];
    var s = String(edu).replace(/(本科|研究生|硕士|博士|MBA|PhD)\s*[：:]/g, '｜');
    var segs = s.split(/[｜\n]+|\s{2,}/).map(function (x) { return x.trim(); }).filter(Boolean);
    return segs.map(function (seg) {
      var m = seg.match(/^(.*?(?:大学|学院|学系|学校))\s*(.*)$/);
      if (m) return { school: m[1].trim(), major: (m[2] || '').trim() };
      var sp = seg.match(/^(\S+)\s+(.+)$/);
      if (sp) return { school: sp[1].trim(), major: sp[2].trim() };
      return { school: seg, major: '' };
    });
  },

  // 把两段(学校,专业)组合成 education 字符串，用双空格分隔，便于展示端 splitEducationTags 拆词条
  _composeEducation: function () {
    var d = this.data;
    var entries = [[d.eduSchool1, d.eduMajor1], [d.eduSchool2, d.eduMajor2]];
    var parts = [];
    entries.forEach(function (e) {
      var s = (e[0] || '').trim(), m = (e[1] || '').trim();
      if (s || m) parts.push([s, m].filter(Boolean).join('  '));
    });
    return parts.join('  ');
  }
});
