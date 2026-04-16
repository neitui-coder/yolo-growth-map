var util = require('../../utils/util.js');
var app = getApp();

Page({
  data: {
    user: {},
    avatarUrl: '',
    growthValue: 0,
    nodeCount: 0,
    completeness: 0,
    navPaddingTop: 20,
    seeded: false,
    isOperatorView: false,
    canSwitchMode: false,
    homeMode: 'real'
  },

  onLoad: function () {
    this.setData({
      navPaddingTop: (app.globalData.statusBarHeight || 20) + 14
    });
  },

  onShow: function () {
    if (!app.requireAuth()) return;
    this.setData({
      canSwitchMode: app.canSwitchMode ? app.canSwitchMode() : false,
      homeMode: app.globalData.homeMode || 'real'
    });
    if (app.globalData.usersLoaded) {
      this._ensureMyUser();
    } else {
      app.onUsersLoaded(this._ensureMyUser.bind(this));
    }
  },

  onSwitchMode: function () {
    if (!(app.canSwitchMode && app.canSwitchMode())) return;
    var self = this;
    wx.showActionSheet({
      itemList: ['真实数据', '模拟演示', '运营者视角'],
      success: function (res) {
        var modes = ['real', 'mock', 'operator'];
        var target = modes[res.tapIndex];
        if (!target || target === app.globalData.homeMode) return;
        wx.showLoading({ title: '切换中...' });
        app.switchHomeMode(target, function () {
          wx.hideLoading();
          self.setData({ homeMode: app.globalData.homeMode });
          wx.switchTab({ url: '/pages/index/index' });
        });
      }
    });
  },

  _ensureMyUser: function () {
    var that = this;
    if (!app.getUser(app.globalData.currentUserId) && app.ensureAllUsersLoaded) {
      app.ensureAllUsersLoaded(function () {
        that._refreshMe();
      });
      return;
    }
    this._refreshMe();
  },

  _refreshMe: function () {
    var user = app.getUser(app.globalData.currentUserId);
    if (!user) {
      if (app.isOperatorModeActive && app.isOperatorModeActive()) {
        this.setData({
          isOperatorView: true,
          user: {
            name: '运营团队',
            motto: '当前为上帝视角，可维护会员档案与成长地图'
          },
          avatarUrl: '',
          growthValue: 0,
          nodeCount: app.globalData.users ? app.globalData.users.length : 0,
          completeness: 100
        });
      }
      return;
    }
    this.setData({
      isOperatorView: false,
      user: user,
      avatarUrl: util.getAvatarUrl(user, 80),
      growthValue: util.computeGrowthValue(user),
      nodeCount: (user.nodes || []).length,
      completeness: util.profileCompleteness(user)
    });
  },

  onViewProfile: function () {
    if (this.data.isOperatorView) return;
    wx.navigateTo({
      url: '/pages/profile/profile?userId=' + app.globalData.currentUserId
    });
  },

  onEditProfile: function () {
    if (this.data.isOperatorView) return;
    wx.navigateTo({
      url: '/pages/edit-profile/edit-profile?userId=' + app.globalData.currentUserId
    });
  },

  onViewMap: function () {
    if (this.data.isOperatorView) return;
    wx.navigateTo({
      url: '/pages/profile/profile?userId=' + app.globalData.currentUserId + '&scrollTo=timeline'
    });
  },

});
