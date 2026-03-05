var util = require('../../utils/util.js');
var app = getApp();

Page({
  /**
   * 主页面 - 成长地图
   * 结构：会员切换栏 → 用户资料头 → 年度目标 → 时间轴节点列表
   */
  data: {
    // 所有用户列表（带 avatarUrl 字段）
    users: [],
    // 当前选中的用户 ID
    selectedUserId: '',
    // 当前选中的用户数据
    selectedUser: {},
    // 是否查看自己的档案
    isOwner: false,
    // 排序后的节点列表（按日期降序）
    sortedNodes: [],
    // 节点类型配置映射
    nodeTypes: {},
    // 头像选择器是否显示
    showAvatarPicker: false
  },

  onLoad: function () {
    var users = app.globalData.users.map(function (u) {
      return Object.assign({}, u, { avatarUrl: util.getAvatarUrl(u, 48) });
    });
    this.setData({
      users: users,
      selectedUserId: app.globalData.selectedUserId,
      nodeTypes: app.globalData.NODE_TYPES
    });
    this._refreshSelectedUser();
  },

  onShow: function () {
    // 页面显示时刷新（从编辑页返回后数据可能变化）
    this._refreshSelectedUser();
  },

  /**
   * 刷新当前选中用户的数据
   */
  _refreshSelectedUser: function () {
    var user = app.getUser(this.data.selectedUserId);
    if (!user) return;

    var sorted = user.nodes.map(function (n, i) {
      return Object.assign({}, n, { _idx: i });
    }).sort(function (a, b) {
      return b.date.localeCompare(a.date);
    });

    this.setData({
      selectedUser: user,
      isOwner: this.data.selectedUserId === app.globalData.currentUserId,
      sortedNodes: sorted
    });
  },

  /**
   * 会员切换事件
   */
  onMemberSelect: function (e) {
    var userId = e.detail.userId;
    app.globalData.selectedUserId = userId;
    this.setData({ selectedUserId: userId });
    this._refreshSelectedUser();
  },

  /**
   * 节点点击事件 - 跳转编辑页
   */
  onNodeTap: function (e) {
    var nodeIndex = e.detail.index;
    var isOwner = this.data.isOwner;
    var authorized = app.globalData.editAuthorized[this.data.selectedUserId];

    if (isOwner || authorized) {
      wx.navigateTo({
        url: '/pages/edit/edit?userId=' + this.data.selectedUserId + '&nodeIndex=' + nodeIndex
      });
    } else {
      // 需要密码验证
      this._pendingEditIndex = nodeIndex;
      this._showPasswordDialog();
    }
  },

  /**
   * 添加节点按钮
   */
  onAddNode: function () {
    var isOwner = this.data.isOwner;
    var authorized = app.globalData.editAuthorized[this.data.selectedUserId];

    if (isOwner || authorized) {
      wx.navigateTo({
        url: '/pages/edit/edit?userId=' + this.data.selectedUserId
      });
    } else {
      this._pendingEditIndex = -1;
      this._showPasswordDialog();
    }
  },

  /**
   * 设定年度目标
   */
  onSetGoal: function () {
    var that = this;
    wx.showModal({
      title: '设定年度目标',
      editable: true,
      placeholderText: '请输入你的年度目标',
      success: function (res) {
        if (res.confirm && res.content && res.content.trim()) {
          var user = app.getUser(that.data.selectedUserId);
          user.goal = res.content.trim();
          that._refreshSelectedUser();
        }
      }
    });
  },

  /**
   * 打开头像选择器
   */
  onAvatarEdit: function () {
    this.setData({ showAvatarPicker: true });
  },

  /**
   * 头像选择确认
   */
  onAvatarSelect: function (e) {
    var style = e.detail.style;
    var seed = e.detail.seed;
    var user = app.getUser(app.globalData.currentUserId);
    user.avatarStyle = style;
    user.avatarSeed = seed;
    this.setData({ showAvatarPicker: false });
    this._refreshSelectedUser();
    // 刷新用户列表中的头像
    var users = this.data.users.map(function (u) {
      if (u.id === user.id) {
        return Object.assign({}, u, { avatarUrl: util.getAvatarUrl(user, 48) });
      }
      return u;
    });
    this.setData({ users: users });
  },

  /**
   * 关闭头像选择器
   */
  onAvatarPickerClose: function () {
    this.setData({ showAvatarPicker: false });
  },

  /**
   * 显示密码验证弹窗
   */
  _showPasswordDialog: function () {
    var that = this;
    // 小程序中使用 wx.showModal 模拟密码输入
    // 后续可替换为自定义组件
    wx.showModal({
      title: '编辑验证',
      content: '请输入管理密码以编辑该用户的成长地图',
      editable: true,
      placeholderText: '请输入密码',
      success: function (res) {
        if (res.confirm && res.content === 'yolo') {
          app.globalData.editAuthorized[that.data.selectedUserId] = true;
          if (that._pendingEditIndex === -1) {
            wx.navigateTo({
              url: '/pages/edit/edit?userId=' + that.data.selectedUserId
            });
          } else if (that._pendingEditIndex !== null && that._pendingEditIndex !== undefined) {
            wx.navigateTo({
              url: '/pages/edit/edit?userId=' + that.data.selectedUserId + '&nodeIndex=' + that._pendingEditIndex
            });
          }
        } else if (res.confirm) {
          wx.showToast({ title: '密码错误', icon: 'error' });
        }
        that._pendingEditIndex = null;
      }
    });
  }
});
