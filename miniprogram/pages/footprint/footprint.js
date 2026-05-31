var app = getApp();
var footprint = require("../../utils/footprint.js");
var TYPE_META = footprint.TYPE_META;

Page({
  data: {
    pageLoading: true,
    navPaddingTop: 20,
    activities: [],
    mapScope: "china",
    footprintSummary: null,
    footprintGroups: [],
    footprintMarkers: [],
    footprintIncludePoints: [],
    selectedFootprint: null,
    selectedFootprintActivities: [],
    footprintStatsLabel: "",
    onlineActivityCount: 0,
    mapLatitude: footprint.MAP_SCOPE_META.china.latitude,
    mapLongitude: footprint.MAP_SCOPE_META.china.longitude,
    mapScale: footprint.MAP_SCOPE_META.china.scale,
  },

  onLoad: function (options) {
    var scope = options && options.scope === "world" ? "world" : "china";
    this.setData({
      navPaddingTop: (app.globalData.statusBarHeight || 20) + 14,
      mapScope: scope,
    });
    this._loadActivities();
  },

  onShow: function () {
    if (!app.requireAuth()) return;
    if (!this.data.pageLoading && this.data.activities.length === 0) {
      this._loadActivities();
    }
  },

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
    var activities = (acts || []).slice().sort(function (a, b) {
      return (b.date || "").localeCompare(a.date || "");
    }).map(function (act) {
      var dateMeta = footprint.getActivityDateLabel(act);
      var typeMeta = TYPE_META[act.type] || TYPE_META.activity;
      var participants = app.getActivityParticipants ? app.getActivityParticipants(act) : [];
      return Object.assign({}, act, {
        participantCount: participants.length,
        yearStr: dateMeta.yearStr,
        yearMonth: dateMeta.yearMonth,
        dateLabel: dateMeta.dateLabel,
        typeLabel: typeMeta.label,
      });
    });

    var selectedKey = this.data.selectedFootprint && this.data.selectedFootprint.key;
    var state = footprint.buildFootprintState(activities, this.data.mapScope, selectedKey, {
      autoSelect: !!selectedKey,
    });
    this._setFootprintData(state, {
      activities: activities,
      footprintSummary: footprint.buildFootprintOverview(activities),
      pageLoading: false,
    });
  },

  _setFootprintData: function (state, extraData) {
    this._footprintMarkerMap = state.markerMap || {};
    this.setData(Object.assign({
      mapScope: state.scope,
      footprintGroups: state.groups,
      footprintMarkers: state.markers,
      footprintIncludePoints: state.includePoints,
      selectedFootprint: state.selected,
      selectedFootprintActivities: state.selectedActivities,
      footprintStatsLabel: state.statsLabel,
      onlineActivityCount: state.onlineActivityCount,
      mapLatitude: state.mapLatitude,
      mapLongitude: state.mapLongitude,
      mapScale: state.mapScale,
    }, extraData || {}));
  },

  _setFootprintState: function (scope, selectedKey, autoSelect) {
    var state = footprint.buildFootprintState(this.data.activities, scope, selectedKey, {
      autoSelect: autoSelect !== false,
    });
    this._setFootprintData(state);
  },

  onMapScopeTap: function (e) {
    var scope = e.currentTarget.dataset.scope || "china";
    if (scope === this.data.mapScope && !this.data.selectedFootprint) return;
    this._setFootprintState(scope, null, false);
  },

  onFootprintMarkerTap: function (e) {
    var markerId = e.detail && e.detail.markerId;
    var key = this._footprintMarkerMap && this._footprintMarkerMap[markerId];
    if (!key) return;
    this._setFootprintState(this.data.mapScope, key, true);
  },

  onFootprintTap: function (e) {
    var key = e.currentTarget.dataset.key;
    if (!key) return;
    this._setFootprintState(this.data.mapScope, key, true);
  },

  onResetOverviewTap: function () {
    this._setFootprintState(this.data.mapScope, null, false);
  },

  onFootprintActivityTap: function (e) {
    var activityKey = e.currentTarget.dataset.activityKey;
    if (!activityKey) return;
    wx.navigateTo({
      url: "/pages/activity-detail/activity-detail?activityKey=" + activityKey,
    });
  },
});
