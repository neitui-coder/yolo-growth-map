var app = getApp();
var footprint = require("../../utils/footprint.js");
var TYPE_META = footprint.TYPE_META;

Page({
  data: {
    pageLoading: true,
    activities: [],
    filteredActivities: [],
    activeYear: "全部",
    yearOptions: ["全部"],
    totalCount: 0,
    skeletonItems: [1, 2, 3],
    navPaddingTop: 20,
    footprintSummary: null,
  },

  onLoad: function () {
    this.setData({ navPaddingTop: (app.globalData.statusBarHeight || 20) + 14 });
    this._loadActivities();
  },

  onShow: function () {
    if (!app.requireAuth()) return;
    if (!this.data.pageLoading && this.data.activities.length === 0) {
      this._loadActivities();
    }
  },

  // 分享暂时关闭

  onPullDownRefresh: function () {
    var that = this;
    var load = function () {
      app.getActivitiesCache(function (acts) {
        that._processActivities(acts);
        wx.stopPullDownRefresh();
      }, { force: true });
    };
    if (app.ensureAllUsersLoaded) {
      app.ensureAllUsersLoaded(load);
    } else {
      load();
    }
  },

  _loadActivities: function () {
    var that = this;
    var load = function () {
      app.getActivitiesCache(function (acts) {
        that._processActivities(acts);
      });
    };
    if (app.ensureAllUsersLoaded) {
      app.ensureAllUsersLoaded(load);
    } else {
      load();
    }
  },

  _processActivities: function (acts) {
    var that = this;
    var activities = (acts || []).slice().sort(function (a, b) {
      return (b.date || "").localeCompare(a.date || "");
    });

    activities = activities.map(function (act) {
      var participants = app.getActivityParticipants
        ? app.getActivityParticipants(act)
        : [];
      var avatarStack = participants.slice(0, 4).map(function (p) {
        return {
          userId: p.userId,
          avatarUrl: app.getMediaUrl ? app.getMediaUrl(p.avatarImage) || p.avatarUrl || "" : p.avatarUrl || "",
          name: p.name || "",
          initial: (p.name || "?").slice(0, 1),
        };
      });
      var coverUrl = app.getMediaUrl ? app.getMediaUrl(act.coverImage) || act.coverImage || "" : act.coverImage || "";
      var yearStr = (act.date || "").slice(0, 4);
      var monthStr = (act.date || "").slice(5, 7);
      var yearMonth = yearStr && monthStr ? yearStr + " / " + monthStr : act.date || "";

      var typeMeta = TYPE_META[act.type] || TYPE_META.activity;
      var dateLabel = act.dateRange
        ? (yearStr ? yearStr + "年" + act.dateRange : act.dateRange)
        : yearMonth;
      return Object.assign({}, act, {
        coverUrl: coverUrl,
        participantCount: participants.length,
        avatarStack: avatarStack,
        extraAvatarCount: Math.max(participants.length - 4, 0),
        yearStr: yearStr,
        yearMonth: yearMonth,
        dateLabel: dateLabel,
        typeEmoji: typeMeta.emoji,
        typeLabel: typeMeta.label,
      });
    });

    var yearMap = {};
    activities.forEach(function (act) {
      if (act.yearStr) yearMap[act.yearStr] = true;
    });
    var yearOptions = ["全部"].concat(Object.keys(yearMap).sort(function (a, b) {
      return b.localeCompare(a);
    }));
    var activeYear = yearMap[this.data.activeYear] ? this.data.activeYear : "全部";
    var footprintSummary = footprint.buildFootprintOverview(activities);

    var coverRefs = activities.map(function (a) { return a.coverImage; }).filter(Boolean);
    if (app.prefetchMediaUrls) {
      app.prefetchMediaUrls(coverRefs);
    }

    that.setData({
      activities: activities,
      activeYear: activeYear,
      yearOptions: yearOptions,
      totalCount: activities.length,
      pageLoading: false,
      footprintSummary: footprintSummary,
    });
    that._applyFilter(activeYear, activities);
  },

  _applyFilter: function (year, activities) {
    var source = activities || this.data.activities;
    var filtered = year === "全部"
      ? source
      : source.filter(function (a) { return a.yearStr === year; });
    this.setData({ filteredActivities: filtered });
  },

  onYearTap: function (e) {
    var year = e.currentTarget.dataset.year;
    if (year === this.data.activeYear) return;
    this.setData({ activeYear: year });
    this._applyFilter(year);
  },

  onFootprintEntryTap: function () {
    wx.navigateTo({
      url: "/packageMap/pages/footprint-map/footprint-map",
    });
  },

  onStatsEntryTap: function () {
    wx.navigateTo({
      url: "/pages/community-stats/community-stats",
    });
  },

  onCardTap: function (e) {
    var activityKey = e.currentTarget.dataset.activityKey;
    if (!activityKey) return;
    wx.navigateTo({
      url: "/pages/activity-detail/activity-detail?activityKey=" + activityKey,
    });
  },
});
