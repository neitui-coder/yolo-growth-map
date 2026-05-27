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
    }
  },

  data: {
    avatarUrl: '',
    daysSince: 0,
    yearsSince: 0,
    growthValue: 0,
    cityDisplay: '',
    isLishi: false
  },

  lifetimes: {
    attached: function () {
      this._computeData(this.data.user);
    }
  },

  observers: {
    'user': function (user) {
      this._computeData(user);
    }
  },

  methods: {
    _computeData: function (user) {
      if (!user || !user.name) return;
      var cityDisplay = '';
      if (user.city) {
        // 多个城市只取第一个
        var raw = Array.isArray(user.city) ? user.city[0] : user.city;
        cityDisplay = (raw || '').split(/[、,，;；/]/)[0].trim();
      }
      var isLishi = !!(user.yoloRole && user.yoloRole.indexOf('理事') !== -1);
      this.setData({
        avatarUrl: util.getAvatarUrl(user, 60),
        daysSince: util.daysSince(user),
        yearsSince: util.yearsSince(user),
        growthValue: util.computeGrowthValue(user),
        cityDisplay: cityDisplay,
        isLishi: isLishi
      });
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
