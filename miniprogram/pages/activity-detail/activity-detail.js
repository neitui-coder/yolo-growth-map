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

  // 分享暂时关闭

  _loadActivity: function (activityKey) {
    var that = this;
    var load = function () {
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
    };
    if (app.ensureAllUsersLoaded) {
      app.ensureAllUsersLoaded(load);
    } else {
      load();
    }
  },

  _renderActivity: function (act) {
    var that = this;

    var participants = app.getActivityParticipants
      ? app.getActivityParticipants(act)
      : [];

    var currentUid = app.isBoundMemberMode && app.isBoundMemberMode()
      ? (app.globalData.currentUserId || '')
      : '';
    var displayParticipants = participants.map(function (p) {
      return {
        userId: p.userId,
        name: p.name || "",
        role: p.role || "",
        avatarImage: p.avatarImage || "",
        avatarUrl: app.getMediaUrl
          ? app.getMediaUrl(p.avatarImage) || p.avatarUrl || ""
          : p.avatarUrl || "",
      };
    });
    // 排序：自己置顶，其余按姓名 zh-CN 排序
    displayParticipants.sort(function (a, b) {
      if (a.userId === currentUid) return -1;
      if (b.userId === currentUid) return 1;
      return (a.name || '').localeCompare(b.name || '', 'zh-CN');
    });

    var rawImages = act.images || [];
    var displayImages = rawImages.map(function (img) {
      return app.getMediaUrl ? app.getMediaUrl(img) || img : img;
    });

    var coverUrl = app.getMediaUrl
      ? app.getMediaUrl(act.coverImage) || act.coverImage || ""
      : act.coverImage || "";

    var baseDateLabel = util.formatDate
      ? util.formatDate(act.date)
      : act.date || "";
    var year = (act.date || "").slice(0, 4);
    var dateFormatted = act.dateRange
      ? (year ? year + "年" + act.dateRange : act.dateRange)
      : baseDateLabel;

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

  // 同行伙伴头像加载失败：重新解析临时 URL，仍失败则退回首字占位（不缓存空头像）
  onParticipantAvatarError: function (e) {
    var that = this;
    var idx = Number(e.currentTarget.dataset.index);
    var list = this.data.displayParticipants || [];
    var p = list[idx];
    if (!p || !p.avatarImage || p._avatarRetried) {
      if (p) this.setData(this._participantPatch(idx, { avatarUrl: "", _avatarRetried: true }));
      return;
    }
    this.setData(this._participantPatch(idx, { _avatarRetried: true }));
    if (app.refreshMediaUrl) {
      app.refreshMediaUrl(p.avatarImage, function (url) {
        that.setData(that._participantPatch(idx, { avatarUrl: url || "" }));
      });
    } else {
      this.setData(this._participantPatch(idx, { avatarUrl: "" }));
    }
  },

  _participantPatch: function (idx, fields) {
    var patch = {};
    Object.keys(fields).forEach(function (k) {
      patch["displayParticipants[" + idx + "]." + k] = fields[k];
    });
    return patch;
  },

  onParticipantTap: function (e) {
    var uid = e.currentTarget.dataset.userId;
    if (!uid) return;
    wx.navigateTo({ url: '/pages/profile/profile?userId=' + uid });
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
