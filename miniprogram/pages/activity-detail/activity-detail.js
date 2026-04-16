var util = require("../../utils/util.js");
var app = getApp();

var TYPE_META = {
  activity: { emoji: "🤝", label: "集体活动" },
  travel:   { emoji: "🌍", label: "游学" },
  annual:   { emoji: "🎉", label: "年会" },
};

Page({
  data: {
    pageLoading: true,
    activity: null,
    displayParticipants: [],
    displayImages: [],
    navPaddingTop: 20,
  },

  onLoad: function (options) {
    var activityKey = options.activityKey || "";
    this.setData({ navPaddingTop: (app.globalData.statusBarHeight || 20) + 14 });
    if (!activityKey) {
      wx.showToast({ title: "活动不存在", icon: "none" });
      return;
    }
    this._activityKey = activityKey;
    this._loadActivity(activityKey);
  },

  onShow: function () {
    if (!app.requireAuth()) return;
  },

  _loadActivity: function (activityKey) {
    var that = this;
    app.getActivitiesCache(function (acts) {
      var act = (acts || []).find(function (a) {
        return a.activityKey === activityKey;
      });
      if (!act) {
        wx.showToast({ title: "活动不存在", icon: "none" });
        that.setData({ pageLoading: false });
        return;
      }
      that._renderActivity(act);
    });
  },

  _renderActivity: function (act) {
    var that = this;

    var participants = app.getActivityParticipants
      ? app.getActivityParticipants(act)
      : [];

    var displayParticipants = participants.map(function (p) {
      return {
        userId: p.userId,
        name: p.name || "",
        role: p.role || "",
        avatarUrl: app.getMediaUrl
          ? app.getMediaUrl(p.avatarImage) || p.avatarUrl || ""
          : p.avatarUrl || "",
      };
    });

    var rawImages = act.images || [];
    var displayImages = rawImages.map(function (img) {
      return app.getMediaUrl ? app.getMediaUrl(img) || img : img;
    });

    var coverUrl = app.getMediaUrl
      ? app.getMediaUrl(act.coverImage) || act.coverImage || ""
      : act.coverImage || "";

    var dateFormatted = util.formatDate
      ? util.formatDate(act.date)
      : act.date || "";

    var typeMeta = TYPE_META[act.type] || TYPE_META.activity;
    var activity = Object.assign({}, act, {
      coverUrl: coverUrl,
      dateFormatted: dateFormatted,
      keyHighlights: act.keyHighlights || [],
      typeEmoji: typeMeta.emoji,
      typeLabel: typeMeta.label,
    });

    var allRefs = [act.coverImage]
      .concat(rawImages)
      .concat(participants.map(function (p) { return p.avatarImage; }))
      .filter(Boolean);

    if (app.prefetchMediaUrls) {
      app.prefetchMediaUrls(allRefs, function () {
        var resolvedParticipants = displayParticipants.map(function (p) {
          var rawUser = participants.find(function (u) { return u.userId === p.userId; });
          return Object.assign({}, p, {
            avatarUrl: rawUser
              ? app.getMediaUrl(rawUser.avatarImage) || p.avatarUrl
              : p.avatarUrl,
          });
        });
        var resolvedImages = rawImages.map(function (img) {
          return app.getMediaUrl(img) || img;
        });
        var resolvedCover = app.getMediaUrl(act.coverImage) || act.coverImage || "";
        that.setData({
          "activity.coverUrl": resolvedCover,
          displayParticipants: resolvedParticipants,
          displayImages: resolvedImages,
        });
      });
    }

    this.setData({
      activity: activity,
      displayParticipants: displayParticipants,
      displayImages: displayImages,
      pageLoading: false,
    });
  },

  onImageTap: function (e) {
    var index = Number(e.currentTarget.dataset.index || 0);
    var images = this.data.displayImages;
    if (!images || !images.length) return;
    wx.previewImage({
      current: images[index] || images[0],
      urls: images,
    });
  },

  onHeroTap: function () {
    var cover = this.data.activity && this.data.activity.coverUrl;
    if (!cover) return;
    var all = [cover].concat(this.data.displayImages || []);
    wx.previewImage({ current: cover, urls: all });
  },

  onGoBack: function () {
    wx.navigateBack();
  },
});
