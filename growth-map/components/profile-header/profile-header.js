var util = require('../../utils/util.js');

Component({
  /**
   * profile-header: 用户资料头部
   * 渐变背景，展示头像、昵称、加入天数、成长值、导师数、座右铭、技能标签
   * 如果是当前登录用户，显示头像编辑按钮
   */
  properties: {
    // 用户数据对象
    user: {
      type: Object,
      value: {}
    },
    // 是否是自己的档案
    isOwner: {
      type: Boolean,
      value: false
    }
  },

  data: {
    days: 0,
    growthValue: 0,
    mentors: 0,
    avatarUrl: ''
  },

  observers: {
    'user': function (user) {
      if (user && user.joinDate) {
        this.setData({
          days: util.daysSince(user.joinDate),
          growthValue: util.computeGrowthValue(user),
          mentors: util.computeMentors(user),
          avatarUrl: util.getAvatarUrl(user, 80)
        });
      }
    }
  },

  methods: {
    onAvatarEditTap: function () {
      this.triggerEvent('avataredit');
    }
  }
});
