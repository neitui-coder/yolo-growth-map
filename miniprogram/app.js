var util = require('./utils/util.js');

App({
  globalData: {
    statusBarHeight: 20,
    // 当前登录用户 ID
    currentUserId: 'alex',
    // 当前选中查看的用户 ID
    selectedUserId: 'alex',
    defaultCurrentUserByMode: {
      mock: 'alex',
      real: 'pdf2025-bill',
      operator: '__operator__'
    },
    // 首页模式：'mock' | 'real' | 'operator'
    homeMode: 'mock',
    // 数据类型：'mock'（模拟数据）| 'real'（真实数据）
    dataType: 'mock',
    // 运营者模式标记：operator 模式下为 true
    operatorModeActive: false,
    // 给档案页等场景使用的 god-view 开关
    godViewEnabled: false,
    pendingHomeSearch: null,
    mediaUrlCache: {},
    // 已通过密码验证的用户 ID 集合
    editAuthorized: {},
    // 首页 section 定义
    HOME_SECTIONS: [
      { key: 'members', label: '会员列表', subtitle: '分页浏览' },
      { key: 'birthday', label: '生日月历', subtitle: '按月份聚合' },
      { key: 'review', label: '活动回顾', subtitle: '最近动态' }
    ],
    // 节点类型定义
    NODE_TYPES: {
      activity: { label: 'YOLO+活动', icon: 'people-group', className: 'type-activity' },
      role:     { label: '角色变化', icon: 'user-tie',      className: 'type-role' },
      life:     { label: '人生节点', icon: 'heart',         className: 'type-life' },
      ted:      { label: 'TED分享',  icon: 'microphone',    className: 'type-ted' },
      cert:     { label: '技能认证', icon: 'certificate',   className: 'type-cert' }
    },
    // 盖洛普 34 个优势主题
    GALLUP_THEMES: [
      '成就','统筹','信仰','公平','审慎','纪律','专注','责任','排难',
      '行动','统率','沟通','竞争','完美','自信','追求','取悦',
      '适应','关联','伯乐','体谅','和谐','包容','个别','积极','交往',
      '分析','回顾','前瞻','理念','搜集','思维','学习','战略'
    ],
    // 头像风格（彩色方案）
    AVATAR_STYLES: ['adventurer-neutral', 'miniavs', 'open-peeps', 'personas'],
    DEFAULT_AVATAR_STYLE: 'adventurer-neutral',
    AVATAR_SEEDS: ['happy','sunshine','star','moon','rainbow','flower','cloud','wave','heart','smile','lucky','dream','bliss','joy','hope','peace'],
    // 示例照片
    SAMPLE_PHOTOS: [
      'https://picsum.photos/seed/yolo1/200','https://picsum.photos/seed/yolo2/200',
      'https://picsum.photos/seed/yolo3/200','https://picsum.photos/seed/yolo4/200',
      'https://picsum.photos/seed/yolo5/200','https://picsum.photos/seed/yolo6/200',
      'https://picsum.photos/seed/yolo7/200','https://picsum.photos/seed/yolo8/200',
      'https://picsum.photos/seed/wedding1/200','https://picsum.photos/seed/baby1/200',
      'https://picsum.photos/seed/house1/200','https://picsum.photos/seed/diving1/200'
    ],
    // Q&A 问题池
    QA_POOL: [
      '你人生中最勇敢的一次决定是什么？',
      '如果能给5年前的自己一句话，你会说什么？',
      '你做过最疯狂的事情是什么？',
      '对你影响最大的一本书是什么？',
      '你最得意的一项技能是怎么学会的？',
      '你的童年梦想是什么？现在实现了吗？',
      '哪个城市/国家是你一定要去的？',
      '你加入YOLO+之后最大的收获是什么？',
      '如果明天是世界末日，你今天会做什么？',
      '你生活中最离不开的三样东西是什么？',
      '你做过最好的投资是什么？',
      '你最近在学的一件新事物是什么？',
      '有哪件事让你彻底改变了对生活的看法？',
      '你觉得人生最重要的品质是什么？',
      '你最珍惜的一段友谊是怎么开始的？',
      '你在YOLO+遇到过最有意思的人是谁？为什么？',
      '你工作中最有成就感的一个项目是什么？',
      '如果可以拥有一种超能力，你选什么？',
      '你最想对未来的自己说什么？',
      '你人生中最幸运的一件事是什么？'
    ],
    // Q&A 示例回答
    QA_SAMPLE_ANSWERS: [
      '辞掉稳定的工作去创业，虽然很辛苦但不后悔。',
      '别急，慢慢来，你会找到自己的路。',
      '一个人背包穷游了三个月。',
      '《人类简史》，完全重塑了我的世界观。',
      '靠每天30分钟的刻意练习，坚持了一整年。',
      '想当宇航员，虽然没实现，但一直仰望星空。',
      '冰岛，极光和火山，一定要亲眼看看。',
      '认识了一群志同道合的朋友，视野开阔了很多。',
      '和家人一起吃顿饭，然后去看日落。',
      '手机、咖啡、和一本好书。',
      '投资了自己的学习和健康，回报率最高。',
      '在学吉他，从零开始的感觉很棒。',
      '有一次重病住院，让我重新审视了生活的优先级。',
      '真诚，不管什么时候都不要丢掉。',
      '大学军训的时候认识的，一起扛过苦就是铁哥们。'
    ],
    // 用户数据（初始化时生成）
    users: [],
    usersPage: 0,
    usersPageSize: 100,
    usersHasMore: true,
    usersLoading: false,
    allUsersLoaded: false,
    // 云数据库加载状态
    usersLoaded: false,
    // 双模式缓存：{ mock: {users, usersPage, usersHasMore, allUsersLoaded}, real: {...} }
    usersByMode: {},
    // 活动 collection 缓存（共享，全局）
    activitiesCache: null,
    activitiesCachedAt: 0
  },

  onLaunch: function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'cloud1-7giblg7i4595eaf3',
        traceUser: true
      });
    }
    var sysInfo = wx.getSystemInfoSync();
    this.globalData.statusBarHeight = sysInfo.statusBarHeight || 20;
    this.globalData.homeMode = this.globalData.homeMode || 'mock';
    this.globalData.dataType = this.globalData.homeMode === 'mock' ? 'mock' : 'real';
    this.globalData.operatorModeActive = this.globalData.homeMode === 'operator';
    this.globalData.godViewEnabled = this.globalData.operatorModeActive;
    this._loadUsersFromCloud(true);
  },

  /**
   * 从云数据库加载用户数据，不再 fallback 到本地生成
   */
  _notifyUsersLoaded: function () {
    if (this._usersLoadedCallbacks) {
      this._usersLoadedCallbacks.forEach(function (cb) { cb(); });
      this._usersLoadedCallbacks = [];
    }
  },

  _notifyMediaCacheUpdated: function () {
    if (this._mediaCacheCallbacks) {
      this._mediaCacheCallbacks.forEach(function (cb) { cb(); });
    }
  },

  onMediaCacheUpdated: function (callback) {
    if (!callback) return;
    if (!this._mediaCacheCallbacks) this._mediaCacheCallbacks = [];
    if (this._mediaCacheCallbacks.indexOf(callback) === -1) {
      this._mediaCacheCallbacks.push(callback);
    }
  },

  offMediaCacheUpdated: function (callback) {
    if (!callback || !this._mediaCacheCallbacks) return;
    var idx = this._mediaCacheCallbacks.indexOf(callback);
    if (idx !== -1) this._mediaCacheCallbacks.splice(idx, 1);
  },

  /**
   * 生成稳定的 nodeId（解决数组下标不稳定问题）
   */
  generateNodeId: function () {
    return 'n-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  },

  /**
   * 获取 activities collection（缓存 5 分钟）
   */
  getActivitiesCache: function (callback, opts) {
    var that = this;
    var force = opts && opts.force;
    var TTL = 5 * 60 * 1000;
    var now = Date.now();
    if (!force && this.globalData.activitiesCache && (now - this.globalData.activitiesCachedAt) < TTL) {
      if (callback) callback(this.globalData.activitiesCache);
      return;
    }
    wx.cloud.callFunction({
      name: 'yoloFunctions',
      data: { type: 'getActivities' },
      success: function (res) {
        var acts = (res.result && res.result.success && res.result.data) ? res.result.data : [];
        that.globalData.activitiesCache = acts;
        that.globalData.activitiesCachedAt = now;
        if (callback) callback(acts);
      },
      fail: function () {
        if (callback) callback(that.globalData.activitiesCache || []);
      }
    });
  },

  invalidateActivitiesCache: function () {
    this.globalData.activitiesCache = null;
    this.globalData.activitiesCachedAt = 0;
  },

  isCloudMediaRef: function (value) {
    return typeof value === 'string' && value.indexOf('cloud://') === 0;
  },

  getMediaUrl: function (value) {
    if (!value) return value;
    return this.globalData.mediaUrlCache[value] || value;
  },

  getMediaUrls: function (values) {
    var that = this;
    return (values || []).map(function (value) {
      return that.getMediaUrl(value);
    });
  },

  _collectMediaRefs: function (users) {
    var refs = [];
    (users || []).forEach(function (user) {
      if (user && user.avatarImage) refs.push(user.avatarImage);
      (user && user.nodes || []).forEach(function (node) {
        refs = refs.concat(node && node.images || []);
      });
    });
    return refs.filter(function (value, index, list) {
      return !!value && list.indexOf(value) === index;
    });
  },

  prefetchMediaUrls: function (refs, callback) {
    var that = this;
    var uniqueRefs = (refs || []).filter(function (ref, index, list) {
      return !!ref && list.indexOf(ref) === index;
    });
    var unresolved = uniqueRefs.filter(function (ref) {
      return that.isCloudMediaRef(ref) && !that.globalData.mediaUrlCache[ref];
    });

    if (!unresolved.length || !wx.cloud || !wx.cloud.getTempFileURL) {
      if (callback) callback(that.getMediaUrls(uniqueRefs));
      return;
    }

    if (!that._mediaPrefetchQueue) that._mediaPrefetchQueue = {};

    var pending = unresolved.filter(function (ref) {
      return !that._mediaPrefetchQueue[ref];
    });
    pending.forEach(function (ref) {
      that._mediaPrefetchQueue[ref] = true;
    });

    var chunks = [];
    while (pending.length) {
      chunks.push(pending.splice(0, 50));
    }

    var index = 0;
    function next() {
      if (index >= chunks.length) {
        uniqueRefs.forEach(function (ref) {
          delete that._mediaPrefetchQueue[ref];
        });
        that._notifyMediaCacheUpdated();
        if (callback) callback(that.getMediaUrls(uniqueRefs));
        return;
      }

      var chunk = chunks[index++];
      wx.cloud.getTempFileURL({
        fileList: chunk,
        success: function (res) {
          (res.fileList || []).forEach(function (item) {
            if (item.fileID && item.tempFileURL) {
              that.globalData.mediaUrlCache[item.fileID] = item.tempFileURL;
            }
          });
        },
        complete: next
      });
    }

    next();
  },

  _primeMediaCache: function (users, callback) {
    this.prefetchMediaUrls(this._collectMediaRefs(users), callback);
  },

  _normalizeUsers: function (users) {
    return (users || []).map(function (u) {
      if (!u.id && u.userId) u.id = u.userId;
      if (!u.userId && u.id) u.userId = u.id;
      if (!u.qa) u.qa = [];
      if (!u.nodes) u.nodes = [];
      if (!u.skills) u.skills = [];
      if (!u.hobbies) u.hobbies = [];
      if (!u.expertise) u.expertise = [];
      if (!u.tags) u.tags = [];
      if (!u.visibility) u.visibility = {};
      return u;
    });
  },

  _mergeUsers: function (nextUsers) {
    var merged = {};
    (this.globalData.users || []).concat(nextUsers || []).forEach(function (u) {
      merged[u.userId || u.id] = u;
    });
    return Object.keys(merged).map(function (key) { return merged[key]; });
  },

  _pickCurrentUserId: function () {
    var preferred = this.globalData.defaultCurrentUserByMode[this.globalData.homeMode] || this.globalData.currentUserId;
    var users = this.globalData.users || [];
    if (this.globalData.homeMode === 'operator' && preferred === '__operator__') {
      return preferred;
    }
    var preferredUser = users.find(function (u) {
      return (u.userId || u.id) === preferred;
    });
    if (preferredUser) return preferredUser.userId || preferredUser.id;
    if (users.length > 0) return users[0].userId || users[0].id;
    return preferred;
  },

  _loadUsersFromCloud: function (reset, callback) {
    var that = this;
    if (that.globalData.usersLoading) {
      if (reset) that._pendingReload = true;
      return;
    }

    if (reset) {
      that.globalData.users = [];
      that.globalData.usersPage = 0;
      that.globalData.usersHasMore = true;
      that.globalData.allUsersLoaded = false;
      that.globalData.usersLoaded = false;
    }

    var page = reset ? 0 : that.globalData.usersPage;
    var dataType = that.globalData.dataType === 'mock' ? 'mock' : 'real';
    that.globalData.usersLoading = true;
    wx.cloud.callFunction({
      name: 'yoloFunctions',
      data: {
        type: 'getUsers',
        dataType: dataType,
        page: page,
        pageSize: that.globalData.usersPageSize
      },
      success: function (res) {
        var rows = (res.result && res.result.success && res.result.data) ? res.result.data : [];
        var normalized = that._normalizeUsers(rows);
        that.globalData.users = reset ? normalized : that._mergeUsers(normalized);
        that.globalData.usersPage = page + 1;
        that.globalData.usersHasMore = normalized.length === that.globalData.usersPageSize;
        that.globalData.allUsersLoaded = !that.globalData.usersHasMore;
        that.globalData.currentUserId = that._pickCurrentUserId();
        that.globalData.selectedUserId = that.globalData.currentUserId;
        that.globalData.usersLoading = false;
        if (that._pendingReload) {
          that._pendingReload = false;
          that._loadUsersFromCloud(true, callback);
          return;
        }
        if (that.globalData.users.length === 0) {
          wx.showToast({ title: '暂无用户数据', icon: 'none' });
        }
        that._primeMediaCache(that.globalData.users);
        that.globalData.usersLoaded = true;
        that._notifyUsersLoaded();
        if (callback) callback(normalized);
      },
      fail: function () {
        console.error('Cloud data load failed');
        wx.showToast({ title: '数据加载失败，请重试', icon: 'none' });
        that.globalData.users = [];
        that.globalData.usersLoading = false;
        if (that._pendingReload) {
          that._pendingReload = false;
          that._loadUsersFromCloud(true, callback);
          return;
        }
        that.globalData.usersLoaded = true;
        that._notifyUsersLoaded();
        if (callback) callback([]);
      }
    });
  },

  /**
   * 等待用户数据加载完成后执行回调
   */
  onUsersLoaded: function (callback) {
    if (this.globalData.usersLoaded) {
      callback();
    } else {
      if (!this._usersLoadedCallbacks) this._usersLoadedCallbacks = [];
      this._usersLoadedCallbacks.push(callback);
    }
  },

  /**
   * 切换数据类型（'mock' | 'real'），重新从云端加载用户，完成后触发回调
   */
  switchDataType: function (type, callback) {
    this.switchHomeMode(type, callback);
  },

  /**
   * 切换首页模式（mock | real | operator）
   * operator 模式会加载 real 数据，但保留运营者/god-view 标记。
   * 双缓存：mock 和 real 数据各自缓存，切换时秒切。
   */
  _snapshotCurrentModeCache: function () {
    var prevDataType = this.globalData.dataType;
    if (!prevDataType || !this.globalData.usersLoaded) return;
    this.globalData.usersByMode[prevDataType] = {
      users: this.globalData.users,
      usersPage: this.globalData.usersPage,
      usersHasMore: this.globalData.usersHasMore,
      allUsersLoaded: this.globalData.allUsersLoaded,
      currentUserId: this.globalData.currentUserId,
      selectedUserId: this.globalData.selectedUserId
    };
  },

  switchHomeMode: function (mode, callback) {
    var dataType = mode === 'mock' ? 'mock' : 'real';
    var prevDataType = this.globalData.dataType;

    // Snapshot 当前模式数据到缓存
    if (prevDataType && prevDataType !== dataType) {
      this._snapshotCurrentModeCache();
    }

    this.globalData.homeMode = mode;
    this.globalData.dataType = dataType;
    this.globalData.operatorModeActive = mode === 'operator';
    this.globalData.godViewEnabled = this.globalData.operatorModeActive;

    var cache = this.globalData.usersByMode[dataType];
    if (cache && cache.users && cache.users.length > 0) {
      // 命中缓存：秒切
      this.globalData.users = cache.users;
      this.globalData.usersPage = cache.usersPage;
      this.globalData.usersHasMore = cache.usersHasMore;
      this.globalData.allUsersLoaded = cache.allUsersLoaded;
      this.globalData.currentUserId = cache.currentUserId || this._pickCurrentUserId();
      this.globalData.selectedUserId = cache.selectedUserId || this.globalData.currentUserId;
      this.globalData.usersLoaded = true;
      this._notifyUsersLoaded();
      if (callback) callback();
      return;
    }

    // Cache miss: 拉云数据
    this.globalData.usersLoaded = false;
    this.globalData.users = [];
    this.globalData.usersPage = 0;
    this.globalData.usersHasMore = true;
    this.globalData.allUsersLoaded = false;
    this._usersLoadedCallbacks = callback ? [callback] : [];
    this._loadUsersFromCloud(true);
  },

  /**
   * 强制刷新当前模式数据（下拉刷新使用）
   */
  refreshCurrentMode: function (callback) {
    var dataType = this.globalData.dataType;
    delete this.globalData.usersByMode[dataType];
    this.invalidateActivitiesCache();
    this.globalData.usersLoaded = false;
    this.globalData.users = [];
    this.globalData.usersPage = 0;
    this.globalData.usersHasMore = true;
    this.globalData.allUsersLoaded = false;
    this._usersLoadedCallbacks = callback ? [callback] : [];
    this._loadUsersFromCloud(true);
  },

  /**
   * 把 globalData.users 写入云数据库（一键 seed）
   */
  seedToCloud: function () {
    var users = this.globalData.users;
    wx.cloud.callFunction({
      name: 'yoloFunctions',
      data: { type: 'seedData', users: users },
      success: function (res) {
        console.log('Seed result:', res.result);
      },
      fail: function (err) {
        console.error('Seed failed:', err);
      }
    });
  },

  /**
   * 获取用户数据
   */
  getUser: function (id) {
    return this.globalData.users.find(function (u) { return u.id === id || u.userId === id; });
  },

  /**
   * 获取当前选中用户
   */
  getSelectedUser: function () {
    return this.getUser(this.globalData.selectedUserId);
  },

  loadMoreUsers: function (callback) {
    if (this.globalData.usersLoading || !this.globalData.usersHasMore) {
      if (callback) callback([]);
      return;
    }
    this._loadUsersFromCloud(false, callback);
  },

  ensureAllUsersLoaded: function (callback) {
    var that = this;
    if (that.globalData.allUsersLoaded || !that.globalData.usersHasMore) {
      that.globalData.allUsersLoaded = true;
      if (callback) callback();
      return;
    }
    that.loadMoreUsers(function () {
      that.ensureAllUsersLoaded(callback);
    });
  },

  /**
   * 首页 section 配置
   */
  getHomeSections: function () {
    return this.globalData.HOME_SECTIONS.slice();
  },

  /**
   * 运营者模式是否开启
   */
  isOperatorModeActive: function () {
    return !!this.globalData.operatorModeActive;
  },

  /**
   * 当前是否可管理某个用户档案/成长地图
   */
  canManageUser: function (userId) {
    if (!userId) return false;
    if (this.canUseGodView()) return true;
    return userId === this.globalData.currentUserId;
  },

  /**
   * god-view 是否可用
   */
  canUseGodView: function () {
    return !!this.globalData.godViewEnabled;
  },

  /**
   * 将用户装配为首页使用的数据
   */
  getHomeUsers: function () {
    var that = this;
    return (this.globalData.users || []).map(function (u) {
      return Object.assign({}, u, {
        avatarUrl: that.getMediaUrl(u.avatarImage) || util.getAvatarUrl(u, 60),
        growthValue: util.computeGrowthValue(u)
      });
    });
  },

  /**
   * 取分页数据
   */
  getPagedUsers: function (users, page, pageSize) {
    var list = users || [];
    var size = pageSize || 12;
    var currentPage = page || 1;
    var start = (currentPage - 1) * size;
    return list.slice(start, start + size);
  },

  /**
   * 构建会员筛选标签
   */
  getMemberFilterOptions: function (users) {
    var allUsers = users || this.globalData.users || [];
    var mbtiMap = {};
    allUsers.forEach(function (u) {
      if (u.mbti) mbtiMap[u.mbti] = (mbtiMap[u.mbti] || 0) + 1;
    });
    return Object.keys(mbtiMap).sort(function (a, b) { return mbtiMap[b] - mbtiMap[a]; }).slice(0, 8);
  },

  /**
   * 按生日月份聚合首页数据
   */
  getBirthdayMonthSections: function (users) {
    var allUsers = users || [];
    var that = this;
    var groups = {};
    allUsers.forEach(function (u) {
      var parsed = util.parseBirthday(u.birthday);
      if (!parsed) return;
      var month = String(parsed.month);
      if (!groups[month]) groups[month] = [];
      groups[month].push(u);
    });

    return Object.keys(groups).sort(function (a, b) { return parseInt(a, 10) - parseInt(b, 10); }).map(function (month) {
      var members = groups[month].slice().sort(function (a, b) {
        return (a.name || '').localeCompare(b.name || '', 'zh-Hans-CN');
      });
      return {
        month: month,
        monthLabel: parseInt(month, 10) + '月',
        count: members.length,
        previewUsers: members.slice(0, 4).map(function (u) {
          return Object.assign({}, u, {
            avatarUrl: that.getMediaUrl(u.avatarImage) || util.getAvatarUrl(u, 44)
          });
        }),
        extraCount: Math.max(members.length - 4, 0),
        users: members
      };
    });
  },

  /**
   * 首页活动回顾数据
   */
  getActivityReviewData: function (users) {
    var allUsers = users || [];
    var reviewMap = {};
    var activeMembers = {};
    var nodeTypeMap = this.globalData.NODE_TYPES || {};
    var that = this;

    allUsers.forEach(function (u) {
      var nodes = u.nodes || [];
      nodes.forEach(function (node) {
        if (!node || node.collectiveActivity !== true) return;
        var key = node.activityKey || [node.type, node.date, node.desc].join('_');
        if (!reviewMap[key]) {
          reviewMap[key] = {
            key: key,
            date: node.date || '',
            type: node.type || 'activity',
            typeLabel: (nodeTypeMap[node.type] && nodeTypeMap[node.type].label) || 'YOLO+活动',
            title: node.desc || '未命名活动',
            summary: node.summary || node.desc || '',
            location: node.location || '',
            images: that.getMediaUrls((node.images || []).slice()),
            participants: []
          };
        }
        reviewMap[key].participants.push({
          userId: u.id || u.userId,
          userName: u.name || '未命名',
          avatarUrl: that.getMediaUrl(u.avatarImage) || util.getAvatarUrl(u, 44)
        });
        activeMembers[u.id || u.userId] = true;
      });
    });

    var reviewNodes = Object.keys(reviewMap).map(function (key) {
      var item = reviewMap[key];
      return Object.assign({}, item, {
        dateLabel: item.date ? util.formatDate(item.date) : '--',
        participantCount: item.participants.length,
        participantPreview: item.participants.slice(0, 6),
        extraParticipantCount: Math.max(item.participants.length - 6, 0)
      });
    }).sort(function (a, b) {
      return (b.date || '').localeCompare(a.date || '');
    });

    var latestNode = reviewNodes[0];
    return {
      summary: [
        { label: '成长节点', value: reviewNodes.length, hint: '全站累计' },
        { label: '活跃会员', value: Object.keys(activeMembers).length, hint: '参与活动' },
        { label: '最近动态', value: latestNode ? latestNode.date : '--', hint: latestNode ? latestNode.typeLabel : '暂无记录' }
      ],
      items: reviewNodes
    };
  },

  getCommunityFeedData: function (users) {
    var allUsers = users || [];
    var nodeTypeMap = this.globalData.NODE_TYPES || {};
    var that = this;
    var feedItems = [];
    var collectiveMap = {};
    var currentYear = new Date().getFullYear();

    allUsers.forEach(function (user) {
      var userId = user.userId || user.id;
      var author = {
        userId: userId,
        name: user.name || '未命名',
        avatarUrl: that.getMediaUrl(user.avatarImage) || util.getAvatarUrl(user, 64),
        career: user.career || '',
        city: Array.isArray(user.city) ? user.city[0] : (user.city || ''),
        isBirthdayMonth: util.isBirthdayInCurrentMonth(user)
      };

      if (util.isBirthdayInCurrentMonth(user)) {
        var parsedBirthday = util.parseBirthday(user.birthday) || {};
        var birthdayMessages = [
          '我过生日啦~',
          '今天生日，来许个愿吧。',
          '我生日到啦！',
          '本月小主角登场。',
          '生日月，请多关照。'
        ];
        var mi = Math.abs((userId || '').split('').reduce(function (s, c) { return s + c.charCodeAt(0); }, 0)) % birthdayMessages.length;
        feedItems.push({
          key: 'birthday_' + userId,
          feedType: 'birthday',
          date: currentYear + '-' + String(parsedBirthday.month || 1).padStart(2, '0') + '-' + String(parsedBirthday.day || 1).padStart(2, '0'),
          dateLabel: '本月生日 · ' + (user.birthday || ''),
          content: birthdayMessages[mi],
          images: [],
          author: author,
          typeLabel: '生日',
          participants: [],
          participantCount: 0,
          participantPreview: [],
          extraParticipantCount: 0,
          likesCount: 0,
          commentsCount: 0
        });
      }

      (user.nodes || []).forEach(function (node, index) {
        if (!node || node.hidden || node.visibility === 'hidden') return;
        if (node.type === 'activity' && node.desc === '加入YOLO+') return;

        var images = that.getMediaUrls((node.images || []).slice());
        var typeLabel = (nodeTypeMap[node.type] && nodeTypeMap[node.type].label) || '成长节点';
        var nodeKey = [userId, node.date || '', node.type || 'node', index].join('_');
        var nodeComments = ((user.comments || {})[nodeKey] || []).length;
        var nodeLikes = Object.keys(user.likes || {}).filter(function (likeKey) {
          return likeKey.indexOf(nodeKey + '_') === 0;
        }).length;

        if (node.collectiveActivity === true) {
          var collectiveKey = node.activityKey || [node.type, node.date, node.desc].join('_');
          if (!collectiveMap[collectiveKey]) {
            collectiveMap[collectiveKey] = {
              key: collectiveKey,
              feedType: 'collective',
              date: node.date || '',
              dateLabel: node.date ? util.formatDate(node.date) : '--',
              content: node.summary || node.desc || '',
              title: node.desc || 'YOLO+ 活动',
              images: images,
              typeLabel: typeLabel,
              author: {
                userId: 'collective',
                name: 'YOLO+ 活动',
                avatarUrl: '',
                career: node.location || '',
                city: '',
                isBirthdayMonth: false
              },
              participants: [],
              participantCount: 0,
              participantPreview: [],
              extraParticipantCount: 0,
              likesCount: 0,
              commentsCount: 0
            };
          }
          collectiveMap[collectiveKey].participants.push(author);
          collectiveMap[collectiveKey].participantCount = collectiveMap[collectiveKey].participants.length;
          collectiveMap[collectiveKey].participantPreview = collectiveMap[collectiveKey].participants.slice(0, 8);
          collectiveMap[collectiveKey].extraParticipantCount = Math.max(collectiveMap[collectiveKey].participants.length - 8, 0);
          return;
        }

        feedItems.push({
          key: nodeKey,
          feedType: 'node',
          date: node.date || '',
          dateLabel: node.date ? util.formatDate(node.date) : '--',
          content: node.summary || node.desc || '',
          title: '',
          images: images,
          typeLabel: typeLabel,
          author: author,
          participants: [],
          participantCount: 0,
          participantPreview: [],
          extraParticipantCount: 0,
          likesCount: nodeLikes,
          commentsCount: nodeComments
        });
      });
    });

    feedItems = feedItems.concat(Object.keys(collectiveMap).map(function (key) {
      return collectiveMap[key];
    }));

    return feedItems.sort(function (a, b) {
      return String(b.date || '').localeCompare(String(a.date || ''));
    });
  },

  setPendingHomeSearch: function (payload) {
    this.globalData.pendingHomeSearch = payload || null;
  },

  consumePendingHomeSearch: function () {
    var payload = this.globalData.pendingHomeSearch || null;
    this.globalData.pendingHomeSearch = null;
    return payload;
  },

  getActivityParticipants: function (targetNode) {
    var that = this;
    if (!targetNode || (!targetNode.activityKey && targetNode.type !== 'activity' && !targetNode.collectiveActivity)) return [];
    return (this.globalData.users || []).filter(function (user) {
      return (user.nodes || []).some(function (node) {
        if (targetNode.activityKey && node.activityKey) {
          return node.activityKey === targetNode.activityKey;
        }
        return node.date === targetNode.date && node.desc === targetNode.desc && (node.type === targetNode.type || node.collectiveActivity);
      });
    }).map(function (user) {
      return {
        userId: user.userId || user.id,
        name: user.name,
        avatarUrl: that.getMediaUrl(user.avatarImage) || util.getAvatarUrl(user, 44)
      };
    });
  },

  /**
   * 生成所有用户数据（包含三个核心用户 + 27 个额外用户）
   */
  _generateUsers: function () {
    var coreUsers = [
      {
        id: 'alex', name: 'Alex', gender: 'male', motto: '在不确定中寻找确定',
        skills: ['CFA', 'PADI OW'], goal: '2024年完成马拉松',
        joinDate: '2020-06',
        joinPeriods: [{ start: '2020-06', end: null }],
        gallup: ['战略', '分析', '成就', '专注', '自信'],
        yoloRole: '理事',
        avatarStyle: 'adventurer-neutral', avatarSeed: 'Alex',
        mbti: 'INTJ', hobbies: ['潜水', '跑步', '阅读'], career: '金融分析师',
        company: '高盛', city: '上海', birthday: '1992-03-15', zodiac: '双鱼座',
        wechat: 'wx_alex', education: '北大·金融学', expertise: ['投资分析', '风险管理'],
        tags: ['马拉松跑者', '潜水爱好者'],
        qa: [
          { question: '你人生中最勇敢的一次决定是什么？', answer: '放弃大厂offer，跑去潜水考了三个月的证，回来才发现原来的岗位还留着。', askedBy: 'system' },
          { question: '你加入YOLO+之后最大的收获是什么？', answer: '认识了一群不按常理出牌的朋友，每次活动都被刷新认知。', askedBy: 'system' },
          { question: '你最想挑战的下一件事是什么？', answer: null, askedBy: '匿名会员' }
        ],
        nodes: [
          { date: '2024-01', type: 'cert', desc: '获得CFA认证', images: ['https://picsum.photos/seed/cfa1/200', 'https://picsum.photos/seed/cfa2/200'] },
          { date: '2023-09', type: 'ted', desc: 'TED分享《在不确定中寻找确定》', images: ['https://picsum.photos/seed/ted1/200', 'https://picsum.photos/seed/ted2/200', 'https://picsum.photos/seed/ted3/200'] },
          { date: '2022-05', type: 'life', desc: '结婚', images: ['https://picsum.photos/seed/wedding2/200', 'https://picsum.photos/seed/wedding3/200'] },
          { date: '2021-03', type: 'role', desc: '担任小组长', images: [] },
          { date: '2020-06', type: 'activity', desc: '加入YOLO+', images: ['https://picsum.photos/seed/join1/200'] }
        ]
      },
      {
        id: 'jenny', name: 'Jenny', gender: 'female', motto: '每一步都算数',
        skills: ['PMP'], goal: null,
        joinDate: '2019-09',
        joinPeriods: [{ start: '2019-09', end: null }],
        gallup: ['体谅', '伯乐', '沟通', '和谐', '积极'],
        yoloRole: '理事',
        isFounder: true,
        avatarStyle: 'adventurer-neutral', avatarSeed: 'Jenny',
        mbti: 'ENFJ', hobbies: ['瑜伽', '旅行', '烹饪'], career: '产品经理',
        company: '腾讯', city: '深圳', birthday: '1990-08-22', zodiac: '狮子座',
        wechat: '', education: '浙大·计算机', expertise: ['产品设计', '用户研究'],
        tags: ['二胎妈妈', '瑜伽达人'],
        qa: [
          { question: '如果能给5年前的自己一句话，你会说什么？', answer: '别焦虑，一切都会好的，而且比你想象的还要好。', askedBy: 'system' },
          { question: '你做过最疯狂的事情是什么？', answer: '怀孕8个月还去参加了YOLO+的户外活动，全程被大家护着走。', askedBy: 'system' }
        ],
        nodes: [
          { date: '2023-11', type: 'life', desc: '喜得贵子', images: ['https://picsum.photos/seed/baby2/200', 'https://picsum.photos/seed/baby3/200'] },
          { date: '2022-08', type: 'ted', desc: 'TED分享《在路上》', images: ['https://picsum.photos/seed/tedj1/200'] },
          { date: '2021-01', type: 'role', desc: '担任主持人', images: [] },
          { date: '2019-09', type: 'activity', desc: '加入YOLO+', images: [] }
        ]
      },
      {
        id: 'sean', name: 'Sean', gender: 'male', motto: '做难而正确的事',
        skills: ['AWS SAA'], goal: '学会潜水',
        joinDate: '2021-11',
        joinPeriods: [{ start: '2021-11', end: null }],
        gallup: ['学习', '理念', '战略', '思维', '分析'],
        yoloRole: '理事',
        avatarStyle: 'adventurer-neutral', avatarSeed: 'Sean',
        mbti: 'INTP', hobbies: ['编程', '咖啡', '徒步'], career: '软件工程师',
        company: '', city: '杭州', birthday: '1995-12-01', zodiac: '射手座',
        wechat: 'sean_dev', education: 'UCB·CS', expertise: ['全栈开发', 'AI'],
        tags: ['代码洁癖', '咖啡重度用户'],
        qa: [
          { question: '你最得意的一项技能是怎么学会的？', answer: '全栈开发，从做毕业设计开始，一路写了六年代码，越写越上瘾。', askedBy: 'system' },
          { question: '你生活中最离不开的三样东西是什么？', answer: null, askedBy: 'system' }
        ],
        nodes: [
          { date: '2023-06', type: 'life', desc: '买房', images: ['https://picsum.photos/seed/house2/200', 'https://picsum.photos/seed/house3/200', 'https://picsum.photos/seed/house4/200'] },
          { date: '2022-03', type: 'role', desc: '担任组委', images: [] },
          { date: '2021-11', type: 'activity', desc: '加入YOLO+', images: [] }
        ]
      }
    ];

    var extraUsers = this._generateExtraUsers();
    return coreUsers.concat(extraUsers);
  },

  /**
   * 生成 27 个额外用户（与 HTML 原型 genExtraUsers 逻辑一致）
   */
  _generateExtraUsers: function () {
    var EXTRA_NAMES = [
      '李明', '王芳', '张伟', '刘洋', '陈静', '赵磊', '周婷', '吴强',
      '郑慧', '孙涛', '朱丽', '马超', '胡敏', '高峰', '林娜', '何军',
      '罗欣', '梁宇', '谢萍', '韩冰', '唐杰', '曹蕾', '许飞', '邓鑫',
      '冯琳', '蒋波', '沈露'
    ];
    var MBTI_TYPES = ['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP'];
    var CITIES = ['上海','北京','深圳','杭州','成都','广州','苏州','南京','武汉','厦门'];
    var CAREERS = ['产品经理','软件工程师','设计师','市场总监','咨询顾问','创业者','金融分析师','运营总监','HR总监','教师'];
    var HOBBIES_POOL = ['摄影','潜水','阅读','跑步','旅行','烹饪','瑜伽','画画','音乐','徒步','骑行','滑雪','冲浪','咖啡','写作'];
    var SKILLS_POOL = ['PMP','CPA','IELTS 7.5','PADI AOW','茶艺师','AWS SAA','马拉松完赛','潜水证','急救证','烹饪师','CFA'];
    var MOTTOS = [
      '保持热爱，奔赴山海', '慢慢来，比较快', '活在当下', '日拱一卒',
      '追光的人终会光芒万丈', '做自己的太阳', '人间值得', '永远好奇',
      '向阳而生', '不负热爱', '认真生活', '勇敢做自己',
      '一步一个脚印', '坚持就是胜利', '心之所向，素履以往',
      '不忘初心', '生活明朗，万物可爱', '温柔且有力量',
      '星光不负赶路人', '努力的人运气不会太差', '脚踏实地仰望星空',
      '每天进步一点点', '用心感受生活', '做最好的自己',
      '愿所得皆所期', '不畏将来不念过往', '越努力越幸运'
    ];
    var COMPANIES_POOL = ['字节跳动','阿里巴巴','腾讯','美团','小红书','快手','京东','蚂蚁集团','网易','拼多多','华为','微软','谷歌','苹果','滴滴'];
    var EDUCATION_POOL = ['北大·经济学','清华·计算机','浙大·传媒','复旦·金融','交大·机械','南大·文学','中科大·物理','武大·法学','同济·建筑','中山·医学','港大·商科','UCLA·CS','NYU·Marketing','LSE·Finance'];
    var EXPERTISE_POOL = ['产品设计','数据分析','投资理财','品牌营销','用户增长','AI应用','战略咨询','供应链','内容运营','技术架构'];
    var TAGS_POOL = ['马拉松跑者','猫奴','咖啡爱好者','摄影达人','读书狂人','素食主义','早起星人','二胎妈妈','数字游民','极简主义','露营爱好者','手冲咖啡','健身达人','旅行博主'];
    var ZODIAC_POOL = ['白羊座','金牛座','双子座','巨蟹座','狮子座','处女座','天秤座','天蝎座','射手座','摩羯座','水瓶座','双鱼座'];
    var GOALS_POOL = ['完成100公里越野跑','读完30本书','学会一门新语言','拿到新证书','完成一次公益项目','出版自己的书','组织一场百人活动','学会弹吉他'];

    // 人生事件模板（与 HTML 原型 LIFE_EVENTS 一致）
    var LIFE_EVENTS = [
      { type: 'life', desc: '大学毕业，踏入社会', imgs: ['https://picsum.photos/seed/grad1/200','https://picsum.photos/seed/grad2/200'] },
      { type: 'life', desc: '研究生毕业，学成归来', imgs: ['https://picsum.photos/seed/masters1/200'] },
      { type: 'life', desc: '结婚，开启人生新篇章', imgs: ['https://picsum.photos/seed/wed1/200','https://picsum.photos/seed/wed2/200','https://picsum.photos/seed/wed3/200'] },
      { type: 'life', desc: '喜得千金，家庭更圆满', imgs: ['https://picsum.photos/seed/babygirl1/200','https://picsum.photos/seed/babygirl2/200'] },
      { type: 'life', desc: '喜得贵子，升级为父母', imgs: ['https://picsum.photos/seed/babyboy1/200'] },
      { type: 'life', desc: '买房安家，有了自己的小窝', imgs: ['https://picsum.photos/seed/newhome1/200','https://picsum.photos/seed/newhome2/200'] },
      { type: 'role', desc: '跳槽到大厂，薪资翻倍', imgs: [] },
      { type: 'role', desc: '裸辞后成功转行', imgs: ['https://picsum.photos/seed/career1/200'] },
      { type: 'role', desc: '晋升为团队主管', imgs: [] },
      { type: 'life', desc: '独自出国旅行一个月', imgs: ['https://picsum.photos/seed/travel1/200','https://picsum.photos/seed/travel2/200','https://picsum.photos/seed/travel3/200'] },
      { type: 'life', desc: '完成人生第一个马拉松', imgs: ['https://picsum.photos/seed/marathon1/200','https://picsum.photos/seed/marathon2/200'] },
      { type: 'life', desc: '辞职创业，追逐梦想', imgs: ['https://picsum.photos/seed/startup1/200'] },
      { type: 'cert', desc: '拿到潜水证，解锁海底世界', imgs: ['https://picsum.photos/seed/dive1/200','https://picsum.photos/seed/dive2/200'] },
      { type: 'ted', desc: 'TED分享《从职场小白到管理者》', imgs: ['https://picsum.photos/seed/tedtalk1/200'] },
      { type: 'life', desc: '领养了一只猫，多了个毛孩子', imgs: ['https://picsum.photos/seed/cat1/200','https://picsum.photos/seed/cat2/200'] },
      { type: 'life', desc: '搬到新城市，开始新生活', imgs: ['https://picsum.photos/seed/city1/200'] },
      { type: 'cert', desc: '通过CPA考试', imgs: [] },
      { type: 'ted', desc: 'TED分享《30岁的选择》', imgs: ['https://picsum.photos/seed/ted30/200','https://picsum.photos/seed/ted31/200'] },
      { type: 'role', desc: '从甲方跳到乙方，换了个视角', imgs: [] },
      { type: 'life', desc: '考上MBA，重返校园', imgs: ['https://picsum.photos/seed/mba1/200'] },
      { type: 'life', desc: '二胎出生，家里更热闹了', imgs: ['https://picsum.photos/seed/baby2nd1/200'] },
      { type: 'role', desc: '创业公司被收购，功成身退', imgs: [] },
      { type: 'life', desc: '完成环青海湖骑行', imgs: ['https://picsum.photos/seed/bike1/200','https://picsum.photos/seed/bike2/200'] },
      { type: 'cert', desc: '获得AWS架构师认证', imgs: [] }
    ];

    var GALLUP_THEMES = this.globalData.GALLUP_THEMES;
    var SAMPLE_PHOTOS = this.globalData.SAMPLE_PHOTOS;
    var QA_POOL = this.globalData.QA_POOL;
    var QA_SAMPLE_ANSWERS = this.globalData.QA_SAMPLE_ANSWERS;

    // 随机选 5 个不重复的盖洛普主题
    function pickGallup() { return pickN(GALLUP_THEMES, 5); }

    // 额外用户中需要设为理事的 index (i=0 李明, i=1 王芳)
    var BOARD_INDICES = [0, 1];
    // 随机 4 个设为学习代表 (index 2-26)
    var DELEGATE_INDICES = [3, 7, 12, 18];
    // 有两段经历的用户 index
    var TWO_PERIOD_INDICES = [5, 15];

    var FEMALE_CHARS = '婷娜萍丽美芳玲雪燕秀莹蕾静洁倩琳艳敏慧颖薇妮雯佳欣露';
    function guessGender(name) {
      var lastChar = name.charAt(name.length - 1);
      return FEMALE_CHARS.indexOf(lastChar) >= 0 ? 'female' : 'male';
    }

    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function pickN(arr, n) {
      var s = arr.slice().sort(function () { return Math.random() - 0.5; });
      return s.slice(0, n);
    }

    var users = [];

    for (var i = 0; i < 27; i++) {
      var name = EXTRA_NAMES[i];
      var gender = guessGender(name);
      var isRich = i % 2 === 0; // 一半用户有丰富数据
      var jy = 2018 + Math.floor(Math.random() * 5);
      var jm = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
      var skills = pickN(SKILLS_POOL, isRich ? (2 + Math.floor(Math.random() * 2)) : (Math.random() > 0.5 ? 2 : 1));
      var hobbies = pickN(HOBBIES_POOL, isRich ? (3 + Math.floor(Math.random() * 2)) : (2 + Math.floor(Math.random() * 2)));
      var nodes = [{ date: jy + '-' + jm, type: 'activity', desc: '加入YOLO+', images: [pick(SAMPLE_PHOTOS)] }];

      if (isRich) {
        // 丰富用户获得 3-6 个多样的人生事件节点
        var eventCount = 3 + Math.floor(Math.random() * 4);
        var events = pickN(LIFE_EVENTS, eventCount);
        for (var ei = 0; ei < events.length; ei++) {
          var evt = events[ei];
          var ny = jy + ei;
          var nm = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
          if (ny <= 2025) {
            nodes.unshift({ date: ny + '-' + nm, type: evt.type, desc: evt.desc, images: evt.imgs.slice() });
          }
        }
        // 也加一个 YOLO+ 活动
        var ay = jy + 1;
        if (ay <= 2025) {
          nodes.splice(Math.floor(nodes.length / 2), 0, { date: ay + '-06', type: 'activity', desc: '参加YOLO+年度聚会', images: [pick(SAMPLE_PHOTOS)] });
        }
      } else {
        // 简单用户获得 1-2 个节点
        if (Math.random() > 0.4) {
          var ny2 = jy + 1 + Math.floor(Math.random() * 2);
          var nm2 = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
          var t = pick(['role', 'life', 'ted', 'cert', 'activity']);
          var d = { role: '担任活动组织者', life: '完成人生重要里程碑', ted: 'TED分享个人成长故事', cert: '获得' + skills[0] + '认证', activity: '参加YOLO+年度聚会' };
          nodes.unshift({ date: ny2 + '-' + nm2, type: t, desc: d[t], images: [] });
        }
      }

      // 生成 Q&A
      var qaQuestions = pickN(QA_POOL, 2 + Math.floor(Math.random() * 2));
      var qa = [];
      for (var qi = 0; qi < qaQuestions.length; qi++) {
        var hasAnswer = isRich && qi < 2;
        qa.push({
          question: qaQuestions[qi],
          answer: hasAnswer ? QA_SAMPLE_ANSWERS[qi % QA_SAMPLE_ANSWERS.length] : null,
          askedBy: 'system'
        });
      }

      // 确定 yoloRole
      var yoloRole = '';
      if (BOARD_INDICES.indexOf(i) !== -1) {
        yoloRole = '理事';
      } else if (DELEGATE_INDICES.indexOf(i) !== -1) {
        yoloRole = '学习代表';
      }

      // 构建 joinPeriods（两段经历的用户有 2 段）
      var joinPeriods;
      if (TWO_PERIOD_INDICES.indexOf(i) !== -1) {
        // 第一段：joinDate 到某个结束时间，第二段：之后回来至今
        var endY = jy + 1;
        var endM = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
        var restartY = endY + 1;
        var restartM = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
        joinPeriods = [
          { start: jy + '-' + jm, end: endY + '-' + endM },
          { start: restartY + '-' + restartM, end: null }
        ];
      } else {
        joinPeriods = [{ start: jy + '-' + jm, end: null }];
      }

      users.push({
        id: 'user_' + (i + 4),
        name: name,
        gender: gender,
        motto: MOTTOS[i % MOTTOS.length],
        skills: skills,
        goal: isRich ? pick(GOALS_POOL) : null,
        joinDate: jy + '-' + jm,
        joinPeriods: joinPeriods,
        gallup: pickGallup(),
        yoloRole: yoloRole,
        avatarStyle: 'adventurer-neutral',
        avatarSeed: name,
        mbti: Math.random() > 0.2 ? pick(MBTI_TYPES) : '',
        hobbies: hobbies,
        career: Math.random() > 0.3 ? pick(CAREERS) : '',
        company: isRich ? pick(COMPANIES_POOL) : '',
        city: Math.random() > 0.2 ? pick(CITIES) : '',
        birthday: isRich ? ('19' + (88 + Math.floor(Math.random() * 10)) + '-' + String(Math.floor(Math.random() * 12) + 1).padStart(2, '0') + '-' + String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')) : '',
        zodiac: isRich ? pick(ZODIAC_POOL) : '',
        wechat: isRich ? ('wx_' + (name.toLowerCase().replace(/[^a-z]/g, '') || ('user' + i))) : '',
        education: isRich ? pick(EDUCATION_POOL) : '',
        expertise: isRich ? pickN(EXPERTISE_POOL, 2) : [],
        tags: isRich ? pickN(TAGS_POOL, 2 + Math.floor(Math.random() * 2)) : [],
        qa: qa,
        nodes: nodes
      });
    }
    return users;
  }
});
