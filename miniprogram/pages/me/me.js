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
    isOperatorView: false
  },

  onLoad: function () {
    this.setData({
      navPaddingTop: (app.globalData.statusBarHeight || 20) + 14
    });
  },

  onShow: function () {
    if (app.globalData.usersLoaded) {
      this._ensureMyUser();
    } else {
      app.onUsersLoaded(this._ensureMyUser.bind(this));
    }
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

  onSeedData: function () {
    var self = this;
    wx.showLoading({ title: '正在初始化...' });
    wx.cloud.callFunction({
      name: 'yoloFunctions',
      data: { type: 'seedData', users: app.globalData.users },
      success: function (res) {
        wx.hideLoading();
        if (res.result.success) {
          wx.showToast({ title: '初始化成功！写入 ' + res.result.count + ' 条', icon: 'success' });
          self.setData({ seeded: true });
        } else {
          wx.showToast({ title: res.result.error || '初始化失败', icon: 'none' });
        }
      },
      fail: function (err) {
        wx.hideLoading();
        wx.showToast({ title: '调用失败', icon: 'error' });
        console.error(err);
      }
    });
  }
});
