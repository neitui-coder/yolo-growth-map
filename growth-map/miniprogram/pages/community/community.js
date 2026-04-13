var app = getApp();

Page({
  data: {
    pageLoading: true,
    feedItems: [],
    feedPage: 1,
    feedPageSize: 6,
    feedHasMore: true,
    feedLoadingMore: false,
    feedRefreshing: false,
    navPaddingTop: 20,
    skeletonItems: [1, 2, 3],
    imageViewerVisible: false,
    viewerImages: [],
    viewerIndex: 0,
  },

  onLoad: function () {
    var that = this;
    this._handleMediaCacheUpdated = function () {
      if (that.data.pageLoading) return;
      that._buildFeed(false);
    };
    this.setData({
      navPaddingTop: (app.globalData.statusBarHeight || 20) + 14,
    });
    if (app.globalData.usersLoaded) {
      this._ensureFeedUsers(true);
    } else {
      app.onUsersLoaded(this._ensureFeedUsers.bind(this, true));
    }
    this._setupLoadObserver();
    if (app.onMediaCacheUpdated) {
      app.onMediaCacheUpdated(this._handleMediaCacheUpdated);
    }
  },

  onShow: function () {
    if (app.globalData.usersLoaded) {
      this._ensureFeedUsers(false);
    }
  },

  onUnload: function () {
    if (this._loadObserver) {
      this._loadObserver.disconnect();
      this._loadObserver = null;
    }
  },

  onPullDownRefresh: function () {
    var that = this;
    this.setData({ feedRefreshing: true });
    this._ensureFeedUsers(true, function () {
      that.setData({ feedRefreshing: false });
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom: function () {
    this._loadMoreFeed();
  },

  _ensureFeedUsers: function (resetVisible, callback) {
    var that = this;
    if (!(this.data.feedItems || []).length) {
      this.setData({ pageLoading: true });
    }
    if (app.ensureAllUsersLoaded && !app.globalData.allUsersLoaded) {
      app.ensureAllUsersLoaded(function () {
        that._buildFeed(resetVisible);
        if (callback) callback();
      });
      return;
    }
    this._buildFeed(resetVisible);
    if (callback) callback();
  },

  _buildFeed: function (resetVisible) {
    var users = app.globalData.users || [];
    var allItems = app.getCommunityFeedData
      ? app.getCommunityFeedData(users)
      : [];
    this._allFeedItems = allItems;

    var pageSize = this.data.feedPageSize;
    var visibleCount = resetVisible
      ? pageSize
      : Math.max(this.data.feedItems.length || pageSize, pageSize);
    var visible = allItems.slice(0, visibleCount);

    this.setData({
      feedItems: visible,
      feedPage: Math.max(1, Math.ceil(visible.length / pageSize)),
      feedHasMore: allItems.length > visible.length,
      feedLoadingMore: false,
      pageLoading: false,
    });
    this._ensureViewportFilled();
  },

  _ensureViewportFilled: function () {
    var that = this;
    if (
      this._viewportCheckPending ||
      this.data.pageLoading ||
      this.data.feedLoadingMore ||
      !this.data.feedHasMore
    )
      return;
    this._viewportCheckPending = true;

    wx.nextTick(function () {
      var query = wx.createSelectorQuery().in(that);
      query.selectViewport().boundingClientRect();
      query.select(".community-page").boundingClientRect();
      query.exec(function (res) {
        that._viewportCheckPending = false;
        var viewportRect = res && res[0];
        var pageRect = res && res[1];
        if (!viewportRect || !pageRect) return;
        if ((pageRect.height || 0) <= (viewportRect.height || 0) + 160) {
          that._loadMoreFeed(true);
        }
      });
    });
  },

  _loadMoreFeed: function (silent) {
    if (this._feedLoadLock || this.data.feedLoadingMore || !this.data.feedHasMore)
      return;
    this._feedLoadLock = true;
    var pageSize = this.data.feedPageSize;
    var currentVisible = this.data.feedItems.length;
    var nextItems = (this._allFeedItems || []).slice(
      currentVisible,
      currentVisible + pageSize,
    );
    if (!nextItems.length) {
      this._feedLoadLock = false;
      this.setData({ feedHasMore: false });
      return;
    }

    var merged = this.data.feedItems.concat(nextItems);
    this.setData({
      feedItems: merged,
      feedPage: Math.max(1, Math.ceil(merged.length / pageSize)),
      feedHasMore: merged.length < (this._allFeedItems || []).length,
      feedLoadingMore: false,
    });
    this._feedLoadLock = false;
    this._ensureViewportFilled();
  },

  onAuthorTap: function (e) {
    var userId = e.currentTarget.dataset.userId;
    if (!userId || userId === "collective") return;
    wx.navigateTo({
      url: "/pages/profile/profile?userId=" + userId,
    });
  },

  onParticipantTap: function (e) {
    var userId = e.currentTarget.dataset.userId;
    if (!userId) return;
    wx.navigateTo({
      url: "/pages/profile/profile?userId=" + userId,
    });
  },

  onPreviewImages: function (e) {
    var index = Number(e.currentTarget.dataset.index || 0);
    var key = e.currentTarget.dataset.key;
    var that = this;
    var item = (this.data.feedItems || []).find(function (feedItem) {
      return feedItem.key === key;
    });
    var images = (item && item.images) || [];
    if (!images.length) return;
    if (app.prefetchMediaUrls) {
      app.prefetchMediaUrls(images, function (resolvedImages) {
        wx.previewImage({
          current: resolvedImages[index] || resolvedImages[0],
          urls: resolvedImages,
        });
        if (that._allFeedItems) {
          that._allFeedItems = that._allFeedItems.map(function (feedItem) {
            if (feedItem.key !== key) return feedItem;
            return Object.assign({}, feedItem, { images: resolvedImages });
          });
        }
      });
      return;
    }
    wx.previewImage({
      current: images[index] || images[0],
      urls: images,
    });
  },

  onCloseImageViewer: function () {
    this.setData({
      imageViewerVisible: false,
      viewerImages: [],
      viewerIndex: 0,
    });
  },

  onViewerChange: function (e) {
    this.setData({ viewerIndex: e.detail.current || 0 });
  },

  noop: function () {},

  _setupLoadObserver: function () {
    if (!this.createIntersectionObserver || this._loadObserver) return;
    var that = this;
    this._loadObserver = this.createIntersectionObserver({
      thresholds: [0.05],
    });
    this._loadObserver
      .relativeToViewport({ bottom: 220 })
      .observe(".community-load-sentinel", function (res) {
        if (res && res.intersectionRatio > 0) {
          that._loadMoreFeed(true);
        }
      });
  },
});
