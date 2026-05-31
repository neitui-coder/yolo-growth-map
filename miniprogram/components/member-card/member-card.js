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
      this._computeData(this.data.user);
    }
  },

  observers: {
    'user,isBirthday': function (user) {
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
