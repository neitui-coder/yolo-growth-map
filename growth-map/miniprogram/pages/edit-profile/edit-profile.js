var app = getApp();

function isOperatorMode() {
  return !!(app.globalData && (
    app.globalData.operatorModeActive ||
    app.globalData.godViewEnabled ||
    app.globalData.operatorMode ||
    app.globalData.currentUserRole === 'operator'
  ));
}

Page({
  data: {
    userId: '',
    name: '',
    motto: '',
    career: '',
    company: '',
    selectedCities: [],
    cityOptions: ['上海','北京','深圳','杭州','成都','广州','苏州','南京','武汉','厦门'],
    birthday: '',
    education: '',
    goal: '',
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
    var isOwner = userId === app.globalData.currentUserId;
    this.setData({ userId: userId });

    if (!isOwner && !isOperatorMode()) {
      wx.showToast({ title: '仅本人或运营团队可编辑', icon: 'none' });
      wx.navigateBack();
    } else {
      this._loadUserData(userId);
    }
  },

  _loadUserData: function (userId) {
    var user = app.getUser(userId);
    if (!user) return;

    var mbtiIndex = this.data.mbtiOptions.indexOf(user.mbti || '');
    var zodiacIndex = this.data.zodiacOptions.indexOf(user.zodiac || '');

    this.setData({
      name: user.name || '',
      motto: user.motto || '',
      career: user.career || '',
      company: user.company || '',
      selectedCities: Array.isArray(user.city) ? user.city : (user.city ? [user.city] : []),
      birthday: user.birthday || '',
      education: user.education || '',
      goal: user.goal || '',
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

  onCityTap: function (e) {
    var city = e.currentTarget.dataset.city;
    var selected = this.data.selectedCities.slice();
    var idx = selected.indexOf(city);
    if (idx !== -1) {
      selected.splice(idx, 1);
    } else {
      if (selected.length >= 3) {
        wx.showToast({ title: '最多选择3个城市', icon: 'none' });
        return;
      }
      selected.push(city);
    }
    this.setData({ selectedCities: selected });
  },

  onMbtiChange: function (e) {
    this.setData({ mbtiIndex: parseInt(e.detail.value) });
  },

  onBirthdayChange: function (e) {
    this.setData({ birthday: e.detail.value });
  },

  onZodiacChange: function (e) {
    this.setData({ zodiacIndex: parseInt(e.detail.value) });
  },

  onSubmit: function () {
    var user = app.getUser(this.data.userId);
    if (!user) return;

    user.name = this.data.name.trim();
    user.motto = this.data.motto.trim();
    user.career = this.data.career.trim();
    user.company = this.data.company.trim();
    user.city = this.data.selectedCities.length > 0 ? this.data.selectedCities : [];
    user.birthday = this.data.birthday;
    user.education = this.data.education.trim();
    user.goal = this.data.goal.trim() || null;

    if (this.data.mbtiIndex >= 0) {
      user.mbti = this.data.mbtiOptions[this.data.mbtiIndex];
    } else {
      user.mbti = '';
    }

    if (this.data.zodiacIndex >= 0) {
      user.zodiac = this.data.zodiacOptions[this.data.zodiacIndex];
    } else {
      user.zodiac = '';
    }

    user.hobbies = this._splitToArray(this.data.hobbiesStr);
    user.expertise = this._splitToArray(this.data.expertiseStr);
    user.tags = this._splitToArray(this.data.tagsStr);
    user.skills = this._splitToArray(this.data.skillsStr);

    // 异步同步到云端（乐观更新，先导航返回）
    wx.cloud.callFunction({
      name: 'yoloFunctions',
      data: {
        type: 'updateUser',
        userId: this.data.userId,
        dataType: app.globalData.dataType,
        updates: {
          name: user.name,
          motto: user.motto,
          career: user.career,
          company: user.company,
          city: user.city,
          birthday: user.birthday,
          education: user.education,
          goal: user.goal,
          mbti: user.mbti,
          zodiac: user.zodiac,
          hobbies: user.hobbies,
          expertise: user.expertise,
          tags: user.tags,
          skills: user.skills
        }
      },
      fail: function (err) { console.error('updateUser profile sync failed', err); }
    });

    wx.showToast({ title: '已保存', icon: 'success' });
    wx.navigateBack();
  },

  _splitToArray: function (str) {
    if (!str || !str.trim()) return [];
    return str.split(/[,，]/).map(function (s) { return s.trim(); }).filter(function (s) { return s; });
  }
});
