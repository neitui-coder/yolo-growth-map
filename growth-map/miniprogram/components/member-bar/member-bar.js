var util = require('../../utils/util.js');

Component({
  /**
   * member-bar: 顶部会员横向切换栏
   * 显示所有用户头像，点击切换当前查看的用户
   */
  properties: {
    // 所有用户列表
    users: {
      type: Array,
      value: []
    },
    // 当前选中的用户 ID
    selectedUserId: {
      type: String,
      value: ''
    }
  },

  data: {},

  methods: {
    onMemberTap: function (e) {
      var userId = e.currentTarget.dataset.userId;
      this.triggerEvent('memberselect', { userId: userId });
    },

    getAvatarUrl: function (user) {
      return util.getAvatarUrl(user, 48);
    }
  }
});
