var app = getApp();

var TYPE_META = {
  activity: { emoji: "🤝", label: "集体活动" },
  travel:   { emoji: "🌍", label: "游学" },
  annual:   { emoji: "🎉", label: "年会" },
};

Page({
  data: {
    pageLoading: true,
    activities: [],
    filteredActivities: [],
    activeYear: "全部",
    yearOptions: ["全部", "2026", "2025", "2024", "2023"],
    totalCount: 15,
    skeletonItems: [1, 2, 3],
    navPaddingTop: 20,
  },

  onLoad: function () {
    this.setData({ navPaddingTop: (app.globalData.statusBarHeight || 20) + 14 });
    this._loadActivities();
  },

  onShow: function () {
    if (!this.data.pageLoading && this.data.activities.length === 0) {
      this._loadActivities();
    }
  },

  onPullDownRefresh: function () {
    var that = this;
    app.getActivitiesCache(function (acts) {
      that._processActivities(acts);
      wx.stopPullDownRefresh();
    }, { force: true });
  },

  _loadActivities: function () {
    var that = this;
    app.getActivitiesCache(function (acts) {
      that._processActivities(acts);
    });
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
        };
      });
      var coverUrl = app.getMediaUrl ? app.getMediaUrl(act.coverImage) || act.coverImage || "" : act.coverImage || "";
      var yearStr = (act.date || "").slice(0, 4);
      var monthStr = (act.date || "").slice(5, 7);
      var yearMonth = yearStr && monthStr ? yearStr + " / " + monthStr : act.date || "";

      var typeMeta = TYPE_META[act.type] || TYPE_META.activity;
      return Object.assign({}, act, {
        coverUrl: coverUrl,
        participantCount: participants.length,
        avatarStack: avatarStack,
        extraAvatarCount: Math.max(participants.length - 4, 0),
        yearStr: yearStr,
        yearMonth: yearMonth,
        typeEmoji: typeMeta.emoji,
        typeLabel: typeMeta.label,
      });
    });

    var coverRefs = activities.map(function (a) { return a.coverImage; }).filter(Boolean);
    if (app.prefetchMediaUrls) {
      app.prefetchMediaUrls(coverRefs);
    }

    that.setData({
      activities: activities,
      pageLoading: false,
    });
    that._applyFilter(that.data.activeYear, activities);
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

  onCardTap: function (e) {
    var activityKey = e.currentTarget.dataset.activityKey;
    if (!activityKey) return;
    wx.navigateTo({
      url: "/pages/activity-detail/activity-detail?activityKey=" + activityKey,
    });
  },
});
