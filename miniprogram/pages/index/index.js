var util = require("../../utils/util.js");
var app = getApp();

Page({
  data: {
    homeMode: "real",
    operatorModeActive: false,
    dataTypeLoading: false,
    pageLoading: true,
    listRefreshing: false,
    users: [],
    filteredUsers: [],
    filteredUserCount: 0,
    searchQuery: "",
    searchField: "",
    searchValue: "",
    activeFilter: "",
    sortByGrowth: false,
    showAlumni: false,
    canViewAlumni: false,
    filterOptions: [],
    memberPage: 1,
    memberPageSize: 12,
    memberHasMore: true,
    memberLoadingMore: false,
    navPaddingTop: 20,
    skeletonChipItems: [1, 2, 3, 4, 5],
    skeletonCardItems: [1, 2, 3, 4],
  },

  _decorateHomeUsers: function (users) {
    return (users || []).map(function (user) {
      var birthdayParsed = util.parseBirthday(user.birthday);
      return Object.assign({}, user, {
        avatarUrl: user.avatarUrl || util.getAvatarUrl(user, 60),
        growthValue: user.growthValue || util.computeGrowthValue(user),
        isBirthdayMonth: util.isBirthdayInCurrentMonth(user),
        birthdayTag: util.isBirthdayInCurrentMonth(user) ? "本月生日" : "",
        birthdayDayLabel: birthdayParsed
          ? birthdayParsed.month + "月" + birthdayParsed.day + "日"
          : "",
      });
    });
  },

  onLoad: function () {
    var that = this;
    this._handleMediaCacheUpdated = function () {
      if (that.data.pageLoading || that.data.dataTypeLoading) return;
      that._hydrateHomeData(
        false,
        Math.max(that.data.filteredUsers.length, that.data.memberPageSize),
      );
    };
    this.setData({
      navPaddingTop: (app.globalData.statusBarHeight || 20) + 14,
      homeMode: app.globalData.homeMode || "real",
      operatorModeActive: app.isOperatorModeActive
        ? app.isOperatorModeActive()
        : !!app.globalData.operatorModeActive,
    });

    if (app.globalData.usersLoaded) {
      this._hydrateHomeData(true);
    } else {
      app.onUsersLoaded(function () {
        that._hydrateHomeData(true);
        that._applyPendingHomeSearch();
      });
    }

    this._setupLoadObserver();
    if (app.onMediaCacheUpdated) {
      app.onMediaCacheUpdated(this._handleMediaCacheUpdated);
    }
  },

  onShow: function () {
    if (app.globalData.usersLoaded) {
      this._hydrateHomeData(false);
    }
    this._applyPendingHomeSearch();
  },

  onUnload: function () {
    if (this._loadObserver) {
      this._loadObserver.disconnect();
      this._loadObserver = null;
    }
  },

  onReachBottom: function () {
    this._loadMoreMembers();
  },

  onPullDownRefresh: function () {
    var that = this;
    var preserveVisibleCount = Math.max(
      this.data.filteredUsers.length,
      this.data.memberPageSize,
    );
    this.setData({
      listRefreshing: true,
    });
    app.switchHomeMode(this.data.homeMode || "mock", function () {
      that._hydrateHomeData(false, preserveVisibleCount);
      that.setData({ listRefreshing: false });
      wx.stopPullDownRefresh();
    });
  },

  _hydrateHomeData: function (resetMemberFilters, preserveVisibleCount) {
    var users = app.getHomeUsers
      ? app.getHomeUsers()
      : (app.globalData.users || []).map(function (u) {
          return Object.assign({}, u, {
            avatarUrl: util.getAvatarUrl(u, 60),
            growthValue: util.computeGrowthValue(u),
          });
        });
    users = this._decorateHomeUsers(users);

    this._allHomeUsers = users;
    this._memberFilteredUsers = users.slice();

    var isOperator = app.isOperatorModeActive
      ? app.isOperatorModeActive()
      : !!app.globalData.operatorModeActive;
    var currentUser = app.getUser
      ? app.getUser(app.globalData.currentUserId)
      : null;
    var isLishi = !!(
      currentUser &&
      currentUser.yoloRole &&
      currentUser.yoloRole.indexOf("理事") !== -1
    );
    var canViewAlumni =
      (app.globalData.homeMode !== "mock") && (isOperator || isLishi);

    var nextData = {
      homeMode: app.globalData.homeMode || "real",
      operatorModeActive: isOperator,
      canViewAlumni: canViewAlumni,
      users: users,
      filterOptions: app.getMemberFilterOptions
        ? app.getMemberFilterOptions(users)
        : [],
      pageLoading: false,
    };

    if (resetMemberFilters) {
      nextData.searchQuery = "";
      nextData.activeFilter = "";
      nextData.sortByGrowth = false;
    }

    this.setData(nextData);
    this._refreshMemberList(preserveVisibleCount);
    this._ensureViewportFilled();

    if (
      !app.globalData.allUsersLoaded &&
      app.ensureAllUsersLoaded &&
      !this._warmingAllUsers
    ) {
      var that = this;
      this._warmingAllUsers = true;
      app.ensureAllUsersLoaded(function () {
        that._warmingAllUsers = false;
        that._hydrateHomeData(
          false,
          Math.max(that.data.filteredUsers.length, that.data.memberPageSize),
        );
      });
    }
  },

  _refreshMemberList: function (preserveVisibleCount) {
    var query = (this.data.searchQuery || "").trim().toLowerCase();
    var searchField = this.data.searchField || "";
    var searchValue = (this.data.searchValue || "").trim().toLowerCase();
    var filter = this.data.activeFilter || "";
    var sortByGrowth = !!this.data.sortByGrowth;

    if (
      (query || filter || sortByGrowth) &&
      app.ensureAllUsersLoaded &&
      !app.globalData.allUsersLoaded &&
      !this._waitingAllUsers
    ) {
      var that = this;
      this._waitingAllUsers = true;
      this.setData({ listRefreshing: true });
      app.ensureAllUsersLoaded(function () {
        that._waitingAllUsers = false;
        that._hydrateHomeData(
          false,
          Math.max(that.data.filteredUsers.length, that.data.memberPageSize),
        );
        that.setData({ listRefreshing: false });
      });
      return;
    }

    var allUsers = this._allHomeUsers || [];
    var showAlumni = !!this.data.showAlumni;

    var filtered = allUsers.filter(function (u) {
      // Alumni filter: hide alumni unless toggle is on
      if (!showAlumni && u.memberStatus === "alumni") {
        return false;
      }
      if (searchField && searchValue) {
        if (!this._matchesScopedSearch(u, searchField, searchValue)) {
          return false;
        }
      } else if (query) {
        var pool = [
          u.name,
          u.mbti,
          Array.isArray(u.city) ? u.city.join(" ") : u.city,
          u.career,
          u.company,
          u.education,
          u.yoloRole,
          (u.gallup || []).join(" "),
          (u.hobbies || []).join(" "),
          (u.expertise || []).join(" "),
          (u.tags || []).join(" "),
        ]
          .filter(function (item) {
            return !!item;
          })
          .join(" ")
          .toLowerCase();
        if (pool.indexOf(query) === -1) return false;
      }

      if (filter) {
        if (u.mbti !== filter) {
          return false;
        }
      }

      return true;
    }, this);

    if (sortByGrowth) {
      filtered.sort(function (a, b) {
        var growthDelta = (b.growthValue || 0) - (a.growthValue || 0);
        if (growthDelta !== 0) return growthDelta;
        return (a.name || "").localeCompare(b.name || "", "zh-Hans-CN");
      });
      filtered = filtered.map(function (user, index) {
        return Object.assign({}, user, { _rank: index + 1 });
      });
    } else {
      filtered.sort(function (a, b) {
        if (!!a.isBirthdayMonth !== !!b.isBirthdayMonth) {
          return a.isBirthdayMonth ? -1 : 1;
        }
        var aBirthday = util.parseBirthday(a.birthday) || {
          month: 99,
          day: 99,
        };
        var bBirthday = util.parseBirthday(b.birthday) || {
          month: 99,
          day: 99,
        };
        if (a.isBirthdayMonth && b.isBirthdayMonth) {
          if (aBirthday.day !== bBirthday.day)
            return aBirthday.day - bBirthday.day;
        }
        return (a.name || "").localeCompare(b.name || "", "zh-Hans-CN");
      });
    }

    this._memberFilteredUsers = filtered;

    var visibleCount =
      preserveVisibleCount ||
      Math.max(
        this.data.memberPage * this.data.memberPageSize,
        this.data.memberPageSize,
      );
    var visible = filtered.slice(0, visibleCount);
    this.setData({
      filteredUsers: visible,
      filteredUserCount: filtered.length,
      memberPage: Math.max(
        1,
        Math.ceil(visible.length / this.data.memberPageSize),
      ),
      memberHasMore: filtered.length > visible.length,
      memberLoadingMore: false,
    });
    this._ensureViewportFilled();
  },

  _ensureViewportFilled: function () {
    var that = this;
    if (
      this._viewportCheckPending ||
      this.data.pageLoading ||
      this.data.memberLoadingMore ||
      !this.data.memberHasMore
    )
      return;
    this._viewportCheckPending = true;

    wx.nextTick(function () {
      var query = wx.createSelectorQuery().in(that);
      query.selectViewport().boundingClientRect();
      query.select(".home-page").boundingClientRect();
      query.exec(function (res) {
        that._viewportCheckPending = false;
        var viewportRect = res && res[0];
        var pageRect = res && res[1];
        if (!viewportRect || !pageRect) return;
        if ((pageRect.height || 0) <= (viewportRect.height || 0) + 140) {
          that._loadMoreMembers(true);
        }
      });
    });
  },

  _loadMoreMembers: function (silent) {
    if (
      this.data.dataTypeLoading ||
      this._memberLoadLock ||
      this.data.memberLoadingMore ||
      !this.data.memberHasMore
    )
      return;
    this._memberLoadLock = true;

    var pageSize = this.data.memberPageSize;
    var currentVisible = this.data.filteredUsers.length;
    var nextChunk = (this._memberFilteredUsers || []).slice(
      currentVisible,
      currentVisible + pageSize,
    );

    if (nextChunk.length > 0) {
      var merged = this.data.filteredUsers.concat(nextChunk);
      this.setData({
        filteredUsers: merged,
        memberPage: Math.max(1, Math.ceil(merged.length / pageSize)),
        memberHasMore: merged.length < (this._memberFilteredUsers || []).length,
        memberLoadingMore: false,
      });
      this._memberLoadLock = false;
      this._ensureViewportFilled();
      return;
    }

    if (app.loadMoreUsers && app.globalData.usersHasMore) {
      var that = this;
      this.setData({ memberLoadingMore: !silent });
      app.loadMoreUsers(function () {
        var allUsers = app.getHomeUsers
          ? app.getHomeUsers()
          : (app.globalData.users || []).map(function (user) {
              return Object.assign({}, user, {
                avatarUrl: util.getAvatarUrl(user, 60),
                growthValue: util.computeGrowthValue(user),
              });
            });
        allUsers = that._decorateHomeUsers(allUsers);

        that._allHomeUsers = allUsers;
        that._memberFilteredUsers = allUsers.slice();
        that.setData({
          users: allUsers,
          filterOptions: app.getMemberFilterOptions
            ? app.getMemberFilterOptions(allUsers)
            : [],
          memberLoadingMore: false,
        });
        that._memberLoadLock = false;
        that._refreshMemberList(currentVisible + pageSize);
      });
      return;
    }

    this._memberLoadLock = false;
    this.setData({ memberHasMore: false });
  },

  onSearchInput: function (e) {
    this.setData({
      searchQuery: e.detail.value,
      searchField: "",
      searchValue: "",
    });
    this._refreshMemberList();
  },

  onSearchClear: function () {
    this.setData({
      searchQuery: "",
      searchField: "",
      searchValue: "",
    });
    this._refreshMemberList();
  },

  onFilterTap: function (e) {
    this.setData({ activeFilter: e.currentTarget.dataset.filter });
    this._refreshMemberList();
  },

  onAlumniToggle: function () {
    this.setData({ showAlumni: !this.data.showAlumni });
    this._refreshMemberList();
  },

  onSortToggle: function () {
    this.setData({ sortByGrowth: !this.data.sortByGrowth });
    this._refreshMemberList();
  },

  onCardTap: function (e) {
    var userId = e.detail.userId;
    wx.navigateTo({
      url: "/pages/profile/profile?userId=" + userId,
    });
  },

  onBirthdayTap: function (e) {
    var userId = e.currentTarget.dataset.userId;
    if (!userId) return;
    wx.navigateTo({
      url: "/pages/profile/profile?userId=" + userId,
    });
  },

  _applyPendingHomeSearch: function () {
    if (!app.globalData.usersLoaded) return;
    var pending = app.consumePendingHomeSearch
      ? app.consumePendingHomeSearch()
      : null;
    if (!pending) return;

    this.setData({
      searchQuery: pending.query || "",
      searchField: pending.field || "",
      searchValue: pending.value || "",
      activeFilter: pending.filter || "",
      sortByGrowth: !!pending.sortByGrowth,
    });
    this._refreshMemberList();
  },

  _getScopedSearchValues: function (user, field) {
    var city = Array.isArray(user.city) ? user.city : user.city ? [user.city] : [];
    var fieldMap = {
      mbti: user.mbti ? [user.mbti] : [],
      city: city.concat(city.length > 1 ? [city.join("、")] : []),
      career: user.career ? [user.career] : [],
      company: user.company ? [user.company] : [],
      education: user.education ? [user.education] : [],
      birthday: user.birthday ? [user.birthday] : [],
      zodiac: user.zodiac ? [user.zodiac] : [],
      gallup: user.gallup || [],
      skills: user.skills || [],
      hobbies: user.hobbies || [],
      expertise: user.expertise || [],
      tags: user.tags || [],
      yoloRole: user.yoloRole ? [user.yoloRole] : [],
    };
    return (fieldMap[field] || [])
      .map(function (item) {
        return String(item || "").trim().toLowerCase();
      })
      .filter(Boolean);
  },

  _matchesScopedSearch: function (user, field, expected) {
    var values = this._getScopedSearchValues(user, field);
    if (!values.length) return false;
    if (
      field === "gallup" ||
      field === "skills" ||
      field === "hobbies" ||
      field === "expertise" ||
      field === "tags" ||
      field === "city"
    ) {
      return values.indexOf(expected) !== -1;
    }
    return values.some(function (value) {
      return value.indexOf(expected) !== -1;
    });
  },

  onToggleDataType: function (e) {
    var mode = e.currentTarget.dataset.mode;
    if (!mode || mode === this.data.homeMode || this.data.dataTypeLoading)
      return;

    var that = this;
    this.setData({
      dataTypeLoading: true,
      pageLoading: true,
      listRefreshing: false,
    });
    app.switchHomeMode(mode, function () {
      that._hydrateHomeData(true);
      that.setData({ dataTypeLoading: false });
    });
  },

  _setupLoadObserver: function () {
    if (!this.createIntersectionObserver || this._loadObserver) return;
    var that = this;
    this._loadObserver = this.createIntersectionObserver({
      thresholds: [0.05],
    });
    this._loadObserver
      .relativeToViewport({ bottom: 220 })
      .observe(".home-load-sentinel", function (res) {
        if (res && res.intersectionRatio > 0) {
          that._loadMoreMembers(true);
        }
      });
  },
});
