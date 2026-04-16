var util = require('../../utils/util.js');
var app = getApp();

Page({
  data: {
    navPaddingTop: 20,
    loading: true,
    allUsers: [],
    filtered: [],
    query: ''
  },

  onLoad: function () {
    this.setData({ navPaddingTop: (app.globalData.statusBarHeight || 20) + 14 });
    var that = this;
    // 确保 all users 加载完；auth 页不受 login gate 限制，可以直接读 mock 或 real
    var start = function () {
      if (app.globalData.usersLoaded) {
        that._buildList();
      } else {
        app.onUsersLoaded(that._buildList.bind(that));
      }
    };
    // 强制切到 real 数据，避免 auth 列表显示 mock 角色
    if (app.globalData.homeMode !== 'real') {
      app.switchHomeMode('real', start);
    } else {
      start();
    }
  },

  _buildList: function () {
    var users = (app.globalData.users || []).filter(function (u) {
      return u.memberStatus !== 'alumni';
    }).map(function (u) {
      return {
        userId: u.userId,
        name: u.name || '',
        englishName: u.englishName || '',
        subtitle: [u.company, u.role].filter(Boolean).join(' · '),
        avatarUrl: app.getMediaUrl ? app.getMediaUrl(u.avatarImage) || util.getAvatarUrl(u, 60) : util.getAvatarUrl(u, 60),
        initial: (u.name || '?').slice(0, 1)
      };
    });
    users.sort(function (a, b) { return (a.name || '').localeCompare(b.name || '', 'zh-CN'); });
    this.setData({ allUsers: users, filtered: users, loading: false });
  },

  onSearchInput: function (e) {
    var q = (e.detail.value || '').trim().toLowerCase();
    this.setData({ query: q });
    if (!q) { this.setData({ filtered: this.data.allUsers }); return; }
    var filtered = this.data.allUsers.filter(function (u) {
      return (u.name && u.name.toLowerCase().indexOf(q) !== -1)
        || (u.englishName && u.englishName.toLowerCase().indexOf(q) !== -1)
        || (u.subtitle && u.subtitle.toLowerCase().indexOf(q) !== -1);
    });
    this.setData({ filtered: filtered });
  },

  onPickUser: function (e) {
    var userId = e.currentTarget.dataset.userId;
    if (!userId) return;
    var self = this;
    wx.showModal({
      title: '确认绑定',
      content: '绑定后此微信号将只能以此身份查看小程序，且不可自行更换。确认绑定吗？',
      success: function (res) {
        if (!res.confirm) return;
        wx.showLoading({ title: '绑定中...' });
        app.bindCurrentUserToWechat(userId).then(function (r) {
          wx.hideLoading();
          if (r && r.success) {
            app.globalData.currentUserId = userId;
            app.globalData.selectedUserId = userId;
            app.globalData.authBound = true;
            wx.showToast({ title: '绑定成功', icon: 'success' });
            setTimeout(function () { wx.reLaunch({ url: '/pages/index/index' }); }, 800);
          } else {
            wx.showModal({
              title: '绑定失败',
              content: (r && r.error) || '未知错误',
              showCancel: false
            });
          }
        }).catch(function (err) {
          wx.hideLoading();
          wx.showModal({
            title: '绑定失败',
            content: err && err.errMsg ? err.errMsg : '网络异常，请重试',
            showCancel: false
          });
        });
      }
    });
  }
});
