var util = require('../../utils/util.js');

Component({
  /**
   * member-card: 会员方块卡片
   * 显示头像、名字、MBTI、格言、标签、成长值、加入天数
   * 可选排名徽章
   */
  properties: {
    user: {
      type: Object,
      value: {}
    },
    rank: {
      type: Number,
      value: 0
    },
    showRank: {
      type: Boolean,
      value: false
    },
    isBirthday: {
      type: Boolean,
      value: false
    }
  },

  data: {
    avatarUrl: '',
    avatarInitial: '',
    daysSince: 0,
    yearsSince: 0,
    growthValue: 0,
    cityDisplay: '',
    isLishi: false,
    displayBirthday: false,
    birthdayClass: ''
  },

  lifetimes: {
    attached: function () {
      this._avatarFailed = false;
      this._avatarRetried = false;
      this._computeData(this.data.user);
      // 订阅媒体缓存更新：prefetch 解析完成后把 cloud:// 升级为可显示的临时 URL
      var that = this;
      this._onMediaCache = function () {
        if (that._avatarFailed) return;
        var user = that.data.user;
        if (user && user.avatarImage) {
          var url = util.getAvatarUrl(user, 60);
          if (url && url !== that.data.avatarUrl) that.setData({ avatarUrl: url });
        }
      };
      try {
        var app = getApp();
        if (app && app.onMediaCacheUpdated) app.onMediaCacheUpdated(this._onMediaCache);
      } catch (e) {}
    },
    detached: function () {
      try {
        var app = getApp();
        if (app && app.offMediaCacheUpdated && this._onMediaCache) {
          app.offMediaCacheUpdated(this._onMediaCache);
        }
      } catch (e) {}
    }
  },

  observers: {
    'user,isBirthday': function (user) {
      this._avatarFailed = false;
      this._avatarRetried = false;
      this._computeData(user || this.data.user);
    }
  },

  methods: {
    _computeData: function (user) {
      if (!user || !user.name) return;
      var cityDisplay = '';
      if (user.city) {
        cityDisplay = util.normalizeCityName(Array.isArray(user.city) ? user.city[0] : user.city);
      }
      var isLishi = util.isFoundingDirector(user);
      var displayBirthday = !!(this.data.isBirthday || user.isBirthdayMonth);
      this.setData({
        avatarUrl: util.getAvatarUrl(user, 60),
        avatarInitial: util.getAvatarInitial(user),
        daysSince: util.daysSince(user),
        yearsSince: util.yearsSince(user),
        growthValue: util.computeGrowthValue(user),
        cityDisplay: cityDisplay,
        isLishi: isLishi,
        displayBirthday: displayBirthday,
        birthdayClass: displayBirthday ? 'is-birthday' : ''
      });
    },

    // 头像加载失败：强制重新解析一次临时 URL；仍失败则退回名字首字（不缓存空头像）
    onAvatarError: function () {
      var that = this;
      var user = this.data.user;
      var fileID = user && user.avatarImage;
      if (!fileID || this._avatarRetried) {
        this._avatarFailed = true;
        this.setData({ avatarUrl: '' });
        return;
      }
      this._avatarRetried = true;
      var app = getApp();
      if (app && app.refreshMediaUrl) {
        app.refreshMediaUrl(fileID, function (url) {
          if (url) {
            that.setData({ avatarUrl: url });
          } else {
            that._avatarFailed = true;
            that.setData({ avatarUrl: '' });
          }
        });
      } else {
        this._avatarFailed = true;
        this.setData({ avatarUrl: '' });
      }
    },

    onCardTap: function () {
      var user = this.data.user;
      this.triggerEvent('cardtap', { userId: user.userId || user.id });
    },

    onGrowthTap: function (e) {
      var user = this.data.user;
      this.triggerEvent('growthtap', { userId: user.userId || user.id });
    }
  }
});
