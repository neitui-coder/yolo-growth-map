var util = require('../../utils/util.js');
var app = getApp();

Page({
  data: {
    navPaddingTop: 20,
    loading: true,
    allUsers: [],
    filtered: [],
    query: '',
    phoneTried: false
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
    var that = this;
    // 调云函数 listBindable，已绑定的成员被排除
    wx.cloud.callFunction({
      name: 'yoloFunctions',
      data: { type: 'listBindable' }
    }).then(function (res) {
      var raw = (res && res.result && res.result.members) || [];
      var users = raw.map(function (u) {
        var statusLabel = u.memberStatus === 'alumni' ? '往届会员' : '现届会员';
        return {
          userId: u.userId,
          name: u.name || '',
          englishName: u.englishName || '',
          subtitle: [statusLabel, u.company, u.role].filter(Boolean).join(' · '),
          memberStatus: u.memberStatus || 'active',
          avatarUrl: app.getMediaUrl ? app.getMediaUrl(u.avatarImage) || util.getAvatarUrl(u, 60) : util.getAvatarUrl(u, 60),
          initial: (u.name || '?').slice(0, 1)
        };
      });
      users.sort(function (a, b) { return (a.name || '').localeCompare(b.name || '', 'zh-CN'); });
      that.setData({ allUsers: users, filtered: users, loading: false });
    }).catch(function () {
      // fallback：用本地 master
      var users = (app.globalData.users || [])
        .filter(function (u) { return (u.memberStatus === 'active' || u.memberStatus === 'alumni' || !u.memberStatus) && !u.wechatOpenId && !u.wechatUnionId; })
        .map(function (u) {
          var statusLabel = u.memberStatus === 'alumni' ? '往届会员' : '现届会员';
          return {
            userId: u.userId,
            name: u.name || '',
            englishName: u.englishName || '',
            subtitle: [statusLabel, u.company, u.role].filter(Boolean).join(' · '),
            memberStatus: u.memberStatus || 'active',
            avatarUrl: app.getMediaUrl ? app.getMediaUrl(u.avatarImage) || util.getAvatarUrl(u, 60) : util.getAvatarUrl(u, 60),
            initial: (u.name || '?').slice(0, 1)
          };
        });
      users.sort(function (a, b) { return (a.name || '').localeCompare(b.name || '', 'zh-CN'); });
      that.setData({ allUsers: users, filtered: users, loading: false });
    });
  },

  onGetPhone: function (e) {
    var self = this;
    var d = e.detail || {};
    if (d.errMsg && d.errMsg.indexOf('ok') === -1) {
      // 用户拒绝授权
      this.setData({ phoneTried: true });
      return;
    }
    if (!d.code) {
      this.setData({ phoneTried: true });
      wx.showToast({ title: '未获取到手机号', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '正在识别...' });
    wx.cloud.callFunction({
      name: 'yoloFunctions',
      data: { type: 'bindByPhone', code: d.code }
    }).then(function (res) {
      wx.hideLoading();
      var r = res && res.result;
      if (r && r.success && r.matched) {
        app.globalData.currentUserId = r.user.userId;
        app.globalData.selectedUserId = r.user.userId;
        app.globalData.currentUserMemberStatus = r.user.memberStatus || 'active';
        app.globalData.authBound = true;
        app.globalData.isStaff = false;
        wx.showToast({ title: '你好，' + r.user.name, icon: 'success' });
        setTimeout(function () { wx.reLaunch({ url: '/pages/index/index' }); }, 1000);
      } else if (r && r.success && r.alreadyBound && r.user) {
        app.globalData.currentUserId = r.user.userId;
        app.globalData.selectedUserId = r.user.userId;
        app.globalData.currentUserMemberStatus = r.user.memberStatus || 'active';
        app.globalData.authBound = true;
        app.globalData.isStaff = false;
        wx.showToast({ title: '已绑定，欢迎回来', icon: 'success' });
        setTimeout(function () { wx.reLaunch({ url: '/pages/index/index' }); }, 800);
      } else {
        // 没匹配上 → 提示手动选
        self.setData({ phoneTried: true });
        var content = '你的微信手机号不在 YOLO+ 成员名单里，请从下方手动选择。';
        wx.showModal({
          title: '没找到对应的成员',
          content: content,
          showCancel: false
        });
      }
    }).catch(function (err) {
      wx.hideLoading();
      self.setData({ phoneTried: true });
      console.warn('bindByPhone failed', err);
      wx.showModal({
        title: '识别失败',
        content: '请从下方名单手动选择身份',
        showCancel: false
      });
    });
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
            var picked = (self.data.allUsers || []).find(function (u) { return u.userId === userId; });
            app.globalData.currentUserMemberStatus = (picked && picked.memberStatus) || 'active';
            app.globalData.authBound = true;
            app.globalData.isStaff = false;
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
